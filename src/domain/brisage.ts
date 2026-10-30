import { RUNES_FORGEMAGIE } from './runesData';
import type { BreakSession, BreakSpecies } from './types';

/** Runes connues par espèce. La première est la rune recherchée. Une rune hors liste peut toujours être saisie. */
export const RUNES: Record<BreakSpecies, string[]> = {
  volkorne: ['Ga PA', 'Fo', 'Ine', 'Cha', 'Age'],
  muldo: ['Ga PM', 'Ré Terre', 'Ré Feu', 'Ré Eau', 'Ré Air', 'Ré Neutre'],
};
export const MAIN_RUNE: Record<BreakSpecies, string> = { volkorne: 'Ga PA', muldo: 'Ga PM' };
export const SPECIES_LABEL: Record<BreakSpecies, string> = { volkorne: 'Volkorne', muldo: 'Muldo' };
export const RUNE_COLORS: Record<string, string> = {
  'Ga PA': '#C9A227', 'Ga PM': '#C9A227', Fo: '#8B5A2B', Ine: '#C0392B', Cha: '#2E6FB5', Age: '#3C9A5F',
  'Ré Terre': '#8B5A2B', 'Ré Feu': '#C0392B', 'Ré Eau': '#2E6FB5', 'Ré Air': '#3C9A5F', 'Ré Neutre': '#7A7A7A',
};
/** En dessous de ce nombre de runes principales obtenues, l'estimation reste fragile. */
export const FRAGILE_BELOW = 5;

const byDate = (a: BreakSession, b: BreakSession) => a.date.localeCompare(b.date) || a.created - b.created;

export interface BreakSummary {
  sessions: number;
  mounts: number;
  main: number;
  /** Montures brisées en moyenne pour une rune principale (null si aucune obtenue). */
  mountsPerMain: number | null;
  fragile: boolean;
  /** Rendement moyen (runes par monture), par niveau puis par rune. */
  byLevel: { level: number; mounts: number; yield: Record<string, number> }[];
  runes: string[];
}

export function summarize(list: BreakSession[], species: BreakSpecies): BreakSummary {
  const s = list.filter((x) => x.species === species);
  const main = MAIN_RUNE[species];
  const mounts = s.reduce((t, x) => t + x.mounts, 0);
  const got = s.reduce((t, x) => t + (x.runes[main] ?? 0), 0);
  const runes = [...new Set([...RUNES[species], ...s.flatMap((x) => Object.keys(x.runes))])];
  const levels = [...new Set(s.map((x) => x.level))].sort((a, b) => a - b);
  const byLevel = levels.map((level) => {
    const ss = s.filter((x) => x.level === level);
    const m = ss.reduce((t, x) => t + x.mounts, 0);
    const y: Record<string, number> = {};
    for (const r of runes) y[r] = ss.reduce((t, x) => t + (x.runes[r] ?? 0), 0) / m;
    return { level, mounts: m, yield: y };
  });
  return { sessions: s.length, mounts, main: got, mountsPerMain: got ? mounts / got : null, fragile: got < FRAGILE_BELOW, byLevel, runes };
}

/** Points pour les graphes, dans l'ordre chronologique. */
export function series(list: BreakSession[], species: BreakSpecies) {
  const s = list.filter((x) => x.species === species).sort(byDate);
  const main = MAIN_RUNE[species];
  let mounts = 0, got = 0;
  const cumulative = s.map((x) => {
    mounts += x.mounts;
    got += x.runes[main] ?? 0;
    return { label: x.date, value: got ? mounts / got : null };
  });
  const perSession = s.map((x) => ({
    label: x.date,
    values: Object.fromEntries(Object.entries(x.runes).filter(([r]) => r !== main).map(([r, v]) => [r, v / x.mounts])),
  }));
  return { cumulative, perSession };
}

/* ---------- Brisage v2 : toutes les runes, objectif, valeur des sessions ---------- */


export const TOUTES_RUNES = RUNES_FORGEMAGIE.map(([n]) => n);
const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^rune\s+/, '').replace(/\s+/g, ' ').trim();
const PAR_CLE = new Map(TOUTES_RUNES.map((n) => [plat(n), n]));
// Écritures du jeu pour les deux runes principales
PAR_CLE.set('ga pa', 'Ga PA');
PAR_CLE.set('ga pme', 'Ga PM');
PAR_CLE.set('ga pm', 'Ga PM');

/** Nom officiel d'une rune (« rune ré per air » → « Ré Per Air ») ; null si elle n'existe pas. */
export const runeOfficielle = (s: string): string | null => PAR_CLE.get(plat(s)) ?? null;

/** Recherche par nom : d'abord les noms qui commencent par la saisie, puis ceux qui la contiennent. */
export function chercherRunes(q: string, max = 8): string[] {
  const k = plat(q);
  if (!k) return [];
  const debut = TOUTES_RUNES.filter((n) => plat(n).startsWith(k));
  const dedans = TOUTES_RUNES.filter((n) => !plat(n).startsWith(k) && plat(n).includes(k));
  return [...debut, ...dedans].slice(0, max);
}

/** Runes à proposer dans une session : celles de l'espèce, puis toutes celles déjà obtenues sur cette espèce. */
export const runesProposees = (list: BreakSession[], species: BreakSpecies) =>
  [...new Set([...RUNES[species], ...list.filter((x) => x.species === species).flatMap((x) => Object.keys(x.runes))])];

export interface Objectif {
  rune: string;
  /** Rendement mesuré : runes par monture, et nombre de runes de ce type déjà obtenues. */
  rendement: number;
  obtenues: number;
  montures: number;
  /** Fourchette à 95 % environ : (N ± 2√N) / rendement. */
  min: number;
  max: number;
  fragile: boolean;
}

/** Montures à briser pour obtenir n runes d'un type, au rendement mesuré (à un niveau, ou tous niveaux). */
export function objectifRunes(list: BreakSession[], species: BreakSpecies, rune: string, n: number, niveau: number | null): Objectif | null {
  const s = list.filter((x) => x.species === species && (niveau === null || x.level === niveau));
  const montures = s.reduce((t, x) => t + x.mounts, 0);
  const obtenues = s.reduce((t, x) => t + (x.runes[rune] ?? 0), 0);
  if (!montures || !obtenues || !(n > 0)) return null;
  const r = obtenues / montures;
  return {
    rune, rendement: r, obtenues,
    montures: Math.round(n / r),
    min: Math.round(Math.max(0, n - 2 * Math.sqrt(n)) / r),
    max: Math.round((n + 2 * Math.sqrt(n)) / r),
    fragile: obtenues < FRAGILE_BELOW,
  };
}

/** Valeur d'une session en kamas avec les prix connus, et les runes obtenues dont le prix manque. */
export function valeurSession(b: BreakSession, prix: Record<string, number>): { kamas: number; parMonture: number; manquants: string[] } {
  let kamas = 0;
  const manquants: string[] = [];
  for (const [r, q] of Object.entries(b.runes)) {
    if (prix[r] > 0) kamas += q * prix[r]; else manquants.push(r);
  }
  return { kamas, parMonture: b.mounts ? kamas / b.mounts : 0, manquants };
}
