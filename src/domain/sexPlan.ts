import { findColor, treeWeights, type Sex } from './colors';
import type { Crossing } from './plan';
import { countStock, key } from './stock';
import type { Monture } from './types';

export interface SexPlan {
  /** Bébés produits ce cycle, par couleur visée. */
  babies: Record<string, number>;
  /** Sexes à imposer avec l'objet, par couleur de bébé. */
  forced: Record<string, { M: number; F: number }>;
  items: number;
  /** Couples formés au cycle suivant, par couleur visée, et combien demandent un objet. */
  next: Record<string, { couples: number; withItems: number }>;
}

/**
 * Sexes à demander pour que les bébés de ce cycle forment des couples au cycle suivant.
 * On suppose que chaque croisement donne la couleur visée.
 * Couples formés par coût croissant : 0 objet (stock ♂ × stock ♀), puis 1 (stock × bébé dont on impose le sexe),
 * puis 2 (deux bébés dont on impose les sexes opposés). Les recettes sont servies à tour de rôle.
 */
export function planSexes(dd: Monture[], crossings: Crossing[], target: string): SexPlan {
  // Stock restant après ce cycle : les parents venant du stock sont consommés
  const stock = countStock(dd);
  for (const c of crossings) {
    if (!c.bm) stock[key(c.m, 'M')] = (stock[key(c.m, 'M')] ?? 0) - c.n;
    if (!c.bf) stock[key(c.f, 'F')] = (stock[key(c.f, 'F')] ?? 0) - c.n;
  }
  const babies: Record<string, number> = {};
  for (const c of crossings) babies[c.child] = (babies[c.child] ?? 0) + c.n;
  const pool = { ...babies };

  // Recettes de l'arbre dont au moins un ingrédient sort de ce cycle
  const recipes = [...treeWeights(target).keys()]
    .map((n) => findColor(n)!)
    .filter((c) => c.recipe!.some((i) => babies[i]))
    .sort((a, b) => a.gen - b.gen);

  const forced: SexPlan['forced'] = {};
  const next: SexPlan['next'] = {};
  let items = 0;
  const fixed = (c: string, x: Sex) => (stock[key(c, x)] ?? 0) > 0;
  const costOf = (c: string, x: Sex) => (fixed(c, x) ? 0 : (pool[c] ?? 0) > 0 ? 1 : Infinity);
  const take = (c: string, x: Sex) => {
    if (fixed(c, x)) { stock[key(c, x)]--; return 0; }
    pool[c]--;
    (forced[c] ??= { M: 0, F: 0 })[x]++;
    return 1;
  };

  for (const pass of [0, 1, 2]) {
    let progress = true;
    while (progress) {
      progress = false;
      for (const r of recipes) {
        const [a, b] = r.recipe!;
        const options: [string, string][] = [[a, b], [b, a]];
        const pick = options.find(([m, f]) => costOf(m, 'M') + costOf(f, 'F') === pass);
        if (!pick) continue;
        const used = take(pick[0], 'M') + take(pick[1], 'F');
        items += used;
        const e = (next[r.name] ??= { couples: 0, withItems: 0 });
        e.couples++;
        if (used) e.withItems++;
        progress = true;
      }
    }
  }
  return { babies, forced, items, next };
}
