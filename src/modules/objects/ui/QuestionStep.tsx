// Studio · 2 · Question (OBJECTS §15, §31, §A.5): choose what the question
// tests, its settings, then review the five options — the engine computes
// the correct one and builds intentional wrong ones; the author can reorder,
// regenerate or edit any of them, change the wording and the difficulty,
// preview, and commit.
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, Pencil, RefreshCw, Shuffle } from 'lucide-react';
import { FAMILIES, moveOption, regenerateOption, replaceOption, RULES, stemItems, validate, type Item } from '../core/questions';
import { newSeed } from '../core/random';
import { commit } from '../services/service';
import { useObjects } from '../state/store';
import { Drawing } from './Drawing';
import { OptionEditor } from './OptionEditor';
import { Params } from './Params';
import { Preview } from './Preview';

const st = useObjects.getState;

export function QuestionStep() {
  const kind = useObjects((s) => s.kind);
  const family = useObjects((s) => s.family);
  const q = useObjects((s) => s.question);
  const editing = useObjects((s) => s.editing);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  // Arriving with no question (or one for another object): make one.
  useEffect(() => {
    const s = st();
    const src = JSON.stringify([s.blocks, s.marked, s.figure, s.fold]);
    const qsrc = s.question && JSON.stringify([s.question.source.blocks, s.question.source.marked, s.question.source.figure, s.question.source.fold]);
    if (!s.question || s.question.family !== s.family || qsrc !== src) s.generate();
  }, []);

  const families = FAMILIES.filter((f) => f.kind === kind);
  const check = useMemo(() => (q ? validate(q) : { ready: false, issues: [] as string[] }), [q]);
  const stem = useMemo(() => (q ? stemItems(q.family, q.source, q.params) : []), [q]);

  const pick = (id: (typeof FAMILIES)[number]['id']) => {
    const s = st();
    // Sensible settings for the type.
    const ops = id === 'f-reflect' ? ['fv'] : id === 'f-steps' ? ['r90', 'fv'] : ['r90'];
    s.set({ family: id, params: { ...s.params, ops: ops as typeof s.params.ops, layer: 0 } });
    s.generate();
  };

  const doCommit = async (asNew: boolean) => {
    if (!q || !check.ready) return;
    setBusy(true);
    try {
      const saved = await commit(q, asNew ? null : (editing?.id ?? null));
      st().set({ question: saved, editing: { id: saved.questionId!, version: saved.version } });
      st().showToast(`${saved.questionId} · v${saved.version} saved to the Question Bank`);
    } catch (e) {
      st().showToast(`Not saved: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ob-question">
      <div className="ob-chips" role="radiogroup" aria-label="Question type">
        {families.map((f) => (
          <button key={f.id} role="radio" aria-checked={f.id === family} className={f.id === family ? 'on' : ''} onClick={() => pick(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <Params family={family} />

      {q && (
        <>
          <textarea className="ob-stem" aria-label="Question" rows={2} value={q.stem} onChange={(e) => st().setQuestion({ ...q, stem: e.target.value })} />
          <div className="ob-stemfig" aria-label="Question figure">
            {stem.map((it, i) => (
              <figure key={i}>
                <Drawing item={it} size={it.kind === 'folds' ? 84 : it.kind === 'grid' ? 96 : 150} label="Question figure" />
                {it.kind === 'grid' && it.label && <figcaption>{it.label}</figcaption>}
              </figure>
            ))}
          </div>
          <div className="ob-options">
            {q.options.map((o, i) => (
              <div key={i} className={`ob-option${i === q.correct ? ' right' : ''}`}>
                <span className="ob-num">
                  {i + 1}
                  {i === q.correct ? ' ✓' : ''}
                </span>
                <Drawing item={o.item} size={92} label={`Option ${i + 1}`} />
                <span className="ob-rule" title={o.note}>
                  {o.rule === 'correct' ? 'Correct' : `${RULES[o.rule] ?? o.rule}`}
                </span>
                <div className="ob-opt-actions">
                  <button aria-label={`Move option ${i + 1} up`} disabled={i === 0} onClick={() => st().setQuestion(moveOption(q, i, i - 1))}>
                    <ArrowUp size={14} />
                  </button>
                  <button aria-label={`Move option ${i + 1} down`} disabled={i === q.options.length - 1} onClick={() => st().setQuestion(moveOption(q, i, i + 1))}>
                    <ArrowDown size={14} />
                  </button>
                  <button aria-label={`New wrong option ${i + 1}`} disabled={i === q.correct} onClick={() => st().setQuestion(regenerateOption(q, i, newSeed()))}>
                    <RefreshCw size={14} />
                  </button>
                  <button aria-label={`Edit option ${i + 1}`} disabled={o.item.kind === 'pair'} onClick={() => setEditIndex(i)}>
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="ob-param">
            <span>Difficulty</span>
            <div className="ob-seg" role="radiogroup" aria-label="Difficulty">
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} role="radio" aria-checked={q.profile.difficulty === d} className={q.profile.difficulty === d ? 'on' : ''} onClick={() => st().setQuestion({ ...q, profile: { ...q.profile, difficulty: d, difficultySet: true } })}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className={`ob-check ${check.ready ? 'ok' : 'bad'}`} role="status">
            {check.ready ? '✓ Ready to commit' : '⚠ Question needs attention'}
            {check.issues.map((t) => (
              <div key={t}>· {t}</div>
            ))}
          </div>
          <div className="ob-actions">
            <button onClick={() => st().generate(true)} aria-label="New wrong options">
              <Shuffle size={16} /> New options
            </button>
            <button onClick={() => setPreview(true)} disabled={!q.options.length}>
              <Eye size={16} /> Preview
            </button>
            <button className="ob-primary" disabled={!check.ready || busy} onClick={() => void doCommit(false)}>
              {editing ? `Commit v${editing.version + 1}` : 'Commit'}
            </button>
            {editing && (
              <button disabled={!check.ready || busy} onClick={() => void doCommit(true)}>
                Save as new question
              </button>
            )}
          </div>
        </>
      )}
      {q && editIndex !== null && (
        <OptionEditor
          item={q.options[editIndex].item}
          onCancel={() => setEditIndex(null)}
          onDone={(it: Item) => {
            st().setQuestion(replaceOption(q, editIndex, it));
            setEditIndex(null);
          }}
        />
      )}
      {q && preview && <Preview q={q} onClose={() => setPreview(false)} />}
    </div>
  );
}
