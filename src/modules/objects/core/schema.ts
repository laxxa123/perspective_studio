// Reading stored questions (OBJECTS §44, §73): the canonical JSON is checked
// when read; a question that does not match the schema is refused, not
// guessed at. Schema `creative.objects.question.v1`.
import { z } from 'zod';
import { QUESTION_SCHEMA, type Question } from './questions';

const int = z.number().int();
const cell = z.tuple([int, int, int]);
const cell2 = z.tuple([int, int]);
const blocks = z.array(cell);
const grid = z.object({ w: int, h: int, cells: z.array(cell2) });
const figure = z.object({ n: int, cells: z.array(cell2), marks: z.array(z.object({ c: int, r: int, kind: z.enum(['dot', 'arrow']), dir: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) })) });
const fold = z.object({ n: int, folds: z.array(z.enum(['v', 'h', 'd'])), holes: z.array(cell2) });
const item = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('blocks'), blocks, tint: z.array(cell).optional() }),
  z.object({ kind: z.literal('grid'), grid, label: z.string().optional() }),
  z.object({ kind: z.literal('figure'), figure }),
  z.object({ kind: z.literal('holes'), n: int, holes: z.array(cell2) }),
  z.object({ kind: z.literal('number'), value: int }),
  z.object({ kind: z.literal('pair'), a: blocks, b: blocks }),
  z.object({ kind: z.literal('folds'), spec: fold }),
]);
const op = z.enum(['r90', 'r180', 'r270', 'fv', 'fh', 'fd', 'fa']);

export const questionSchema = z.object({
  schema: z.literal(QUESTION_SCHEMA),
  questionId: z.string().nullable(),
  version: int,
  family: z.enum(['same', 'turn', 'view', 'reconstruct', 'count', 'section', 'track', 'assemble', 'f-turn', 'f-reflect', 'f-same', 'f-steps', 'fold']),
  stem: z.string(),
  source: z.object({ blocks, marked: cell.nullable(), figure, fold }),
  params: z.object({
    axis: z.enum(['x', 'y', 'z']),
    quarters: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    side: z.enum(['front', 'back', 'top', 'bottom', 'left', 'right']),
    layer: int,
    count: z.enum(['all', 'hidden']),
    ops: z.array(op),
  }),
  options: z.array(z.object({ item, rule: z.string(), note: z.string() })),
  correct: int,
  seed: int,
  profile: z.object({ size: int, hidden: int, steps: int, mirror: z.boolean(), difficulty: int.min(1).max(5), difficultySet: z.boolean() }),
  explanation: z.array(z.string()),
  createdAt: z.string(),
});

/** A stored question, checked (throws on a malformed one). */
export const parseQuestion = (raw: unknown): Question => questionSchema.parse(raw) as Question;
