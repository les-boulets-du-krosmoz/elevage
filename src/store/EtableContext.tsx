import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Dragodinde, EtableState, HistoryEntry, JournalEntry, Settings, ActionType } from '../domain/types';
import { uid } from '../domain/stock';
import { KEYS, load, save } from './storage';
import { useToast } from './ToastContext';

interface ActOptions { add?: Dragodinde[]; del?: Dragodinde[]; journal?: Omit<JournalEntry, 't'> | null }

interface EtableApi extends EtableState {
  /** Applique une action (ajouts/retraits), l'inscrit à l'historique et propose Annuler. */
  act: (type: ActionType, label: string, opts?: ActOptions) => void;
  undo: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Remplace ou fusionne des données importées. */
  importData: (data: Partial<EtableState>, mode: 'fusion' | 'remplacement') => void;
}

const Ctx = createContext<EtableApi | null>(null);
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

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
    const s = ref.current;
    const h = s.history.find((x) => x.id === id);
    if (!h || h.undone) return;
    const present = new Set(s.dd.map((d) => d.id));
    const addedIds = new Set(h.added.map((d) => d.id));
    const gone = h.added.filter((d) => !present.has(d.id)).length;
    const dd = [...s.dd.filter((d) => !addedIds.has(d.id)), ...h.removed.filter((d) => !present.has(d.id))];
    const journal = h.jt ? s.settings.journal.filter((j) => j.t !== h.jt) : s.settings.journal;
    const history = s.history.map((x) => (x.id === id ? { ...x, undone: true, undoneAt: Date.now() } : x));
    setState({ dd, history, settings: { ...s.settings, journal } });
    toast.show(`Annulé : ${h.label}${gone ? ` (${gone} DD déjà utilisée${gone > 1 ? 's' : ''} depuis, non retirée${gone > 1 ? 's' : ''})` : ''}`);
  }, [toast]);

  const act = useCallback<EtableApi['act']>((type, label, { add = [], del = [], journal = null } = {}) => {
    const s = ref.current;
    const t = Date.now();
    const delIds = new Set(del.map((d) => d.id));
    const entry: HistoryEntry = { id: 'h' + uid(), t, type, label, added: clone(add), removed: clone(del), jt: journal ? t : null, undone: false };
    setState({
      dd: [...s.dd.filter((d) => !delIds.has(d.id)), ...add],
      history: [...s.history, entry],
      settings: journal ? { ...s.settings, journal: [...s.settings.journal, { ...journal, t }] } : s.settings,
    });
    toast.show(label, () => undo(entry.id));
  }, [toast, undo]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const importData = useCallback<EtableApi['importData']>((data, mode) => {
    const s = ref.current;
    const incoming = data.dd ?? [];
    if (mode === 'remplacement') {
      // Reste annulable : l'action retire l'ancien stock et ajoute le nouveau
      const entry: HistoryEntry = { id: 'h' + uid(), t: Date.now(), type: 'import', label: `${incoming.length} DD importées (remplacement)`, added: clone(incoming), removed: clone(s.dd), jt: null, undone: false };
      setState({ dd: incoming, history: [...(data.history ?? s.history), entry], settings: data.settings ?? s.settings });
      toast.show(entry.label, () => undo(entry.id));
      return;
    }
    const known = new Set(s.dd.map((d) => d.id));
    const fresh = incoming.filter((d) => !known.has(d.id));
    act('import', `${fresh.length} DD importées${incoming.length > fresh.length ? ` (${incoming.length - fresh.length} déjà présentes ignorées)` : ''}`, { add: fresh });
  }, [act, toast, undo]);

  const api = useMemo<EtableApi>(() => ({ ...state, act, undo, updateSettings, importData }), [state, act, undo, updateSettings, importData]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useEtable() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEtable hors de EtableProvider');
  return v;
}
