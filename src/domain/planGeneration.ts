import { colorsOf, findColorIn, type Espece, type Sex } from './colors';
import type { RecettesEspece } from './recettes';
import type { Monture } from './types';

/**
 * Plan d'une session d'accouplements des muldos et des volkornes (section 6.4 du cahier) :
 * 1. les couples qui atteignent tout de suite une monocolore de génération supérieure ;
 * 2. les bicolores qui préparent les monocolores visées, en quantités équilibrées entre les deux moitiés d'une recette ;
 * 3. toute autre bicolore possible, pour épuiser le stock ;
 * 4. le reste, listé avec sa raison.
 * Seules les fécondes s'accouplent ; les fertiles comptent pour l'équilibre des recettes (elles le seront bientôt).
 */

export type Role = 'atteint' | 'prepare' | 'epuise';
export interface LotPlan {
  m: string;
  f: string;
  n: number;
  /** Couleur visée par le croisement, et sa génération. */
  bebe: string;
  gen: number;
  role: Role;
  /** Monocolore visée que ce lot prépare (rôle « prepare »). */
  pour?: string;
}
export interface Reste { c: string; x: Sex; n: number }
export interface PlanGeneration { lots: LotPlan[]; restes: Reste[]; cibles: string[] }

const VALEUR = { atteint: 1000, prepare: 500, surplus: 100, epuise: 10 };
const cle = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const isMono = (espece: Espece, c: string) => findColorIn(espece, c)?.parts.length === 1;
const gen = (espece: Espece, c: string) => findColorIn(espece, c)?.gen ?? 0;

/**
 * Cibles par défaut : toutes les monocolores de la génération 3 jusqu'à la génération impaire qui suit la plus haute
 * monocolore en stock (génération 1 en stock → le Roux et l'Amande ; un premier Roux → l'Ivoire et la Turquoise en plus).
 * Garder les générations basses évite qu'une seule monture de génération supérieure arrête de préparer les autres.
 */
export function ciblesAuto(espece: Espece, dd: Monture[]): string[] {
  const mine = dd.filter((d) => d.espece === espece);
  const g = Math.max(1, ...mine.filter((d) => isMono(espece, d.couleur)).map((d) => gen(espece, d.couleur)));
  const vise = Math.min(9, g + 2);
  return colorsOf(espece).filter((c) => c.parts.length === 1 && c.gen >= 3 && c.gen <= vise).map((c) => c.name);
}

/** Compte par couleur et par sexe, noms officiels. */
function compter(espece: Espece, list: Monture[]) {
  const out: Record<string, { M: number; F: number }> = {};
  for (const d of list) {
    const c = findColorIn(espece, d.couleur);
    if (c) (out[c.name] ??= { M: 0, F: 0 })[d.sexe]++;
  }
  return out;
}

export function planGeneration(espece: Espece, dd: Monture[], rec: RecettesEspece, cibles: string[]): PlanGeneration {
  const mine = dd.filter((d) => d.espece === espece);
  const libres = compter(espece, mine.filter((d) => d.etat === 'feconde'));
  const tous = compter(espece, mine);
  const M = (c: string) => libres[c]?.M ?? 0;
  const F = (c: string) => libres[c]?.F ?? 0;

  // Index inverse : un couple de couleurs → les couleurs qu'il vise
  const index = new Map<string, string[]>();
  for (const [t, paires] of Object.entries(rec)) for (const [a, b] of paires) {
    const k = cle(a, b);
    index.set(k, [...(index.get(k) ?? []), t]);
  }
  const paires = [...index.keys()].map((k) => k.split('|') as [string, string]);

  // Moitiés de recettes des cibles : pour chaque bicolore, ses partenaires dans une recette d'une cible
  const partenaires = new Map<string, { autre: string; pour: string }[]>();
  for (const c of cibles) for (const [a, b] of rec[c] ?? []) {
    partenaires.set(a, [...(partenaires.get(a) ?? []), { autre: b, pour: c }]);
    partenaires.set(b, [...(partenaires.get(b) ?? []), { autre: a, pour: c }]);
  }

  const prevu: Record<string, number> = {};
  const utilise: Record<string, number> = {};
  // Ce qui sera disponible d'une couleur à la session suivante : stock, moins les parents de cette session, plus les bébés prévus
  const dispo = (c: string) => (tous[c] ? tous[c].M + tous[c].F : 0) - (utilise[c] ?? 0) + (prevu[c] ?? 0);

  /** Valeur d'un couple qui vise t, compte tenu de ce qui est déjà prévu. */
  const valeur = (t: string): { v: number; role: Role; pour?: string } => {
    const g = gen(espece, t);
    if (isMono(espece, t)) return { v: VALEUR.atteint + 10 * g + (cibles.includes(t) ? 50 : 0), role: 'atteint' };
    let best: { v: number; role: Role; pour?: string } = { v: VALEUR.epuise + 10 * g, role: 'epuise' };
    for (const { autre, pour } of partenaires.get(t) ?? []) {
      const deficitaire = dispo(autre) >= dispo(t);
      // Concentrer sur les recettes déjà entamées : des moitiés en grand nombre s'apparient mieux, les sexes étant aléatoires
      const entame = Math.min(dispo(autre), 99) / 100;
      const v = (deficitaire ? VALEUR.prepare : VALEUR.surplus) + 10 * g + entame;
      if (v > best.v) best = { v, role: 'prepare', pour };
    }
    return best;
  };

  const lots = new Map<string, LotPlan>();
  for (;;) {
    let best: { m: string; f: string; t: string; v: number; role: Role; pour?: string; abondance: number } | null = null;
    for (const [a, b] of paires) {
      const cibleDuCouple = index.get(cle(a, b))!;
      // Plusieurs couleurs possibles pour un même couple : on retient la plus haute
      const t = [...cibleDuCouple].sort((x, y) => gen(espece, y) - gen(espece, x))[0];
      for (const [m, f] of [[a, b], [b, a]] as [string, string][]) {
        if (M(m) <= 0 || F(f) <= 0) continue;
        const val = valeur(t);
        const abondance = M(m) + F(f);
        if (!best || val.v > best.v || (val.v === best.v && abondance > best.abondance)) best = { m, f, t, ...val, abondance };
      }
    }
    if (!best) break;
    libres[best.m].M--;
    libres[best.f].F--;
    utilise[best.m] = (utilise[best.m] ?? 0) + 1;
    utilise[best.f] = (utilise[best.f] ?? 0) + 1;
    prevu[best.t] = (prevu[best.t] ?? 0) + 1;
    const k = `${best.m}|${best.f}`;
    const lot = lots.get(k);
    if (lot) {
      lot.n++;
      // Un lot garde le meilleur rôle qu'il a eu
      if (best.role === 'prepare' && lot.role === 'epuise') { lot.role = 'prepare'; lot.pour = best.pour; }
    } else {
      lots.set(k, { m: best.m, f: best.f, n: 1, bebe: best.t, gen: gen(espece, best.t), role: best.role, ...(best.pour ? { pour: best.pour } : {}) });
    }
  }

  const ordre: Record<Role, number> = { atteint: 0, prepare: 1, epuise: 2 };
  const restes = Object.entries(libres).flatMap(([c, n]) => (['M', 'F'] as Sex[]).filter((x) => n[x] > 0).map((x) => ({ c, x, n: n[x] })))
    .sort((a, b) => gen(espece, b.c) - gen(espece, a.c) || b.n - a.n);
  return {
    lots: [...lots.values()].sort((a, b) => ordre[a.role] - ordre[b.role] || b.gen - a.gen || b.n - a.n),
    restes,
    cibles,
  };
}

/** Couleurs possibles d'un bébé : la couleur visée, puis celles des parents (les grands-parents passent par « autre »). */
export const naissancesPossibles = (lot: Pick<LotPlan, 'bebe' | 'm' | 'f'>) => [...new Set([lot.bebe, lot.m, lot.f])];
