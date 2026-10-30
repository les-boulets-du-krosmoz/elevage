import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActionType, BreakSession, EtableState, Settings } from '../domain/types';
import { applyQueue, KEYS, load, save } from './storage';
import { addBreakTo, applyAct, applyImport, applyUndo, removeBreakFrom, undoMessage, type ActOptions } from './transitions';
import { useToast } from './ToastContext';
import { uid } from '../domain/stock';

interface EtableApi extends EtableState {
  /** Applique une action (ajouts/retraits), l'inscrit à l'historique et propose Annuler. */
  act: (type: ActionType, label: string, opts?: ActOptions) => void;
  undo: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Remplace ou fusionne des données importées. */
  importData: (data: Partial<EtableState>, mode: 'fusion' | 'remplacement') => void;
  /** Enregistre une session ; si fromQueue, les montures brisées sortent de la file « à briser ». */
  addBreak: (b: Omit<BreakSession, 'id' | 'created'>, fromQueue?: boolean) => void;
  removeBreak: (id: string) => void;
}

const Ctx = createContext<EtableApi | null>(null);

export function EtableProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<EtableState>(load);
  const ref = useRef(state);
  ref.current = state;

  // Sauvegarde groupée (une écriture par pause), forcée à la fermeture de la page
  const timer = useRef<number>();
  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!save(ref.current)) toast.show('Cache plein ou indisponible : exporte tes données');
    }, 200);
  }, [state, toast]);
  useEffect(() => {
    const flush = () => save(ref.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // Un autre onglet a modifié le cache : on recharge pour rester aligné
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if ((Object.values(KEYS) as string[]).includes(e.key ?? '')) setState(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const undo = useCallback((id: string) => {
    const r = applyUndo(ref.current, id);
    if (!r.ok) {
      if (r.reason === 'trop-ancienne') toast.show('Action trop ancienne : elle n’est plus annulable');
      return;
    }
    setState(r.state);
    toast.show(undoMessage(r));
  }, [toast]);

  const act = useCallback<EtableApi['act']>((type, label, opts) => {
    // Mise à jour fonctionnelle : l'action se compose avec les autres changements en attente au lieu de les écraser
    const id = 'h' + uid();
    const now = Date.now();
    setState((prev) => applyAct(prev, type, label, opts, now, id).state);
    toast.show(label, () => undo(id));
  }, [toast, undo]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const importData = useCallback<EtableApi['importData']>((data, mode) => {
    const { state: next, entry, label } = applyImport(ref.current, data, mode);
    if (entry) setState(next);
    toast.show(label, entry ? () => undo(entry.id) : undefined);
  }, [toast, undo]);

  // Brisage : ajout et suppression de sessions, annulables depuis la notification
  const addBreak = useCallback<EtableApi['addBreak']>((b, fromQueue = false) => {
    const { state: next, session, consumed } = addBreakTo(ref.current, b, fromQueue);
    setState(next);
    toast.show(`Brisage noté : ${b.mounts} ${b.species}${b.mounts > 1 ? 's' : ''}`, () => setState((s) => ({
      ...removeBreakFrom(s, session.id),
      queue: applyQueue(s.queue, consumed.map((d) => ({ ...d, delta: -d.delta }))),
    })));
  }, [toast]);
  const removeBreak = useCallback((id: string) => {
    const b = ref.current.breaks.find((x) => x.id === id);
    if (!b) return;
    setState((s) => removeBreakFrom(s, id));
    toast.show(`Session du ${b.date} supprimée`, () => setState((s) => ({ ...s, breaks: [...s.breaks, b] })));
  }, [toast]);

  const api = useMemo<EtableApi>(() => ({ ...state, act, undo, updateSettings, importData, addBreak, removeBreak }),
    [state, act, undo, updateSettings, importData, addBreak, removeBreak]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useEtable() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEtable hors de EtableProvider');
  return v;
}
