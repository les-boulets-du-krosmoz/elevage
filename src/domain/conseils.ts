import { findColorIn, type Espece, type Sex } from './colors';
import type { LotPlan } from './planGeneration';
import type { RecettesEspece } from './recettes';
import type { Monture, Prix } from './types';

const gen = (e: Espece, c: string) => findColorIn(e, c)?.gen ?? 0;

/* ---------- Optimakina (section 6.9) ---------- */

/** Génétons rapportés par un parent selon sa génération (DPLN) : 2, 4, 8, 16, 30, 60, 120, 240, 500. */
const GENETONS = [0, 2, 4, 8, 16, 30, 60, 120, 240, 500];
export const genetons = (g: number) => GENETONS[g] ?? 0;

/** Ressources rendues à l'extracteur : N pour une génération N, rien pour une génération 1. */
const extraites = (g: number) => (g <= 1 ? 0 : g);

export interface GainReussite {
  /** Ressources gagnées par une réussite plutôt qu'un échec, en moyenne. */
  ressources: number;
  genetons: number;
  /** En kamas, avec les prix connus. */
  kamas: number;
}

/**
 * Ce que rapporte une réussite (le bébé de la couleur visée) plutôt qu'un échec (une couleur des parents, en moyenne).
 * Les génétons ne comptent que si le bébé dépasse les générations des deux parents.
 */
export function gainReussite(espece: Espece, lot: Pick<LotPlan, 'm' | 'f' | 'bebe'>, prix: Prix): GainReussite {
  const gm = gen(espece, lot.m), gf = gen(espece, lot.f), gb = gen(espece, lot.bebe);
  const ressources = extraites(gb) - (extraites(gm) + extraites(gf)) / 2;
  const g = gb > Math.max(gm, gf) ? genetons(gm) + genetons(gf) : 0;
  const kamas = ressources * (prix.ressource[espece] ?? 0) + g * (prix.geneton ?? 0);
  return { ressources, genetons: g, kamas };
}

/** Prix de l'Optimakina utilisable pour une génération cible : la moins chère des générations égales ou supérieures. */
export function prixOptimakina(prix: Prix, espece: Espece, cible: number): number | null {
  const g = prix.optimakina[espece] ?? {};
  const ok = Object.entries(g).filter(([k]) => Number(k) >= cible).map(([, v]) => v);
  return ok.length ? Math.min(...ok) : null;
}

export interface VerdictOptimakina { seuil: number; prix: number | null; rentable: boolean | null }

/** Une Optimakina ajoute 20 points de chance : elle vaut 0,2 × le gain d'une réussite. */
export function verdictOptimakina(espece: Espece, lot: Pick<LotPlan, 'm' | 'f' | 'bebe' | 'gen'>, prix: Prix): VerdictOptimakina {
  const seuil = Math.round(0.2 * gainReussite(espece, lot, prix).kamas);
  const p = prixOptimakina(prix, espece, lot.gen);
  return { seuil, prix: p, rentable: p === null ? null : p <= seuil };
}

/* ---------- Sexes à cibler (Animakina, section 6.5) ---------- */

export interface ConseilSexe {
  /** Lot dont les bébés sont à cibler, sexe voulu, nombre d'accouplements avec Animakina. */
  lot: LotPlan;
  sexe: Sex;
  accouplements: number;
  /** Ce qui attend : n montures de cette couleur et de l'autre sexe. */
  attente: { c: string; x: Sex; n: number };
  pour: string;
}

/**
 * Une Animakina n'est proposée que pour finir des couples : quand, dans une recette visée, une moitié attend
 * des partenaires d'un sexe que l'autre moitié n'a pas (15 ♂ Doré et Pourpre pour 0 ♀ Doré et Orchidée).
 * Sur une grosse session, le hasard équilibre ce qui naît ; ce qui est déjà en stock, lui, reste déséquilibré.
 */
export function conseilsSexe(espece: Espece, dd: Monture[], lots: LotPlan[], rec: RecettesEspece, cibles: string[], chance: number): ConseilSexe[] {
  // Ce qui restera après la session : stock (fécondes et fertiles) moins les parents des lots
  const reste: Record<string, { M: number; F: number }> = {};
  for (const d of dd.filter((x) => x.espece === espece)) {
    const c = findColorIn(espece, d.couleur);
    if (c) (reste[c.name] ??= { M: 0, F: 0 })[d.sexe]++;
  }
  for (const l of lots) {
    if (reste[l.m]) reste[l.m].M -= l.n;
    if (reste[l.f]) reste[l.f].F -= l.n;
  }
  const n = (c: string, x: Sex) => Math.max(0, reste[c]?.[x] ?? 0);
  const taux = Math.max(0.05, Math.min(1, chance / 100));
  const out = new Map<string, ConseilSexe>();
  for (const cible of cibles) for (const [p, q] of rec[cible] ?? []) {
    for (const [a, b] of [[p, q], [q, p]] as [string, string][]) {
      for (const x of ['M', 'F'] as Sex[]) {
        const y: Sex = x === 'M' ? 'F' : 'M';
        const manque = n(a, x) - n(b, y);
        if (manque < 3 || manque < 0.25 * (n(a, x) + n(b, y))) continue;
        // Les lots de la session qui produisent b : Animakina du sexe y sur assez d'accouplements
        for (const lot of lots.filter((l) => l.bebe === b)) {
          const k = Math.min(lot.n, Math.ceil(manque / taux));
          const key = `${lot.m}|${lot.f}|${y}`;
          const prev = out.get(key);
          if (!prev || prev.accouplements < k) out.set(key, { lot, sexe: y, accouplements: k, attente: { c: a, x, n: n(a, x) }, pour: cible });
        }
      }
    }
  }
  return [...out.values()].sort((u, v) => v.accouplements - u.accouplements);
}

/* ---------- Montures à tester, reproducteurs, noms en jeu ---------- */

/** Un bébé tombé sous la génération de ses parents garde leur généalogie : il peut viser plus haut. */
export const estATester = (espece: Espece, bebe: string, m: string, f: string) => gen(espece, bebe) < Math.max(gen(espece, m), gen(espece, f));

const abrege = (couleur: string) => couleur.split(/\s+et\s+/).map((p) => p.slice(0, 3)).join('');

/** Noms courts à donner en jeu : « T-Dor-01 » (à tester), « R-DorPou-02 » (reproducteur), numérotés à la suite. */
export function nomsJeu(prefixe: 'T' | 'R', couleur: string, n: number, dd: Monture[]): string[] {
  const max = Math.max(0, ...dd.map((d) => d.nom?.match(new RegExp(`^${prefixe}-[^-]+-(\\d+)$`))?.[1]).filter(Boolean).map(Number));
  return Array.from({ length: n }, (_, i) => `${prefixe}-${abrege(couleur)}-${String(max + i + 1).padStart(2, '0')}`);
}

export interface Piste { avec: string; sexe: Sex; vise: string; gen: number; dispo: number }

/**
 * Pistes pour une monture à tester : ses parents comptent dans la généalogie de ses bébés. Si l'une de leurs couleurs
 * forme une recette avec une autre couleur, l'accoupler à cette autre couleur peut viser la monocolore de la recette.
 */
export function pistes(espece: Espece, m: Monture, dd: Monture[], rec: RecettesEspece): Piste[] {
  const parents = [m.pere, m.mere].map((c) => findColorIn(espece, c)?.name).filter((c): c is string => !!c);
  const sexe: Sex = m.sexe === 'M' ? 'F' : 'M';
  const out = new Map<string, Piste>();
  for (const [vise, list] of Object.entries(rec)) {
    if (gen(espece, vise) <= gen(espece, m.couleur)) continue;
    for (const [a, b] of list) for (const [p, autre] of [[a, b], [b, a]]) {
      if (!parents.includes(p)) continue;
      const dispo = dd.filter((d) => d.espece === espece && d.etat === 'feconde' && d.sexe === sexe && d.id !== m.id && findColorIn(espece, d.couleur)?.name === autre).length;
      const k = `${autre}|${vise}`;
      if (!out.has(k)) out.set(k, { avec: autre, sexe, vise, gen: gen(espece, vise), dispo });
    }
  }
  return [...out.values()].sort((u, v) => v.gen - u.gen || v.dispo - u.dispo);
}

/** Marque « à tester » les bébés tombés sous la génération de leurs parents et leur donne un nom ; renvoie les noms. */
export function marquerATester(espece: Espece, kids: Monture[], m: string, f: string, dd: Monture[]): string[] {
  const noms: string[] = [];
  const cibles = kids.filter((b) => estATester(espece, b.couleur, m, f));
  for (const c of new Set(cibles.map((b) => b.couleur))) {
    const de = cibles.filter((b) => b.couleur === c);
    const ns = nomsJeu('T', c, de.length, [...dd, ...kids]);
    de.forEach((b, i) => { b.aTester = true; b.nom = ns[i]; noms.push(ns[i]); });
  }
  return noms;
}
