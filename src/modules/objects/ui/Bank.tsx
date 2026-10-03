// Question Bank (OBJECTS §46, §47): every committed question, newest first;
// search, filters, a compact card each; tap for the sheet, the metadata and
// the versions; Edit (commits a new version), Duplicate, Variant, Export.
import { questionRef } from '../../../shared/ids/questionId';
import { useEffect, useMemo, useState } from 'react';
import { Copy, Pencil, Search, Sparkles } from 'lucide-react';
import { FAMILIES, RULES, type Family, type Kind, type Question } from '../core/questions';
import { questionSheet } from '../core/sheet';
import { filterSummaries, type QuestionSummary } from '../database/repository';
import { exportQuestion, storage, svgUrl } from '../services/service';
import { openInStudio, useObjects } from '../state/store';

const st = useObjects.getState;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function Bank() {
  const [list, setList] = useState<QuestionSummary[] | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void storage()
      .then((s) => s.questions.list())
      .then((l) => alive && setList([...l].reverse()))
      .catch((e) => st().showToast(`Storage: ${e instanceof Error ? e.message : String(e)}`));
    return () => {
      alive = false;
    };
  }, [tick]);

  const shown = useMemo(() => filterSummaries(list ?? [], { text, kind, family }), [list, text, kind, family]);
  if (!list) return <p className="muted ob-pad">Loading…</p>;

  return (
    <div className="ob-bank">
      <label className="ob-search">
        <Search size={16} />
        <input type="search" placeholder="Search id, type or wording" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search questions" />
      </label>
      <div className="ob-chips">
        {(
          [
            [null, 'All'],
            ['blocks', '3D'],
            ['figure', '2D'],
          ] as [Kind | null, string][]
        ).map(([k, l]) => (
          <button key={l} className={kind === k ? 'on' : ''} onClick={() => (setKind(k), setFamily(null))}>
            {l}
          </button>
        ))}
        <span className="ob-sep" />
        {FAMILIES.filter((f) => !kind || f.kind === kind).map((f) => (
          <button key={f.id} className={family === f.id ? 'on' : ''} onClick={() => setFamily(family === f.id ? null : f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {!list.length && <p className="muted ob-pad">No questions yet. Build an object in Studio and commit a question.</p>}
      {list.length > 0 && !shown.length && <p className="muted ob-pad">No question matches.</p>}
      <ul className="ob-list">
        {shown.map((s) => (
          <li key={s.id}>
            <button className={`ob-row${open === s.id ? ' on' : ''}`} onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
              <b>{questionRef(s.id, s.version)}</b>
              <span>
                {s.kind === 'blocks' ? '3D' : '2D'} · {s.label}
              </span>
              <span className="muted">
                {date(s.updatedAt)}
              </span>
            </button>
            {open === s.id && <Detail summary={s} onChanged={() => setTick((t) => t + 1)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ summary, onChanged }: { summary: QuestionSummary; onChanged: () => void }) {
  const [versions, setVersions] = useState<{ version: number; createdAt: string }[]>([]);
  const [version, setVersion] = useState(summary.version);
  const [q, setQ] = useState<Question | null>(null);

  useEffect(() => {
    let alive = true;
    void storage().then(async ({ questions }) => {
      const [vs, got] = await Promise.all([questions.versions(summary.id), questions.get(summary.id, version)]);
      if (alive) {
        setVersions(vs);
        setQ(got);
      }
    });
    return () => {
      alive = false;
    };
  }, [summary.id, version]);

  if (!q) return <p className="muted ob-pad">Loading…</p>;
  const latest = version === summary.version;
  const duplicate = async () => {
    const d = await (await storage()).questions.duplicate(summary.id);
    st().showToast(`Duplicated as ${questionRef(d.questionId!, d.version)}`);
    onChanged();
  };
  return (
    <div className="ob-detail">
      <img className="ob-sheet" src={svgUrl(questionSheet(q, { author: true }))} alt={questionRef(summary.id, version)} />
      <dl className="ob-meta">
        <dt>Difficulty</dt>
        <dd>{q.profile.difficulty} / 5</dd>
        <dt>Size</dt>
        <dd>{q.profile.size}</dd>
        <dt>Hidden</dt>
        <dd>{q.profile.hidden}</dd>
        <dt>Steps</dt>
        <dd>{q.profile.steps}</dd>
        <dt>Wrong answers</dt>
        <dd>{[...new Set(q.options.filter((o) => o.rule !== 'correct').map((o) => RULES[o.rule] ?? o.rule))].join(', ')}</dd>
        <dt>Created</dt>
        <dd>{date(q.createdAt)}</dd>
      </dl>
      <div className="ob-chips" aria-label="Versions">
        {versions.map((v) => (
          <button key={v.version} className={v.version === version ? 'on' : ''} onClick={() => setVersion(v.version)}>
            .{v.version} · {date(v.createdAt)}
          </button>
        ))}
      </div>
      <div className="ob-actions">
        <button onClick={() => openInStudio(q, 'edit')} disabled={!latest} title={latest ? '' : 'Edit the latest version'}>
          <Pencil size={15} /> Edit
        </button>
        <button onClick={() => void duplicate()}>
          <Copy size={15} /> Duplicate
        </button>
        <button onClick={() => openInStudio(q, 'variant')}>
          <Sparkles size={15} /> Variant
        </button>
        <button onClick={() => void exportQuestion(q, 'png', true)}>PNG</button>
        <button onClick={() => void exportQuestion(q, 'svg', true)}>SVG</button>
        <button onClick={() => void exportQuestion(q, 'json')}>JSON</button>
      </div>
    </div>
  );
}
