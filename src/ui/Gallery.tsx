// Gallery (§10.8, DOC-02): the Perspective module's first screen (back → suite home); scene thumbnails, new scene (2pt / 3pt), import,
// backup all; per scene: rename, duplicate, export, delete.
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, FileUp, MoreVertical, Plus, Settings as SettingsIcon, Archive } from 'lucide-react';
import { newId } from '../core/document/ids';
import { loadDocument } from '../core/document/schema';
import { DEFAULT_DISPLAY } from '../core/derive/display';
import { exportJson, exportPng, exportSvg, fileSafe, makeBackup, parseImport } from '../export/exporters';
import { pickTextFile, saveToDocuments, shareFile } from '../platform/files';
import * as storage from '../platform/storage';
import { useUiStore } from '../state/uiStore';
import { createDocument, loadPrefs, openDocument, storeDocuments } from './session';

interface Card extends storage.StoredSummary {
  thumb: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function Gallery() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const ui = useUiStore.getState;
  const fail = (e: unknown) => ui().showToast(e instanceof Error ? e.message : String(e));

  const refresh = useCallback(async () => {
    const list = await storage.listDocuments();
    const withThumbs = await Promise.all(
      list.map(async (d) => {
        const png = await storage.readThumbnail(d.id);
        return { ...d, thumb: png ? URL.createObjectURL(png) : null };
      }),
    );
    setCards((old) => {
      old?.forEach((c) => c.thumb && URL.revokeObjectURL(c.thumb));
      return withThumbs;
    });
  }, []);

  useEffect(() => {
    // Initial load of the list from IndexedDB.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh().catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const newScene = (mode: '3pt' | '2pt') =>
    createDocument(mode, `Scene ${(cards?.length ?? 0) + 1}`).catch(fail);

  const loadDoc = async (id: string) => {
    const raw = await storage.readDocument(id);
    if (!raw) throw new Error('Scene not found.');
    return loadDocument(raw).doc;
  };

  const act = async (id: string, action: string) => {
    setMenu(null);
    try {
      const doc = await loadDoc(id);
      const display = loadPrefs(id).display ?? DEFAULT_DISPLAY;
      if (action === 'rename') {
        const name = window.prompt('Scene name', doc.name)?.trim();
        if (!name) return;
        await storage.writeDocument(doc.id, name, doc.updatedAt, JSON.parse(exportJson({ ...doc, name })));
      } else if (action === 'duplicate') {
        const now = new Date().toISOString();
        await storeDocuments([{ ...doc, id: newId(), name: `${doc.name} copy`, createdAt: now, updatedAt: now }]);
      } else if (action === 'delete') {
        if (!window.confirm(`Delete “${doc.name}”? This cannot be undone.`)) return;
        await storage.deleteDocument(id);
      } else if (action === 'png') {
        await shareFile(`${fileSafe(doc.name)}.png`, await exportPng(doc, display, 2));
      } else if (action === 'svg') {
        await shareFile(`${fileSafe(doc.name)}.svg`, new Blob([exportSvg(doc, display)], { type: 'image/svg+xml' }));
      } else if (action === 'json') {
        await shareFile(`${fileSafe(doc.name)}.json`, new Blob([exportJson(doc)], { type: 'application/json' }));
      }
      await refresh();
    } catch (e) {
      fail(e);
    }
  };

  const importFile = async () => {
    try {
      const text = await pickTextFile('application/json,.json');
      if (text === null) return;
      const { docs, warnings } = parseImport(text);
      const n = await storeDocuments(docs);
      ui().showToast(`Imported ${n} scene${n === 1 ? '' : 's'}.${warnings.length ? ' ' + warnings.join(' ') : ''}`);
      await refresh();
    } catch (e) {
      fail(e);
    }
  };

  const backupAll = async () => {
    try {
      const docs = await storage.readAllDocuments();
      const stamp = new Date().toISOString().slice(0, 10);
      const where = await saveToDocuments(`perspective_studio_backup_${stamp}.json`, makeBackup(docs));
      ui().showToast(`Backed up ${docs.length} scene${docs.length === 1 ? '' : 's'} to ${where}.`);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="gallery" onClick={() => setMenu(null)}>
      <header className="gallery-head">
        <button className="icon" aria-label="Back to home" onClick={() => ui().set({ screen: 'home' })}>
          <ArrowLeft size={20} />
        </button>
        <h1>PERSPECTIVE</h1>
        <button className="icon" title="Import JSON" aria-label="Import" onClick={importFile}>
          <FileUp size={20} />
        </button>
        <button className="icon" title="Backup all" aria-label="Backup all" onClick={backupAll}>
          <Archive size={20} />
        </button>
        <button className="icon" title="Settings" aria-label="Settings" onClick={() => ui().set({ screen: 'settings', back: 'gallery' })}>
          <SettingsIcon size={20} />
        </button>
      </header>
      <div className="new-row">
        <button className="primary" onClick={() => newScene('3pt')}>
          <Plus size={18} /> New 3-point scene
        </button>
        <button onClick={() => newScene('2pt')}>
          <Plus size={18} /> 2-point
        </button>
      </div>
      {cards === null ? (
        <p className="muted">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="muted">No scenes yet. Start one above.</p>
      ) : (
        <ul className="cards">
          {cards.map((c) => (
            <li key={c.id} className="card">
              <button className="card-open" onClick={() => openDocument(c.id).catch(fail)}>
                {c.thumb ? <img src={c.thumb} alt="" /> : <div className="thumb-empty" />}
                <span className="card-name">{c.name}</span>
                <small className="muted">{when(c.updatedAt)}</small>
              </button>
              <button
                className="icon card-menu"
                aria-label={`More for ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenu(menu === c.id ? null : c.id);
                }}
              >
                <MoreVertical size={18} />
              </button>
              {menu === c.id && (
                <div className="menu" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => act(c.id, 'rename')}>Rename</button>
                  <button onClick={() => act(c.id, 'duplicate')}>Duplicate</button>
                  <button onClick={() => act(c.id, 'png')}>
                    <Download size={16} /> PNG
                  </button>
                  <button onClick={() => act(c.id, 'svg')}>
                    <Download size={16} /> SVG
                  </button>
                  <button onClick={() => act(c.id, 'json')}>
                    <Download size={16} /> JSON
                  </button>
                  <button className="danger" onClick={() => act(c.id, 'delete')}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
