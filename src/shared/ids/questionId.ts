// Question ids for every question-making module (CREATIVE.md §3.1):
// `<MODULE>-Q-<n>` is the permanent id (n counts up, never reused), and
// `<MODULE>-Q-<n>.<version>` names one version — e.g. CUBE-Q-1.1, OBJECTS-Q-12.3.
// Ids stored before 0.26.0 were zero-padded (CUBE-Q-000001); they read the same. Pure.

/** The permanent id of question number `seq`. */
export const questionId = (prefix: string, seq: number) => `${prefix}-Q-${seq}`;

/** The id without zero padding (CUBE-Q-000001 → CUBE-Q-1). */
export const shortId = (id: string) => id.replace(/-Q-0*(\d+)$/, '-Q-$1');

/** One version of a question: CUBE-Q-1.1. */
export const questionRef = (id: string, version: number) => `${shortId(id)}.${version}`;

/** The question number in an id (padded or not); NaN when it is not an id. */
export const questionSeq = (id: string) => Number(/-Q-(\d+)$/.exec(id)?.[1] ?? NaN);
