import { useEffect, useState } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { DARK, LIGHT, type Theme } from '../theme/theme';

/** The resolved theme (light / dark / system, §10.9); also sets data-theme on <html>. */
export function useTheme(): Theme {
  const pref = useSettingsStore((s) => s.theme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const theme = pref === 'dark' || (pref === 'system' && systemDark) ? DARK : LIGHT;
  useEffect(() => {
    document.documentElement.dataset.theme = theme.name;
  }, [theme]);
  return theme;
}
