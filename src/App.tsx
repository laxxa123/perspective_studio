import { useEffect, useState } from 'react';
import { PerspectiveCanvas } from './canvas/PerspectiveCanvas';
import { defaultSetup } from './model/scene';

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function App() {
  const { w, h } = useWindowSize();
  const [setup, setSetup] = useState(() => defaultSetup(w, h));

  return (
    <div className="app">
      <header className="toolbar">
        <strong>PERSPECTIVE STUDIO</strong>
        <span className="version">{__APP_VERSION__}</span>
        <button onClick={() => setSetup(defaultSetup(w, h))}>Reset</button>
      </header>
      <PerspectiveCanvas width={w} height={h} setup={setup} onChange={setSetup} />
    </div>
  );
}
