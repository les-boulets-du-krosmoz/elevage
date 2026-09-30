import { useEffect, useState } from 'react';
import { uid } from '../domain/stock';

const BEAT = 'etable-tabs';

/** Détecte si le site est ouvert dans un autre onglet du même navigateur (battement toutes les 2 s). */
export function useOtherTab(): boolean {
  const [other, setOther] = useState(false);
  useEffect(() => {
    const id = uid();
    const read = (): Record<string, number> => {
      try { return JSON.parse(localStorage.getItem(BEAT) ?? '{}'); } catch { return {}; }
    };
    const beat = () => {
      try {
        const b = read();
        const now = Date.now();
        b[id] = now;
        for (const k in b) if (now - b[k] > 6000) delete b[k];
        localStorage.setItem(BEAT, JSON.stringify(b));
        setOther(Object.keys(b).some((k) => k !== id));
      } catch { /* cache indisponible */ }
    };
    const drop = () => {
      try { const b = read(); delete b[id]; localStorage.setItem(BEAT, JSON.stringify(b)); } catch { /* rien */ }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === BEAT) beat(); };
    beat();
    const iv = window.setInterval(beat, 2000);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pagehide', drop);
    return () => { window.clearInterval(iv); window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', drop); drop(); };
  }, []);
  return other;
}
