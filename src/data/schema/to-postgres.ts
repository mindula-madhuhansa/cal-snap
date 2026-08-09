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
 * `auth.uid()` is wrapped in a `select` so Postgres evaluates it once per
 * statement instead of once per row.
 */
const securityStatements = (table: Table): readonly string[] => [
  `alter table public.${table.name} enable row level security;`,
  `alter table public.${table.name} force row level security;`,
  '',
  `create policy ${table.name}_own_rows on public.${table.name}`,
  '  for all to authenticated',
  '  using      (user_id = (select auth.uid()))',
  '  with check (user_id = (select auth.uid()));',
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
