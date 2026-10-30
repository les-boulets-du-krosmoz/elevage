import type { Palier } from './types';

/**
 * Temps de l'élevage. Le jeu avance par pas de 10 secondes : à chaque pas, une jauge d'enclos active
 * fait gagner à chaque monture autant de points que la vitesse de son palier. Le palier des jauges
 * est réglé une fois pour tous les enclos (réglage global) : pendant une session de jeu, les réservoirs
 * sont tenus au même niveau.
 */

export const PAS = 10; // secondes
/** Points gagnés par pas de 10 secondes, paliers 1 à 4. */
export const VITESSES_DEFAUT = [10, 20, 30, 40];
export const PALIERS: Palier[] = [1, 2, 3, 4];
export const PALIER_DEFAUT: Palier = 4;
export const SERENITE_BORNE = 5_000;
export const SIMULATIONS_MAX = 10;

export type Cible = 'rester' | 'passer';

export interface ResultatSimulation {
  /** Nombre de pas de 10 s, durée en secondes, sérénité atteinte. */
  pas: number;
  secondes: number;
  valeur: number;
  /** true : sérénité négative qui monte (jauge de gain) ; false : positive qui descend (jauge de perte). */
  monte: boolean;
}

const borne = (x: number) => Math.max(-SERENITE_BORNE, Math.min(SERENITE_BORNE, x));

/**
 * Temps pour qu'une sérénité s rejoigne 0 :
 * - « rester » : le dernier pas où elle est encore de son côté, au plus près de 0 (−1 au plus en négatif, 0 au plus bas en positif) ;
 * - « passer » : le premier pas où elle a changé de côté.
 * Négatif = −5 000 à −1, positif = 0 à +5 000 (zones du jeu). Les deux résultats sont séparés d'un pas.
 */
export function simuler(s: number, vitesse: number, cible: Cible): ResultatSimulation | null {
  if (!Number.isFinite(s) || !(vitesse > 0)) return null;
  const v = borne(Math.round(s));
  const monte = v < 0;
  const changement = monte ? Math.ceil(-v / vitesse) : Math.floor(v / vitesse) + 1;
  const pas = cible === 'rester' ? changement - 1 : changement;
  return { pas, secondes: pas * PAS, valeur: borne(monte ? v + pas * vitesse : v - pas * vitesse), monte };
}

/** Saisie de sérénité : « −4 200 », « -4200 », « 4 200 ». null si illisible ou hors bornes. */
export function lireSerenite(raw: string): number | null {
  const t = raw.replace(/[\s\u202f\u00a0]/g, '').replace('−', '-').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number(t));
  return Math.abs(n) <= SERENITE_BORNE ? n : null;
}

/** « 00:17:20 » */
export function hms(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

/** « 1 h 51 », « 25 min », « 2 j 3 h ». */
export function duree(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'moins d’une minute';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, '0')}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

const hhmmss = (d: Date) => [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
/** « 14:05:10 », « demain 02:10:00 ». */
export function heure(t: number, now: number): string {
  const d = new Date(t), n = new Date(now);
  const jours = Math.round((new Date(d.toDateString()).getTime() - new Date(n.toDateString()).getTime()) / 86_400_000);
  if (jours === 0) return hhmmss(d);
  if (jours === 1) return `demain ${hhmmss(d)}`;
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short' })} ${hhmmss(d)}`;
}

/* ---------- Calculateur de niveau (section 6.3) ---------- */

export const NIVEAU_MAX = 200;
/** Expérience totale approximative d'une monture au niveau L, ajustée sur six relevés en jeu (172 668 au niveau 100). */
export const xpMonture = (L: number) => (L <= 1 ? 0 : 3.795 * L ** 2.329);

/** Secondes pour passer du niveau a au niveau b au palier p (Mangeoire). */
export function dureeNiveau(a: number, b: number, p: Palier, v: number[]): number {
  const need = Math.max(0, xpMonture(b) - xpMonture(a));
  const vit = v[p - 1] ?? 0;
  return vit > 0 ? (need * PAS) / vit : Infinity;
}

/** Plus petit palier qui monte de a à b en moins de maxSec ; null si même le palier 4 ne suffit pas. */
export function palierPour(a: number, b: number, maxSec: number, v: number[]): Palier | null {
  return PALIERS.find((p) => dureeNiveau(a, b, p, v) <= maxSec) ?? null;
}
