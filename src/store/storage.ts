import { sanitize } from '../domain/stock';
import type { EtableState, HistoryEntry, Settings } from '../domain/types';

/**
 * Stockage dans le cache du navigateur (localStorage).
 * Isolé ici pour pouvoir brancher un autre stockage plus tard sans toucher au reste.
 */
export const KEYS = { dd: 'etable-dd-v1', history: 'etable-dd-v1-hist', settings: 'etable-dd-v1-set' } as const;

export const defaultSettings = (): Settings => ({ places: 0, target: 'Ebène et Indigo', journal: [] });

const read = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function normalizeSettings(x: Partial<Settings> | null | undefined): Settings {
  return { ...defaultSettings(), ...(x ?? {}), journal: Array.isArray(x?.journal) ? x!.journal : [] };
}

export function load(): EtableState {
  return {
    dd: read<unknown[]>(KEYS.dd, []).map(sanitize).filter((d) => d !== null),
    history: read<HistoryEntry[]>(KEYS.history, []),
    settings: normalizeSettings(read<Partial<Settings>>(KEYS.settings, {})),
  };
}

/** Renvoie false si le cache est plein ou indisponible. */
export function save(s: EtableState): boolean {
  try {
    localStorage.setItem(KEYS.dd, JSON.stringify(s.dd));
    localStorage.setItem(KEYS.history, JSON.stringify(s.history));
    localStorage.setItem(KEYS.settings, JSON.stringify(s.settings));
    return true;
  } catch {
    return false;
  }
}

/** Sauvegarde complète : DD, historique et réglages. */
export const toBackup = (s: EtableState) => JSON.stringify({ format: 'etable-dd', version: 1, ...s }, null, 1);

/** Accepte une sauvegarde complète ou un ancien export (tableau de DD). */
export function parseBackup(text: string): Partial<EtableState> {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) return { dd: data.map(sanitize).filter((d) => d !== null) };
  if (data && typeof data === 'object' && Array.isArray((data as EtableState).dd)) {
    const o = data as EtableState;
    return {
      dd: o.dd.map(sanitize).filter((d) => d !== null),
      history: Array.isArray(o.history) ? o.history : undefined,
      settings: o.settings ? normalizeSettings(o.settings) : undefined,
    };
  }
  throw new Error('format inconnu');
}
