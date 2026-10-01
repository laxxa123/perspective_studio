// Runtime validation of question JSON (CUBE §34): every question read from
// storage or imported is checked against the versioned schema.
import { z } from 'zod';
import type { Question } from './QuestionModel';

const face = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
const turns = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const transform = z.object({ x: z.number(), y: z.number(), rotation: z.number(), scaleX: z.number(), scaleY: z.number() });
const cell = z.object({ face, col: z.number(), row: z.number(), turns, mirrored: z.boolean().optional() });
const element = z.object({
  id: z.string(),
  kind: z.enum(['path', 'text', 'image', 'stamp']),
  transform,
  w: z.number(),
  h: z.number(),
  opacity: z.number().min(0).max(1),
  path: z.string().optional(),
  origin: z.enum(['pen', 'line', 'rect', 'ellipse', 'polygon', 'arrow', 'stamp']).optional(),
  stamp: z.string().optional(),
  fill: z.string().nullable().optional(),
  stroke: z.string().nullable().optional(),
  strokeWidth: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  assetId: z.string().optional(),
  crop: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});
const faceModel = z.object({
  id: face,
  background: z.string(),
  backgroundOpacity: z.number().min(0).max(1),
  elements: z.array(element),
  symmetry: z.union([z.literal('auto'), z.literal(1), z.literal(2), z.literal(4)]),
});
export const cubeModelSchema = z.object({
  schema: z.literal('creative.cube.model.v1'),
  faces: z.object({ A: faceModel, B: faceModel, C: faceModel, D: faceModel, E: faceModel, F: faceModel }),
  net: z.object({ cells: z.array(cell) }),
  patterns: z.array(
    z.object({
      id: z.string(),
      element,
      anchor: face,
      fragments: z.array(z.object({ face, transform })),
      continuityMode: z.literal('fold'),
    }),
  ),
});
const slot = z.object({ face, turns, mirrored: z.boolean() });
const figure = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cube'), view: z.tuple([slot, slot, slot]) }),
  z.object({ kind: z.literal('net'), cells: z.array(cell) }),
]);
const level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const code = z.enum(['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09']);

export const questionSchema = z.object({
  schema: z.literal('creative.cube.question.v1'),
  questionId: z.string().regex(/^CUBE-Q-\d{6}$/).nullable(),
  version: z.number().int().min(1),
  createdAt: z.string(),
  title: z.string(),
  spatialModel: cubeModelSchema,
  presentation: z.object({
    type: z.enum(['cube_to_net', 'net_to_cube']),
    optionCount: z.literal(5),
    prompt: z.string(),
    stem: z.array(figure).min(1),
  }),
  options: z.array(
    z.object({
      id: z.string(),
      figure,
      correct: z.boolean(),
      distractor: z.object({ code, type: z.string(), rule: z.string(), note: z.string() }).optional(),
      edited: z.boolean().optional(),
    }),
  ),
  answer: z.object({ correctOption: z.number().int(), optionId: z.string() }),
  difficulty: z.object({
    topology: level,
    adjacency: level,
    oppositeFaceReasoning: level,
    orientation: level,
    patternComplexity: level,
    transformationComplexity: level,
    distractorSimilarity: level,
    visualComplexity: level,
  }),
  dna: z.object({
    family: z.literal('cube'),
    operation: z.enum(['cube_to_net', 'net_to_cube']),
    faceCount: z.literal(6),
    optionCount: z.literal(5),
    stemFigures: z.number(),
    netShape: z.number(),
    optionNetShapes: z.array(z.number()),
    patterns: z.number(),
    facesWithArtwork: z.number(),
    skills: z.record(z.string(), z.number()),
    distractors: z.array(z.string()),
  }),
  rules: z.array(z.string()),
  explanation: z.object({
    correctOption: z.number().int(),
    reasoning: z.array(
      z.object({
        rule: z.enum(['adjacency', 'opposition', 'orientation', 'corner', 'mirror', 'continuity', 'net', 'viewpoint']),
        statement: z.string(),
        option: z.number().optional(),
      }),
    ),
  }),
  assets: z.array(z.object({ id: z.string(), mime: z.string() })),
});

/** Parses question JSON; throws a readable error. */
export function parseQuestion(raw: unknown): Question {
  const r = questionSchema.safeParse(raw);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`Not a valid CUBE question: ${i?.path.join('.')} ${i?.message}`);
  }
  return r.data as Question;
}
