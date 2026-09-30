import { SpikeScreen } from './ui/spike/SpikeScreen';
import { useWindowSize } from './ui/useWindowSize';

// M0: the app is the foundation plus the device spike (REQUIREMENTS §16).
export function App() {
  const { w, h } = useWindowSize();
  return <SpikeScreen width={w} height={h} />;
}
