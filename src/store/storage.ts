import { sanitize, uid } from '../domain/stock';
import { findColorIn, type Espece } from '../domain/colors';
import { runeOfficielle } from '../domain/brisage';
import { DESTINATIONS, REGLES_DEFAUT, type RegleParent } from '../domain/destinations';
import { lirePaire, type Paire, type RecettesPerso } from '../domain/recettes';
import { PALIER_DEFAUT, SERENITE_BORNE, SIMULATIONS_MAX, VITESSES_DEFAUT } from '../domain/temps';
import type { BreakQueue, BreakSession, Calculateur, EtableState, ExtractDelta, ExtractQueue, HistoryEntry, Palier, Settings, Simulation } from '../domain/types';

/**
 * Stockage dans le cache du navigateur (localStorage).
 * Isolé ici pour pouvoir brancher un autre stockage plus tard sans toucher au reste.
 */
export const KEYS = { dd: 'etable-dd-v1', history: 'etable-dd-v1-hist', settings: 'etable-dd-v1-set', breaks: 'etable-dd-v1-brisage', queue: 'etable-dd-v1-file', extract: 'etable-dd-v1-extraction' } as const;

export const ENCLOS_MAX = 6;
export const defaultSettings = (): Settings => ({ places: 20, nbEnclos: ENCLOS_MAX, sexItemPriceK: 10000, target: 'Ebène et Indigo', journal: [], vitesses: [...VITESSES_DEFAUT], calc: { palier: PALIER_DEFAUT, simulations: {} }, regles: REGLES_DEFAUT.map((r) => ({ ...r })), recettes: {}, cibles: {}, prix: { ressource: { muldo: 20000, volkorne: 20000 }, runes: {}, optimakina: {}, geneton: null }, chanceBase: 40 });

const read = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const ESPECES: Espece[] = ['dragodinde', 'volkorne', 'muldo'];
const DEST_IDS = new Set<string>(DESTINATIONS.map((d) => d.id));

/** Règles de destination valides (une liste vide reste vide : c'est un choix). */
export function sanitizeRegles(list: unknown[]): RegleParent[] {
  return list.flatMap((x): RegleParent[] => {
    const r = x as Partial<RegleParent>;
    if (!r || !DEST_IDS.has(String(r.destination))) return [];
    const espece = r.espece === '*' || ESPECES.includes(r.espece as Espece) ? r.espece! : '*';
    const type = r.type === 'mono' || r.type === 'bi' ? r.type : '*';
    const de = Math.max(1, Math.min(10, Math.round(Number(r.de) || 1)));
    const a = Math.max(de, Math.min(10, Math.round(Number(r.a) || 10)));
    return [{ id: String(r.id ?? uid()), espece, type, de, a, destination: r.destination! }];
  });
}

/** Recettes modifiées valides : couleurs connues de l'espèce, paires de deux couleurs différentes. */
export function sanitizeRecettes(x: unknown): RecettesPerso {
  const out: RecettesPerso = {};
  if (!x || typeof x !== 'object') return out;
  for (const e of ESPECES) {
    const src = (x as Record<string, unknown>)[e];
    if (!src || typeof src !== 'object') continue;
    for (const [c, list] of Object.entries(src)) {
      const col = findColorIn(e, c);
      if (!col || !Array.isArray(list)) continue;
      const paires = list.flatMap((p): Paire[] => {
        const q = Array.isArray(p) && p.length === 2 ? lirePaire(e, `${p[0]} + ${p[1]}`) : null;
        return q ? [q] : [];
      });
      (out[e] ??= {})[col.name] = paires;
    }
  }
  return out;
}

/** Cibles valides : monocolores connues de l'espèce. */
export function sanitizeCibles(x: unknown): Settings['cibles'] {
  const out: Settings['cibles'] = {};
  if (!x || typeof x !== 'object') return out;
  for (const e of ['muldo', 'volkorne'] as const) {
    const list = (x as Record<string, unknown>)[e];
    if (Array.isArray(list)) out[e] = [...new Set(list.map((c) => findColorIn(e, String(c))).filter((c) => c && c.parts.length === 1).map((c) => c!.name))];
  }
  return out;
}

/** Prix valides : nombres positifs, générations 1 à 10. */
export function sanitizePrix(x: unknown): Settings['prix'] {
  const d = defaultSettings().prix;
  if (!x || typeof x !== 'object') return d;
  const o = x as Partial<Settings['prix']>;
  const pos = (v: unknown) => (Number(v) > 0 ? Math.round(Number(v)) : null);
  const ressource: Settings['prix']['ressource'] = {};
  const optimakina: Settings['prix']['optimakina'] = {};
  for (const e of ESPECES) {
    const r = pos(o.ressource?.[e]);
    if (r) ressource[e] = r;
    const g = o.optimakina?.[e];
    if (g && typeof g === 'object') for (const [k, v] of Object.entries(g)) {
      const n = Number(k), p = pos(v);
      if (n >= 1 && n <= 10 && p) (optimakina[e] ??= {})[n] = p;
    }
  }
  const runes: Record<string, number> = {};
  if (o.runes && typeof o.runes === 'object') for (const [k, v] of Object.entries(o.runes)) {
    const p = pos(v);
    if (p) runes[runeOfficielle(k) ?? k] = p;
  }
  return { ressource: o.ressource ? ressource : d.ressource, runes, optimakina, geneton: pos(o.geneton) };
}

export const emptyExtract = (): ExtractQueue => ({ dragodinde: {}, volkorne: {}, muldo: {} });

/** File « À extraire » valide : couleurs connues, quantités positives. */
export function sanitizeExtract(x: unknown): ExtractQueue {
  const q = emptyExtract();
  if (!x || typeof x !== 'object') return q;
  for (const e of ESPECES) {
    const src = (x as Record<string, unknown>)[e];
    if (src && typeof src === 'object') for (const [c, n] of Object.entries(src)) {
      const col = findColorIn(e, c);
      if (col && Number(n) > 0) q[e][col.name] = Math.floor(Number(n));
    }
  }
  return q;
}

/** Applique des variations à la file « À extraire », sans descendre sous zéro. */
export function applyExtract(q: ExtractQueue, deltas: ExtractDelta[]): ExtractQueue {
  const out: ExtractQueue = { dragodinde: { ...q.dragodinde }, volkorne: { ...q.volkorne }, muldo: { ...q.muldo } };
  for (const d of deltas) {
    const n = Math.max(0, (out[d.espece][d.couleur] ?? 0) + d.delta);
    if (n) out[d.espece][d.couleur] = n; else delete out[d.espece][d.couleur];
  }
  return out;
}

/** Ressources rapportées par la file d'une espèce : une par génération et par monture. */
export const ressourcesExtraction = (q: ExtractQueue, e: Espece) =>
  Object.entries(q[e]).reduce((s, [c, n]) => s + (findColorIn(e, c)?.gen ?? 0) * n, 0);
export const extractTotal = (q: ExtractQueue, e: Espece) => Object.values(q[e]).reduce((s, n) => s + n, 0);

/** Calculateur valide : palier 1 à 4, 1 à 10 simulations par enclos, sérénités bornées. */
function sanitizeCalc(x: unknown): Calculateur {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Calculateur>;
  const palier = [1, 2, 3, 4].includes(Number(o.palier)) ? (Number(o.palier) as Palier) : PALIER_DEFAUT;
  const simulations: Record<number, Simulation[]> = {};
  for (const [k, list] of Object.entries(o.simulations ?? {})) {
    if (!Array.isArray(list)) continue;
    const sims = list.slice(0, SIMULATIONS_MAX).flatMap((sim): Simulation[] => {
      const v = sim as Partial<Simulation>;
      if (!v || typeof v !== 'object') return [];
      const ser = typeof v.serenite === 'number' && Math.abs(v.serenite) <= SERENITE_BORNE ? Math.round(v.serenite) : null;
      return [{ id: String(v.id ?? uid()), serenite: ser, le: Number(v.le) || 0, cible: v.cible === 'passer' ? 'passer' : 'rester' }];
    });
    if (sims.length) simulations[Number(k)] = sims;
  }
  return { palier, simulations };
}

export function normalizeSettings(x: Partial<Settings> | null | undefined): Settings {
  // Avant la v3, le nombre d'enclos était la longueur de la liste « enclos »
  const old = (x as { enclos?: unknown } | null | undefined)?.enclos;
  const n = Number(x?.nbEnclos) || (Array.isArray(old) ? old.length : 0) || ENCLOS_MAX;
  const nbEnclos = Math.max(1, Math.min(ENCLOS_MAX, Math.round(n)));
  const places = Math.max(0, Math.floor(Number(x?.places) || 0));
  const vitesses = Array.isArray(x?.vitesses) && x!.vitesses.length === 4 && x!.vitesses.every((v) => Number(v) > 0)
    ? x!.vitesses.map(Number) : [...VITESSES_DEFAUT];
  const { enclos: _old, ...rest } = (x ?? {}) as Partial<Settings> & { enclos?: unknown };
  return {
    ...defaultSettings(), ...rest, nbEnclos, places, vitesses, calc: sanitizeCalc(x?.calc),
    regles: Array.isArray(x?.regles) ? sanitizeRegles(x!.regles) : REGLES_DEFAUT.map((r) => ({ ...r })),
    recettes: sanitizeRecettes(x?.recettes),
    cibles: sanitizeCibles(x?.cibles),
    prix: sanitizePrix(x?.prix),
    chanceBase: Math.max(1, Math.min(100, Number(x?.chanceBase) || 40)),
    journal: Array.isArray(x?.journal) ? x!.journal : [],
  };
}

export function load(): EtableState {
  return {
    dd: read<unknown[]>(KEYS.dd, []).map(sanitize).filter((d) => d !== null),
    history: read<HistoryEntry[]>(KEYS.history, []),
    settings: normalizeSettings(read<Partial<Settings>>(KEYS.settings, {})),
    breaks: sanitizeBreaks(read<unknown[]>(KEYS.breaks, [])),
    queue: sanitizeQueue(read<unknown>(KEYS.queue, null)),
    extract: sanitizeExtract(read<unknown>(KEYS.extract, null)),
  };
}

/** Renvoie false si le cache est plein ou indisponible. */
export function save(s: EtableState): boolean {
  try {
    localStorage.setItem(KEYS.dd, JSON.stringify(s.dd));
    localStorage.setItem(KEYS.history, JSON.stringify(s.history));
    localStorage.setItem(KEYS.settings, JSON.stringify(s.settings));
    localStorage.setItem(KEYS.breaks, JSON.stringify(s.breaks));
    localStorage.setItem(KEYS.queue, JSON.stringify(s.queue));
    localStorage.setItem(KEYS.extract, JSON.stringify(s.extract));
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
      breaks: Array.isArray(o.breaks) ? sanitizeBreaks(o.breaks) : undefined,
      queue: o.queue ? sanitizeQueue(o.queue) : undefined,
      extract: o.extract ? sanitizeExtract(o.extract) : undefined,
    };
  }
  throw new Error('format inconnu');
}

/** Garde uniquement les sessions de brisage valides. */
export function sanitizeBreaks(list: unknown): BreakSession[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((x): BreakSession[] => {
    const o = x as Partial<BreakSession>;
    if (!o || (o.species !== 'volkorne' && o.species !== 'muldo') || !(Number(o.mounts) > 0)) return [];
    const runes: Record<string, number> = {};
    // Noms des runes ramenés à l'écriture du jeu (« ré terre » → « Ré Terre »), les inconnus gardés tels quels
    for (const [k, v] of Object.entries(o.runes ?? {})) if (Number(v) > 0) runes[runeOfficielle(k) ?? k] = (runes[runeOfficielle(k) ?? k] ?? 0) + Number(v);
    return [{ id: String(o.id ?? Math.random()), date: String(o.date ?? ''), species: o.species, level: Number(o.level) || 1, mounts: Number(o.mounts), runes, created: Number(o.created) || Date.now() }];
  });
}

/** Taille maximale de l'historique dans le cache (environ 2 Mo). */
export const HISTORY_MAX_BYTES = 2_000_000;

/**
 * Plafonne le poids de l'historique : au-delà de la limite, les actions les plus anciennes perdent leur copie
 * des montures. Elles restent lisibles, mais ne sont plus annulables. La plus récente n'est jamais touchée.
 */
export function capHistory(list: HistoryEntry[], maxBytes = HISTORY_MAX_BYTES): HistoryEntry[] {
  let size = JSON.stringify(list).length;
  if (size <= maxBytes) return list;
  const out = [...list];
  for (let i = 0; i < out.length - 1 && size > maxBytes; i++) {
    const h = out[i];
    if (h.pruned || (!h.added.length && !h.removed.length)) continue;
    const before = JSON.stringify(h).length;
    out[i] = { ...h, added: [], removed: [], pruned: true };
    size -= before - JSON.stringify(out[i]).length;
  }
  return out;
}

export const emptyQueue = (): BreakQueue => ({ volkorne: {}, muldo: {} });

/** File « à briser » valide : uniquement des quantités positives. */
export function sanitizeQueue(x: unknown): BreakQueue {
  const q = emptyQueue();
  if (!x || typeof x !== 'object') return q;
  for (const e of ['volkorne', 'muldo'] as const) {
    const src = (x as Record<string, unknown>)[e];
    if (src && typeof src === 'object') for (const [c, n] of Object.entries(src)) if (Number(n) > 0) q[e][c] = Math.floor(Number(n));
  }
  return q;
}

/** Applique des variations à la file, sans jamais descendre sous zéro. */
export function applyQueue(q: BreakQueue, deltas: { espece: 'volkorne' | 'muldo'; couleur: string; delta: number }[]): BreakQueue {
  const out: BreakQueue = { volkorne: { ...q.volkorne }, muldo: { ...q.muldo } };
  for (const d of deltas) {
    const n = Math.max(0, (out[d.espece][d.couleur] ?? 0) + d.delta);
    if (n) out[d.espece][d.couleur] = n; else delete out[d.espece][d.couleur];
  }
  return out;
}
export const queueTotal = (q: BreakQueue, e: 'volkorne' | 'muldo') => Object.values(q[e]).reduce((s, n) => s + n, 0);
