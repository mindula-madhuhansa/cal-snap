import { postgresTypeFor, renderCheck, renderDefault } from './checks';
import { indexName, resolveColumns } from './resolve';
import type { Column, Index, Table } from './types';

/**
 * The Postgres half of the generator, pure like the SQLite half.
 *
 * Isolation is enforced here rather than in application code: every synced
 * table gets row level security enabled *and* forced, one policy testing
 * `user_id`, and an index on `user_id` because that policy runs on every row
 * touched (spec 0002, security model; AC-2).
 */

const columnLine = (column: Column): string => {
  const parts: string[] = [column.name, postgresTypeFor(column.type)];

  if (!column.nullable) parts.push('not null');
  if (column.default !== undefined) {
    parts.push(`default ${renderDefault(column.default, 'postgres')}`);
  }

  for (const check of column.checks ?? []) {
    parts.push(`check (${renderCheck(column.name, check)})`);
  }

  const reference = column.references;
  if (reference !== undefined) {
    const target = reference.table.includes('.') ? reference.table : `public.${reference.table}`;
    const onDelete = reference.onDelete === 'cascade' ? 'cascade' : 'set null';
    parts.push(`references ${target}(${reference.column}) on delete ${onDelete}`);
  }

  return `  ${parts.join(' ')}`;
};

const indexStatement = (table: Table, index: Index): string => {
  const unique = index.unique === true ? 'unique ' : '';
  const where = index.scope === 'live' ? ' where deleted_at is null' : '';
  return `create ${unique}index ${indexName(table.name, index.name)} on public.${table.name} (${index.on.join(', ')})${where};`;
};

/**
 * The acting identity is the `sub` claim of the verified Clerk token, not
 * `auth.uid()` (spec 0004, security model). Supabase validates the token's
 * signature against Clerk's published keys before any policy runs, so a client
 * cannot lie about who it is.
 *
 * **`auth.uid()` must never appear here again.** With Clerk it returns null
 * rather than failing, so a policy written from a Supabase example would match
 * zero rows silently instead of erroring. `to-postgres.test.ts` fails if the
 * string reappears in generated SQL.
 *
 * The claim is wrapped in a `select` so Postgres evaluates it once per
 * statement instead of once per row.
 */
const ACTING_USER = "(select auth.jwt() ->> 'sub')";

const securityStatements = (table: Table): readonly string[] => [
  `alter table public.${table.name} enable row level security;`,
  `alter table public.${table.name} force row level security;`,
  '',
  `create policy ${table.name}_own_rows on public.${table.name}`,
  '  for all to authenticated',
  `  using      (user_id = ${ACTING_USER})`,
  `  with check (user_id = ${ACTING_USER});`,
];

export const tableToPostgres = (table: Table): string => {
  const columns = resolveColumns(table, 'postgres').map(columnLine);
  const primaryKey = `  primary key (${table.primaryKey.join(', ')})`;
  const body = [...columns, primaryKey].join(',\n');
  const indexes = (table.indexes ?? []).map((index) => indexStatement(table, index));

  return [
    `create table public.${table.name} (\n${body}\n);`,
    ...indexes,
    '',
    ...securityStatements(table),
  ].join('\n');
};

/**
 * The full migration body. Tables are emitted in declaration order, which is
 * dependency order, so a foreign key never points at a table that does not
 * exist yet.
 */
export const toPostgres = (tables: readonly Table[]): string =>
  tables
    .filter((table) => table.presence === 'both')
    .map(tableToPostgres)
    .join('\n\n') + '\n';

/**
 * Sync arbitration (spec 0005), emitted **separately** from `toPostgres`.
 *
 * It has to be separate. `toPostgres` writes the core migration, which is
 * already applied to the live database, and regenerating that file with new
 * statements in it would rewrite history rather than extend it. So this
 * produces its own migration body and the core one is never touched again.
 *
 * What it is for: spec 0002 said the server assigns `updated_at` and that a
 * deleted row is never revived, and nothing implemented either. The stored
 * `updated_at` was whatever the pushing phone sent, and because `pullChanges`
 * pages on that column, a phone with a slow clock pushed rows stamped behind
 * another device's watermark and that device never pulled them. A meal simply
 * missing, with both phones online and nothing failing.
 */

/**
 * Two functions rather than one, and this is not a style choice: `NEW` and
 * `OLD` are untyped records, so `new.deleted_at` on a table without that
 * column is not caught when the function is created. It raises at runtime, on
 * a real write. A table gets the variant its declaration earns.
 */
const SYNC_STAMP = `create or replace function public.sync_stamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Frozen, never restamped. \`saveMeal\` gives a meal and all of its items
    -- one identical \`created_at\`, and \`searchPastItems\` orders on it, but a
    -- meal and its items are pushed in separate statements. A server stamp
    -- would split the instant they deliberately share.
    new.created_at := old.created_at;
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;`;

/**
 * `clock_timestamp()` rather than `now()`, which is the transaction's start
 * time and would give every row in one push batch the same instant. A pull
 * stops advancing when a whole page shares one, and today that is safe only
 * because `BATCH` is 200 and `PAGE` is 500, two unrelated constants in two
 * files with nothing asserting the relationship.
 *
 * Returning `OLD` is the load bearing part of the sticky variant. A `before`
 * trigger that returns null cancels the row, and PostgREST then leaves it out
 * of the reply, so the push would never see an acknowledgement and the row
 * would stay dirty and be retried forever. Returning `OLD` performs a write
 * that changes nothing and puts the stored row in the reply, which is exactly
 * what the phone needs in order to learn that it lost.
 *
 * Note that it reverts the whole row, not only `deleted_at`, so any edit sent
 * with the revival is discarded too. That is intended: an edit to a meal that
 * has already been deleted has nothing to apply to.
 */
const SYNC_STAMP_STICKY_DELETE = `create or replace function public.sync_stamp_sticky_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.deleted_at is not null and new.deleted_at is null then
      return old;
    end if;

    new.created_at := old.created_at;
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;`;

/** A table earns the sticky variant by declaring a tombstone. */
const stampFunctionFor = (table: Table): string =>
  table.softDelete ? 'public.sync_stamp_sticky_delete()' : 'public.sync_stamp()';

const triggerStatement = (table: Table): string =>
  `create trigger ${table.name}_sync_stamp
  before insert or update on public.${table.name}
  for each row execute function ${stampFunctionFor(table)};`;

/**
 * Every synced table that carries lifecycle columns gets one trigger. A table
 * that lives only on the phone is never sent anywhere, so it has nothing to
 * arbitrate.
 */
export const toPostgresSyncTriggers = (tables: readonly Table[]): string => {
  const stamped = tables.filter((table) => table.presence === 'both' && table.timestamps);
  if (stamped.length === 0) return '\n';

  const triggers = stamped.map(triggerStatement).join('\n\n');
  return `${SYNC_STAMP}\n\n${SYNC_STAMP_STICKY_DELETE}\n\n${triggers}\n`;
};
