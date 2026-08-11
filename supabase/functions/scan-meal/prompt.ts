/**
 * What the model is asked, and the shape it must answer in (spec 0007, AC-17).
 *
 * The schema is handed to the model API as a structured output format, so a
 * reply that does not match it is not something the phone has to cope with.
 * There is no JSON repair here, no parse retry, and no partial result.
 */

/**
 * Bumped by hand whenever the system prompt or the schema below changes.
 *
 * This is what makes a past scan explainable later: a row recorded under `v1`
 * was produced by exactly the words and the shape in this file at `v1`. Nothing
 * enforces the bump, so changing either without changing this is a real, quiet
 * mistake.
 */
export const PROMPT_VERSION = 'v1';

/** Pinned, never read from configuration, so the recorded model is the one that ran. */
export const MODEL = 'claude-sonnet-5';

export const SYSTEM_PROMPT = [
  'You identify food in a photograph and estimate its nutrition.',
  '',
  'Name each distinct food you can see, and estimate the portion actually on the',
  'plate rather than a standard serving. Give calories as a whole number and',
  'protein, carbs and fat in grams to one decimal place, for the portion you',
  'estimated, not per 100 g.',
  '',
  'Be honest about how sure you are. Mark an item "high" only when you can both',
  'identify the food and judge its portion confidently. Use "medium" when you',
  'know the food but are guessing the amount, and "low" when the food itself is',
  'a guess. A person is going to act on these numbers, so an overconfident mark',
  'is worse than a cautious one.',
  '',
  'If the photograph contains no food you can identify, set found_food to false',
  'and return an empty items list. Never invent a food to fill an empty result.',
].join('\n');

export const USER_PROMPT = 'What food is in this photo, and what is its nutrition?';

/**
 * The result shape, as the model API's structured output schema.
 *
 * `additionalProperties: false` and a full `required` list on every object are
 * what the API needs to constrain generation, not decoration.
 */
export const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    found_food: {
      type: 'boolean',
      description: 'Whether any identifiable food is present in the photo.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'How sure you are about the reading as a whole.',
    },
    items: {
      type: 'array',
      description: 'One entry per distinct food. Empty when found_food is false.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'What the food is, in plain words.' },
          quantity: { type: 'number', description: 'How much of it, in the unit below.' },
          unit: { type: 'string', enum: ['g', 'ml', 'piece'] },
          calories: { type: 'number', description: 'Kilocalories for this portion.' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: [
          'name',
          'quantity',
          'unit',
          'calories',
          'protein_g',
          'carbs_g',
          'fat_g',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['found_food', 'confidence', 'items'],
  additionalProperties: false,
} as const;
