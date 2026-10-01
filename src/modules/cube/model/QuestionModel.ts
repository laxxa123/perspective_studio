// The canonical question (CUBE §23–§36): the portable, versioned, semantic
// representation. Images are presentation only; this is authoritative.
import type { CubeModel, NetCell } from './CubeModel';
import type { CubeView } from '../geometry/FoldingEngine';

export const QUESTION_SCHEMA = 'creative.cube.question.v1';

export type QuestionType = 'cube_to_net' | 'net_to_cube';

/** What a stem or an option shows: one corner view of a cube, or a net. */
export type Figure = { kind: 'cube'; view: CubeView } | { kind: 'net'; cells: NetCell[] };

export type DistractorCode = 'D01' | 'D02' | 'D03' | 'D04' | 'D05' | 'D06' | 'D07' | 'D08' | 'D09';

export const DISTRACTORS: Record<DistractorCode, { type: string; label: string }> = {
  D01: { type: 'opposite_face_violation', label: 'Opposite faces shown touching' },
  D02: { type: 'wrong_adjacency', label: 'Wrong neighbours' },
  D03: { type: 'wrong_corner', label: 'Wrong corner relationship' },
  D04: { type: 'wrong_orientation', label: 'Face turned a quarter' },
  D05: { type: 'mirror', label: 'Mirrored face' },
  D06: { type: 'rotated_pattern', label: 'Face turned upside down' },
  D07: { type: 'invalid_net', label: 'Net cannot fold into a cube' },
  D08: { type: 'broken_continuity', label: 'Pattern broken across a fold' },
  D09: { type: 'wrong_viewpoint', label: 'Faces in the wrong corner order' },
};

export interface QuestionOption {
  /** Stable within the question. */
  id: string;
  figure: Figure;
  correct: boolean;
  /** How a distractor was made (CUBE §26); absent on the correct option. */
  distractor?: { code: DistractorCode; type: string; rule: string; note: string };
  /** Set when the author edited the option by hand (CUBE §27). */
  edited?: boolean;
}

export const DIFFICULTY_DIMENSIONS = [
  'topology',
  'adjacency',
  'oppositeFaceReasoning',
  'orientation',
  'patternComplexity',
  'transformationComplexity',
  'distractorSimilarity',
  'visualComplexity',
] as const;
export type DifficultyDimension = (typeof DIFFICULTY_DIMENSIONS)[number];
/** 1 = low … 5 = very difficult (CUBE §29). */
export type Difficulty = Record<DifficultyDimension, 1 | 2 | 3 | 4 | 5>;

export interface QuestionDNA {
  family: 'cube';
  operation: QuestionType;
  faceCount: 6;
  optionCount: 5;
  stemFigures: number;
  /** Which of the 11 nets the authored net is (0–10). */
  netShape: number;
  /** Net shape of each net figure in the options (−1 = not a cube net). */
  optionNetShapes: number[];
  patterns: number;
  facesWithArtwork: number;
  skills: Record<string, number>;
  distractors: string[];
}

export interface ReasoningStep {
  rule: 'adjacency' | 'opposition' | 'orientation' | 'corner' | 'mirror' | 'continuity' | 'net' | 'viewpoint';
  statement: string;
  option?: number;
}

export interface Question {
  schema: typeof QUESTION_SCHEMA;
  /** CUBE-Q-000001…; null until committed (CUBE §32). */
  questionId: string | null;
  /** 1, 2, 3 … ; each commit after the first adds a version (CUBE §33). */
  version: number;
  createdAt: string;
  title: string;
  spatialModel: CubeModel;
  presentation: {
    type: QuestionType;
    optionCount: 5;
    prompt: string;
    stem: Figure[];
  };
  options: QuestionOption[];
  answer: { correctOption: number; optionId: string };
  difficulty: Difficulty;
  dna: QuestionDNA;
  /** Construction rules used (generator rule ids). */
  rules: string[];
  explanation: { correctOption: number; reasoning: ReasoningStep[] };
  /** Assets the question needs (content in the asset store, CUBE §19). */
  assets: { id: string; mime: string }[];
}
