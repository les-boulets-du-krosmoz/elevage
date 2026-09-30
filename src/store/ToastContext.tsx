import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface Toast { msg: string; undo?: () => void; key: number }
interface ToastApi { show: (msg: string, undo?: () => void) => void }

const Ctx = createContext<ToastApi | null>(null);

/** Notification en bas d'écran, avec un bouton Annuler optionnel (7 s). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, undo?: () => void) => {
    window.clearTimeout(timer.current);
    setToast({ msg, undo, key: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), undo ? 7000 : 2200);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className={`toast${toast ? ' on' : ''}`} role="status">
        {toast?.msg}
        {toast?.undo && (
          <button onClick={() => { window.clearTimeout(timer.current); setToast(null); toast.undo!(); }}>Annuler</button>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast hors de ToastProvider');
  return v;
}
