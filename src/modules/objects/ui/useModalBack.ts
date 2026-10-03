// While a dialog is open, Android back closes it (OBJECTS §84: back behaves predictably).
import { useEffect } from 'react';
import { objectsModal } from '../index';

export function useModalBack(close: () => void) {
  useEffect(() => {
    objectsModal.current = close;
    return () => {
      if (objectsModal.current === close) objectsModal.current = null;
    };
  }, [close]);
}
