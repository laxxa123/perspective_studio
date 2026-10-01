// Question Bank → Cube (CUBE §37, §38, §47; v1.2): search, filter, ten
// questions a page; a question opens its details right under it — preview,
// edit (as a new version), duplicate, variant, metadata, versions, export.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, FileJson, Pencil, Shuffle } from 'lucide-react';
import { DIFFICULTY_DIMENSIONS, type Question } from '../model/QuestionModel';
import type { QuestionSummary } from '../database/QuestionRepository';
import { assetsFor, initStorage, listBank, questions, variantOf } from '../services/CubeService';
import { questionSheetSvg } from '../render/Svg';
import { svgToPng, svgSize, svgUrl } from '../render/rasterize';
import { useCubeStore } from '../state/useCubeStore';
import { shareFile } from '../../../platform/files';

const fail = (e: unknown) => useCubeStore.getState().showToast(e instanceof Error ? e.message : String(e));
const DATE = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const PAGE = 10;

export function QuestionBank() {
  const [list, setList] = useState<QuestionSummary[] | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState<'all' | 'net_to_cube' | 'cube_to_net'>('all');
  const [skill, setSkill] = useState<string>('any');
  const [minLevel, setMinLevel] = useState(1);
  const [distractor, setDistractor] = useState('any');
  const [patternOnly, setPatternOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ q: Question; assets: Record<string, string>; versions: { version: number; createdAt: string }[] } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [page, setPage] = useState(0);
  const st = useCubeStore.getState;

  const refresh = useCallback(() => listBank().then(setList, fail), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!openId) return;
    let live = true;
    (async () => {
      await initStorage();
      const q = await questions.get(openId, version ?? undefined);
      if (!q || !live) return;
      setDetail({ q, assets: await assetsFor(q.spatialModel), versions: await questions.versions(openId) });
    })().catch(fail);
    return () => {
      live = false;
    };
  }, [openId, version]);

  const distractorTypes = useMemo(() => [...new Set((list ?? []).flatMap((s) => s.distractors))].sort(), [list]);
  const shown = (list ?? [])
    .filter((s) => type === 'all' || s.type === type)
    .filter((s) => !text || `${s.id} ${s.title}`.toLowerCase().includes(text.toLowerCase()))
    .filter((s) => skill === 'any' || (s.difficulty as Record<string, number>)[skill] >= minLevel)
    .filter((s) => distractor === 'any' || s.distractors.includes(distractor))
    .filter((s) => !patternOnly || s.patterns > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * PAGE, current * PAGE + PAGE);
  const toggle = (id: string) => {
    setShowJson(false);
    setVersion(null);
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
    } else {
      setDetail(null);
      setOpenId(id);
    }
  };

  const edit = (q: Question, assets: Record<string, string>) => {
    st().load(q.spatialModel);
    st().set({ question: q, editing: { questionId: q.questionId!, version: q.version }, assets: { ...st().assets, ...assets }, page: 'studio', step: 'question' });
  };

  const exportJson = (q: Question) => shareFile(`${q.questionId}-v${q.version}.json`, new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' })).catch(fail);
  const exportPng = async (q: Question, assets: Record<string, string>) => {
    try {
      const svg = questionSheetSvg(q, assets);
      const { w, h } = svgSize(svg);
      await shareFile(`${q.questionId}-v${q.version}.png`, await svgToPng(svg, w, h));
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="bank">
      <div className="bank-filters">
        <input type="search" placeholder="Search id or title" value={text} onChange={(e) => setText(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="Question type">
          <option value="all">All types</option>
          <option value="net_to_cube">Net → Cube</option>
          <option value="cube_to_net">Cube → Net</option>
        </select>
        <select value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Skill">
          <option value="any">Any skill</option>
          {DIFFICULTY_DIMENSIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {skill !== 'any' && (
          <select value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))} aria-label="Minimum level">
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                ≥ {l}
              </option>
            ))}
          </select>
        )}
        <select value={distractor} onChange={(e) => setDistractor(e.target.value)} aria-label="Distractor type">
          <option value="any">Any distractor</option>
          {distractorTypes.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={patternOnly} onChange={(e) => setPatternOnly(e.target.checked)} /> Patterns
        </label>
      </div>

      {list && !list.length && <p className="muted empty">No questions yet. Build one in the Studio and commit it.</p>}
      <ul className="bank-list">
        {visible.map((s) => (
          <li key={s.id}>
            <button className={openId === s.id ? 'bank-item active' : 'bank-item'} aria-expanded={openId === s.id} onClick={() => toggle(s.id)}>
              <strong>{s.id}</strong>
              <span>{s.title || (s.type === 'net_to_cube' ? 'Net → Cube' : 'Cube → Net')}</span>
              <span className="muted small">
                v{s.version} · {DATE(s.updatedAt)}
              </span>
            </button>
            {openId === s.id && detail && detail.q.questionId === s.id && (
              <section className="bank-detail">
                  <header className="props-row">
                    <strong>
                      {detail.q.questionId} · v{detail.q.version}
                    </strong>
                    <button className="seg" onClick={() => edit(detail.q, detail.assets)}>
                      <Pencil size={16} /> Edit
                    </button>
                    <button className="seg" onClick={async () => {
                      try {
                        const c = await questions.duplicate(detail.q.questionId!);
                        await refresh();
                        setPage(0);
                setOpenId(c.questionId);
                        st().showToast(`Duplicated as ${c.questionId}.`);
                      } catch (e) {
                        fail(e);
                      }
                    }}>
                      <Copy size={16} /> Duplicate
                    </button>
                    <button className="seg" onClick={async () => {
                      try {
                        const v = await variantOf(detail.q, Math.floor(Math.random() * 1e9));
                        st().load(v.spatialModel);
                        st().set({ question: v, editing: null, assets: { ...st().assets, ...detail.assets }, page: 'studio', step: 'question' });
                        st().showToast('Variant ready in the Studio — review and commit.');
                      } catch (e) {
                        fail(e);
                      }
                    }}>
                      <Shuffle size={16} /> Variant
                    </button>
                    <button className="seg" onClick={() => exportPng(detail.q, detail.assets)}>
                      <Download size={16} /> PNG
                    </button>
                    <button className="seg" onClick={() => exportJson(detail.q)}>
                      <FileJson size={16} /> JSON
                    </button>
                  </header>
                  <img className="sheet" src={svgUrl(questionSheetSvg(detail.q, detail.assets))} alt="Question preview" />
                  <p className="muted small">
                    Answer: option {detail.q.answer.correctOption} · {detail.q.dna.distractors.join(', ')}
                  </p>
                  <div className="props-row wrap">
                    <span className="muted">Versions</span>
                    {detail.versions.map((v) => (
                      <button key={v.version} className={detail.q.version === v.version ? 'chip-sm active' : 'chip-sm'} title={DATE(v.createdAt)} onClick={() => setVersion(v.version)}>
                        v{v.version}
                      </button>
                    ))}
                  </div>
                  <button className="seg" onClick={() => setShowJson(!showJson)}>
                    {showJson ? 'Hide' : 'Show'} metadata
                  </button>
                  {showJson && <pre className="json">{JSON.stringify({ difficulty: detail.q.difficulty, dna: detail.q.dna, rules: detail.q.rules, answer: detail.q.answer, explanation: detail.q.explanation }, null, 2)}</pre>}
                </section>
            )}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav className="bank-pager" aria-label="Pages">
          <button className="seg" disabled={current === 0} onClick={() => (setPage(current - 1), setOpenId(null))} aria-label="Previous 10">
            <ChevronLeft size={16} />
          </button>
          <span className="muted small">
            {current * PAGE + 1}–{Math.min(shown.length, current * PAGE + PAGE)} of {shown.length}
          </span>
          <button className="seg" disabled={current >= pages - 1} onClick={() => (setPage(current + 1), setOpenId(null))} aria-label="Next 10">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
