import { describe, expect, it } from 'vitest';

import { MODEL, PROMPT_VERSION, SCAN_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt';

/**
 * What the model is asked, and the shape it must answer in (spec 0007, AC-17,
 * AC-9).
 *
 * AC-17 says a reply that does not match the schema is not a case the phone has
 * to handle, and the only thing making that true is the schema below being
 * strict enough for the API to constrain generation with. `additionalProperties`
 * left off one object, or one property missing from a `required` list, quietly
 * turns a guarantee back into a hope: the model may then omit a field, the
 * reply still validates, and the phone renders a meal with no calories.
 *
 * These are structural assertions, so they cost nothing to run and they fail on
 * exactly the edit that would loosen the contract.
 *
 * `MODEL` and `PROMPT_VERSION` are pinned here rather than read from
 * configuration, which is what makes a past scan explainable from its row: a
 * row recorded under `v1` was produced by exactly the words in this file at
 * `v1`. Nothing enforces the bump when the words change, so the test at the end
 * ties the version to the text it names.
 */

type SchemaObject = {
  readonly type: string;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: unknown;
};

const asObject = (value: unknown): SchemaObject => value as SchemaObject;

/** Every object node in the schema, so no nested one escapes the checks. */
const objectNodes = (
  node: unknown,
  path = 'root',
): readonly (readonly [string, SchemaObject])[] => {
  if (typeof node !== 'object' || node === null) return [];

  const schema = asObject(node);
  const here: readonly (readonly [string, SchemaObject])[] =
    schema.type === 'object' ? [[path, schema] as const] : [];

  const fromProperties = Object.entries(schema.properties ?? {}).flatMap(([name, child]) =>
    objectNodes(child, `${path}.${name}`),
  );
  const fromItems = schema.items === undefined ? [] : objectNodes(schema.items, `${path}[]`);

  return [...here, ...fromProperties, ...fromItems];
};

describe('the pinned model and prompt version', () => {
  // covers: AC-9. The recorded model is the one that ran, so it is a constant
  // rather than anything the environment can change underneath a stored row.
  it('names Claude Sonnet 5 exactly', () => {
    expect(MODEL).toBe('claude-sonnet-5');
  });

  it('carries a prompt version', () => {
    expect(PROMPT_VERSION).toBe('v1');
  });

  // The version exists to make a stored row explainable. If the words change
  // without the version changing, a row recorded under v1 no longer describes
  // what produced it. This ties the two together for the one thing the prompt
  // must never stop saying.
  it('still tells the model never to invent a food, under this version', () => {
    expect(PROMPT_VERSION).toBe('v1');
    expect(SYSTEM_PROMPT).toContain('Never invent a food');
    expect(SYSTEM_PROMPT).toContain('found_food to false');
  });

  // covers: AC-2. Honest confidence is asked for in words, because the marks on
  // screen are only as good as the judgement behind them.
  it('asks for honest confidence rather than a confident guess', () => {
    expect(SYSTEM_PROMPT).toContain('overconfident');
    expect(SYSTEM_PROMPT).toMatch(/high/);
    expect(SYSTEM_PROMPT).toMatch(/medium/);
    expect(SYSTEM_PROMPT).toMatch(/low/);
  });

  // covers: AC-1. The portion actually on the plate, not a standard serving,
  // and for that portion rather than per 100 g. Getting either wrong makes
  // every number plausible and wrong.
  it('asks for the portion on the plate, not a standard serving', () => {
    expect(SYSTEM_PROMPT).toContain('rather than a standard serving');
    expect(SYSTEM_PROMPT).toContain('not per 100 g');
  });

  it('asks the question it means to ask', () => {
    expect(USER_PROMPT).toContain('nutrition');
  });
});

describe('the structured output schema', () => {
  // covers: AC-17. This is what the API needs to constrain generation. Without
  // it on every object the reply can carry fields nothing checked.
  it('refuses extra properties on every object in the schema', () => {
    for (const [path, schema] of objectNodes(SCAN_SCHEMA)) {
      expect(schema.additionalProperties, `${path} allows extra properties`).toBe(false);
    }
  });

  // covers: AC-17. A property that is not required may simply be absent, and an
  // item with no calories renders as a meal worth nothing.
  it('requires every property it declares, on every object', () => {
    for (const [path, schema] of objectNodes(SCAN_SCHEMA)) {
      const declared = Object.keys(schema.properties ?? {}).sort();
      expect(
        [...(schema.required ?? [])].sort(),
        `${path} does not require all of its properties`,
      ).toEqual(declared);
    }
  });

  // covers: AC-1. Every field the result screen reads has to be in the shape
  // the model is held to, or it can come back missing.
  it('asks for a name, a portion, calories and all three macros per item', () => {
    const item = asObject(asObject(asObject(SCAN_SCHEMA).properties?.items).items);

    expect(Object.keys(item.properties ?? {}).sort()).toEqual(
      [
        'calories',
        'carbs_g',
        'confidence',
        'fat_g',
        'name',
        'protein_g',
        'quantity',
        'unit',
      ].sort(),
    );
  });

  // covers: AC-2. Per item, so one uncertain thing on a plate can be marked
  // alone rather than dragging the whole result down with it.
  it('carries a confidence on each item as well as on the result', () => {
    const root = asObject(SCAN_SCHEMA);
    const item = asObject(asObject(root.properties?.items).items);

    expect(asObject(root.properties?.confidence).type).toBe('string');
    expect(asObject(item.properties?.confidence).type).toBe('string');
  });

  // These three values are the same union the phone switches on in
  // `src/scan/transport.ts`. A fourth added on either side without the other is
  // a case no screen draws.
  it('allows exactly the three confidence values the phone knows', () => {
    const root = asObject(SCAN_SCHEMA);
    const item = asObject(asObject(root.properties?.items).items);
    const values = (node: unknown): readonly string[] =>
      (node as { readonly enum?: readonly string[] }).enum ?? [];

    expect(values(root.properties?.confidence)).toEqual(['high', 'medium', 'low']);
    expect(values(item.properties?.confidence)).toEqual(['high', 'medium', 'low']);
  });

  // The same union again, this time the portion units. `piece` is what keeps a
  // whole banana from having to be guessed in grams.
  it('allows exactly the three portion units the phone knows', () => {
    const item = asObject(asObject(asObject(SCAN_SCHEMA).properties?.items).items);
    const unit = item.properties?.unit as { readonly enum?: readonly string[] };

    expect(unit.enum).toEqual(['g', 'ml', 'piece']);
  });

  // covers: AC-3. The empty answer has to be expressible, or the model has
  // nowhere to put "there is no food here" except an invented item.
  it('lets the model say it found no food at all', () => {
    const root = asObject(SCAN_SCHEMA);

    expect(asObject(root.properties?.found_food).type).toBe('boolean');
    expect(root.required).toContain('found_food');
    expect(root.required).toContain('items');
  });
});
