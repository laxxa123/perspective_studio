import { useEffect } from 'react';
import { useDocumentStore } from './state/documentStore';
import { useUiStore } from './state/uiStore';
import { Editor } from './ui/Editor';
import { Gallery } from './ui/Gallery';
import { SuiteHome } from './suite/SuiteHome';
import { SettingsScreen } from './ui/SettingsScreen';
import { onBackButton } from './platform/lifecycle';
import { closeDocument } from './ui/session';
import { restoreSettings } from './ui/settingsPersistence';
import { useTheme } from './ui/useTheme';

restoreSettings();

export function App() {
  const theme = useTheme();
  const screen = useUiStore((s) => s.screen);
  const hasDoc = useDocumentStore((s) => s.doc !== null);
  const toast = useUiStore((s) => s.toast);

  // Android back button: panels → editor → gallery → suite home (saving on the way).
  useEffect(
    () =>
      onBackButton(() => {
        const ui = useUiStore.getState();
        if (ui.contextMenu || ui.panel !== 'none') {
          ui.set({ contextMenu: null, panel: 'none' });
          return true;
        }
        if (ui.screen === 'editor') {
          void closeDocument();
          return true;
        }
        if (ui.screen === 'settings') {
          ui.set({ screen: ui.back });
          return true;
        }
        if (ui.screen === 'gallery') {
          ui.set({ screen: 'home' });
          return true;
        }
        return false;
      }),
    [],
  );

  if (screen === 'editor' && hasDoc) return <Editor theme={theme} />;
  return (
    <>
      {screen === 'settings' ? <SettingsScreen /> : screen === 'home' ? <SuiteHome /> : <Gallery />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
