// SETTINGS (PUBLISH §12): the WordPress site and login. The Application
// Password is kept encrypted by the phone (ADR-0011); Test signs in and
// checks the site's theme can show PUBLISH posts.
import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, LoaderCircle, TriangleAlert } from 'lucide-react';
import { usePublishStore } from '../state/usePublishStore';
import { isComplete, siteUrl, WpClient, type WpSettings } from '../wp/WpClient';
import { loadSettings, saveSettings } from './wpSession';

const st = usePublishStore.getState;

export function SettingsTab() {
  const [s, setS] = useState<WpSettings | null>(null);
  const [show, setShow] = useState(false);
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'warn' | 'error'; text?: string }>({ kind: 'idle' });

  useEffect(() => {
    void loadSettings().then(setS);
  }, []);
  if (!s) return null;

  const edit = (patch: Partial<WpSettings>) => {
    setS({ ...s, ...patch });
    setState({ kind: 'idle' });
  };

  const test = async () => {
    setState({ kind: 'testing' });
    try {
      await saveSettings(s);
      const wp = new WpClient(s);
      const me = await wp.me();
      const ready = await wp.themeReady();
      setState(ready ? { kind: 'ok', text: `Signed in as ${me.name}. Ready to publish.` } : { kind: 'warn', text: `Signed in as ${me.name}, but the site needs the latest studioview theme to show PUBLISH posts.` });
    } catch (e) {
      setState({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const forget = async () => {
    const next = { ...s, password: '' };
    setS(next);
    await saveSettings(next);
    setState({ kind: 'idle' });
    st().showToast('Password removed from this phone.');
  };

  return (
    <form
      className="pb-settings"
      onSubmit={(e) => {
        e.preventDefault();
        void test();
      }}
    >
      <h2>WordPress</h2>
      <label className="pb-field">
        <span>Site address</span>
        <input value={s.site} placeholder="example.com" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => edit({ site: e.target.value })} />
      </label>
      <label className="pb-field">
        <span>User name</span>
        <input value={s.user} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="username" onChange={(e) => edit({ user: e.target.value })} />
      </label>
      <label className="pb-field">
        <span>Application Password</span>
        <span className="pb-pass">
          <input type={show ? 'text' : 'password'} value={s.password} autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="current-password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" onChange={(e) => edit({ password: e.target.value })} />
          <button type="button" className="pb-icon sm" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      <p className="pb-hint">Make one on your site: Users → Profile → Application Passwords. It is stored encrypted on this phone only.</p>
      <button className="pb-publish" type="submit" disabled={!isComplete(s) || state.kind === 'testing'}>
        {state.kind === 'testing' ? <LoaderCircle size={18} className="spin" /> : null} Save and test
      </button>
      {state.text && (
        <p className={`pb-status ${state.kind}`} role="status">
          {state.kind === 'ok' ? <Check size={16} /> : <TriangleAlert size={16} />} {state.text}
        </p>
      )}
      {isComplete(s) && (
        <p className="pb-hint">
          Publishing to <b>{siteUrl(s.site)}</b>
        </p>
      )}
      {s.password && (
        <button type="button" className="pb-pill ghost danger" onClick={() => void forget()}>
          Remove password from this phone
        </button>
      )}
    </form>
  );
}
