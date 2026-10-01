// Question builder (CUBE §24–§31): choose the type, generate five options,
// override anything, set difficulty, validate, commit to the bank.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, FlipHorizontal2, Pencil, RefreshCw, RotateCw, Sparkles } from 'lucide-react';
import { FACE_IDS, type CubeModel, type FaceId, type Turns } from '../model/CubeModel';
import { DIFFICULTY_DIMENSIONS, DISTRACTORS, type DistractorCode, type Question, type QuestionType } from '../model/QuestionModel';
import { validateNet } from '../geometry/NetValidator';
import { buildQuestion, DISTRACTOR_CHOICES, refreshDerived, regenerateOption } from '../question/QuestionEngine';
import type { QuestionIssue } from '../question/QuestionValidator';
import { commit, issuesOf } from '../services/CubeService';
import { useCubeStore } from '../state/useCubeStore';
import { FigureImg } from './Figure';

const DIM_LABEL: Record<string, string> = {
  topology: 'Topology',
  adjacency: 'Adjacency',
  oppositeFaceReasoning: 'Opposite faces',
  orientation: 'Orientation',
  patternComplexity: 'Pattern',
  transformationComplexity: 'Transformation',
  distractorSimilarity: 'Distractor similarity',
  visualComplexity: 'Visual complexity',
};
const turn = (t: Turns): Turns => ((t + 1) % 4) as Turns;
const seed = () => Math.floor(Math.random() * 1e9);

export function QuestionBuilder({ model }: { model: CubeModel }) {
  const question = useCubeStore((s) => s.question);
  const editing = useCubeStore((s) => s.editing);
  const assets = useCubeStore((s) => s.assets);
  const st = useCubeStore.getState;
  const [type, setType] = useState<QuestionType>(question?.presentation.type ?? 'net_to_cube');
  const [stemCount, setStemCount] = useState<1 | 2>(question?.presentation.stem.length === 2 ? 2 : 1);
  const [codes, setCodes] = useState<DistractorCode[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [issues, setIssues] = useState<QuestionIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const netOk = useMemo(() => validateNet(model.net.cells).valid, [model.net.cells]);

  // Keep the question on the current cube (CUBE §27: the author may still change faces and net).
  useEffect(() => {
    if (!question || question.spatialModel === model) return;
    const stem = question.presentation.type === 'net_to_cube' ? [{ kind: 'net' as const, cells: model.net.cells.map((c) => ({ ...c })) }, ...question.presentation.stem.slice(1)] : question.presentation.stem;
    st().set({ question: refreshSafe({ ...question, spatialModel: model, presentation: { ...question.presentation, stem } }) });
  }, [model, question, st]);

  useEffect(() => {
    let live = true;
    if (question) issuesOf(question).then((i) => live && setIssues(i));
    return () => {
      live = false;
    };
  }, [question]);

  const setQ = (q: Question) => st().set({ question: q });
  const generate = () => {
    try {
      setQ(buildQuestion(model, { type, stemCount, distractors: codes, seed: seed() }));
      setEditIdx(null);
    } catch (e) {
      st().showToast(e instanceof Error ? e.message : String(e));
    }
  };

  if (!netOk) return <div className="builder empty">⚠ Fix the net first: it must fold into a cube.</div>;

  const settings = (
    <section className="builder-settings">
      <div className="props-row">
        {(['net_to_cube', 'cube_to_net'] as QuestionType[]).map((t) => (
          <button key={t} className={type === t ? 'seg active' : 'seg'} onClick={() => { setType(t); setCodes([]); }}>
            {t === 'net_to_cube' ? 'Net → Cube' : 'Cube → Net'}
          </button>
        ))}
        <span className="muted">Show</span>
        {([1, 2] as const).map((n) => (
          <button key={n} className={stemCount === n ? 'seg active' : 'seg'} onClick={() => setStemCount(n)}>
            {n === 1 ? (type === 'net_to_cube' ? '1 net' : '1 cube') : type === 'net_to_cube' ? '2 nets' : '2 views'}
          </button>
        ))}
      </div>
      <div className="props-row wrap">
        <span className="muted">Distractors</span>
        {DISTRACTOR_CHOICES[type].map((c) => (
          <button key={c} className={codes.includes(c) ? 'chip-sm active' : 'chip-sm'} title={DISTRACTORS[c].label} onClick={() => setCodes(codes.includes(c) ? codes.filter((x) => x !== c) : [...codes, c])}>
            <b>{c}</b> {DISTRACTORS[c].label}
          </button>
        ))}
      </div>
      <button className="primary" onClick={generate}>
        <Sparkles size={16} /> {question ? 'Regenerate question' : 'Create question'}
      </button>
    </section>
  );

  if (!question) return <div className="builder">{settings}</div>;

  const q = question;
  const update = (opts: Question['options']) => setQ(refreshSafe({ ...q, options: opts }));
  const errors = issues;

  return (
    <div className="builder">
      {settings}
      <section>
        <label className="row-field">
          <span>Title</span>
          <input value={q.title} placeholder="Optional" onChange={(e) => setQ({ ...q, title: e.target.value })} />
        </label>
        <p className="prompt">{q.presentation.prompt}</p>
        <div className="stem">
          {q.presentation.stem.map((f, i) => (
            <FigureImg key={i} model={q.spatialModel} figure={f} assets={assets} px={260} />
          ))}
        </div>
      </section>

      <section className="options">
        {q.options.map((o, i) => (
          <div key={o.id} className={`option${o.correct ? ' correct' : ''}${errors.some((x) => x.option === i + 1) ? ' bad' : ''}`}>
            <div className="option-head">
              <strong>({i + 1})</strong>
              <span className="tag">{o.correct ? '✓ Correct' : o.distractor ? `${o.distractor.code} ${DISTRACTORS[o.distractor.code].label}` : 'Edited'}</span>
            </div>
            <FigureImg model={q.spatialModel} figure={o.figure} assets={assets} px={200} />
            <div className="option-actions">
              <button className="seg" title="Mark correct" aria-label="Mark correct" onClick={() => update(q.options.map((x, j) => ({ ...x, correct: j === i, distractor: j === i ? undefined : x.distractor })))}>
                <Check size={16} />
              </button>
              <button className="seg" title="Regenerate" aria-label="Regenerate option" onClick={() => setQ(regenerateOption(q, i, null, seed()))}>
                <RefreshCw size={16} />
              </button>
              <button className="seg" title="Edit" aria-label="Edit option" onClick={() => setEditIdx(editIdx === i ? null : i)}>
                <Pencil size={16} />
              </button>
              <button className="seg" aria-label="Move up" disabled={i === 0} onClick={() => update(swap(q.options, i, i - 1))}>
                <ArrowUp size={16} />
              </button>
              <button className="seg" aria-label="Move down" disabled={i === q.options.length - 1} onClick={() => update(swap(q.options, i, i + 1))}>
                <ArrowDown size={16} />
              </button>
            </div>
            {o.distractor && <p className="muted small">{o.distractor.note}</p>}
          </div>
        ))}
      </section>

      {editIdx !== null && q.options[editIdx] && (
        <OptionEditor q={q} index={editIdx} onChange={setQ} />
      )}

      <section className="difficulty">
        <h3>Difficulty (1 low – 5 very difficult)</h3>
        {DIFFICULTY_DIMENSIONS.map((d) => (
          <label key={d} className="slider">
            <span>
              {DIM_LABEL[d]} <b>{q.difficulty[d]}</b>
            </span>
            <input type="range" min={1} max={5} step={1} value={q.difficulty[d]} onChange={(e) => setQ(refreshSafe({ ...q, difficulty: { ...q.difficulty, [d]: Number(e.target.value) as 1 } }))} />
          </label>
        ))}
      </section>

      <section className="explanation">
        <h3>Explanation</h3>
        <ul>
          {q.explanation.reasoning.map((r, i) => (
            <li key={i}>
              <span className="tag">{r.rule}</span> {r.statement}
            </li>
          ))}
        </ul>
      </section>

      <section className="validation">
        <h3>{errors.length ? `⚠ ${errors.length} problem${errors.length > 1 ? 's' : ''}` : '✓ Ready to commit'}</h3>
        <ul>
          {errors.map((x, i) => (
            <li key={i}>
              <span className="tag">{x.group}</span> {x.message}
            </li>
          ))}
        </ul>
        <div className="props-row">
          <button
            className="primary"
            disabled={!!errors.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const stored = await commit(q, editing);
                st().set({ question: stored, editing: { questionId: stored.questionId!, version: stored.version } });
                st().showToast(`Committed ${stored.questionId} v${stored.version} to the Question Bank.`);
              } catch (e) {
                st().showToast(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {editing ? `Commit as ${editing.questionId} v${editing.version + 1}` : 'Commit to Question Bank'}
          </button>
          {editing && (
            <button className="seg" onClick={() => st().set({ editing: null, question: { ...q, questionId: null, version: 1 } })}>
              Save as a new question instead
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function refreshSafe(q: Question): Question {
  try {
    return refreshDerived(q);
  } catch {
    return q;
  }
}

const swap = <T,>(xs: T[], i: number, j: number) => {
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** Manual override of one option (CUBE §27): faces, turns, mirroring, distractor rule. */
function OptionEditor({ q, index, onChange }: { q: Question; index: number; onChange: (q: Question) => void }) {
  const o = q.options[index];
  const set = (figure: Question['options'][number]['figure']) =>
    onChange(refreshSafe({ ...q, options: q.options.map((x, j) => (j === index ? { ...x, figure, edited: true } : x)) }));
  const rows = o.figure.kind === 'cube' ? o.figure.view.map((s, i) => ({ label: ['Top', 'Front', 'Right'][i], ...s, mirrored: s.mirrored })) : o.figure.cells.map((c) => ({ label: `Cell ${c.col},${c.row}`, face: c.face, turns: c.turns, mirrored: !!c.mirrored }));
  const change = (i: number, patch: { face?: FaceId; turns?: Turns; mirrored?: boolean }) => {
    if (o.figure.kind === 'cube') set({ kind: 'cube', view: o.figure.view.map((s, j) => (j === i ? { ...s, ...patch } : s)) as typeof o.figure.view });
    else set({ kind: 'net', cells: o.figure.cells.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };
  return (
    <section className="option-editor">
      <h3>Edit option ({index + 1})</h3>
      {rows.map((r, i) => (
        <div key={i} className="props-row">
          <span className="muted">{r.label}</span>
          <select value={r.face} onChange={(e) => change(i, { face: e.target.value as FaceId })}>
            {FACE_IDS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
          <button className="seg" aria-label="Turn" onClick={() => change(i, { turns: turn(r.turns) })}>
            <RotateCw size={16} /> {r.turns * 90}°
          </button>
          <button className={r.mirrored ? 'seg active' : 'seg'} aria-label="Mirror" onClick={() => change(i, { mirrored: !r.mirrored })}>
            <FlipHorizontal2 size={16} />
          </button>
        </div>
      ))}
      {!o.correct && (
        <div className="props-row wrap">
          <span className="muted">Distractor type</span>
          {DISTRACTOR_CHOICES[q.presentation.type].map((c) => (
            <button key={c} className={o.distractor?.code === c ? 'chip-sm active' : 'chip-sm'} onClick={() => onChange(regenerateOption(q, index, c, seed()))}>
              {c}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
