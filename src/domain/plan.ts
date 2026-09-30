import { COLORS, colorIndex, findColor, treeWeights, type Color, type Sex } from './colors';
import { countStock, key } from './stock';
import type { Dragodinde } from './types';

export interface Crossing {
  m: string;
  f: string;
  /** 1 si le parent est à acheter, 0 s'il vient du stock. */
  bm: 0 | 1;
  bf: 0 | 1;
  child: string;
  gen: number;
  n: number;
}

export interface CyclePlan {
  crossings: Crossing[];
  /** Achats de génération 1, par « couleur|sexe ». */
  buy: Record<string, number>;
  /** Couples nécessaires par couleur pour 1 DD visée. */
  weights: Map<string, number>;
}

/**
 * Remplit les places libres de l'enclos pour avancer vers la cible, sans prévoir les bébés à venir.
 * 1. Couples de génération 3 et plus : uniquement avec le stock (ils ne s'achètent pas).
 * 2. Places restantes : couples de génération 2, répartis selon le ratio de l'arbre.
 * 3. Sens de chaque couple (♂a×♀b ou ♂b×♀a) : minimum d'achats, par recherche exhaustive.
 *    Il n'existe que 3 bicolores de génération 2, donc la recherche reste rapide, et chaque
 *    DD achetée fait baisser le total d'achats d'exactement 1.
 */
export function planCycle(dd: Dragodinde[], target: string, places: number): CyclePlan {
  const stock = countStock(dd);
  const st = (k: string) => stock[k] ?? 0;
  const color = (n: string) => findColor(n) as Color;
  const isG1 = (n: string) => !color(n).recipe;
  const weights = treeWeights(target);
  const types = [...weights]
    .map(([child, k]) => ({ child, k, c: color(child) }))
    .sort((a, b) => b.c.gen - a.c.gen);

  const crossings: Crossing[] = [];
  const buy: Record<string, number> = {};
  let left = Math.floor(places / 2);
  const push = (m: string, f: string, bm: 0 | 1, bf: 0 | 1, child: string) => {
    const e = crossings.find((r) => r.m === m && r.f === f && r.bm === bm && r.bf === bf);
    if (e) e.n++;
    else crossings.push({ m, f, bm, bf, child, gen: color(child).gen, n: 1 });
  };

  // 1. Générations 3 et plus, depuis le stock
  for (const t of types) {
    const [a, b] = t.c.recipe!;
    if (isG1(a) && isG1(b)) continue;
    for (const [m, f] of [[a, b], [b, a]]) {
      while (left > 0 && st(key(m, 'M')) > 0 && st(key(f, 'F')) > 0) {
        stock[key(m, 'M')]--;
        stock[key(f, 'F')]--;
        left--;
        push(m, f, 0, 0, t.child);
      }
    }
  }

  // 2. Génération 2, selon le ratio de l'arbre (plus grands restes d'abord)
  const base = types.filter((t) => t.c.recipe!.every(isG1));
  const total = base.reduce((s, t) => s + t.k, 0);
  const alloc = base.map((t) => ({ t, n: Math.floor((left * t.k) / total), r: ((left * t.k) / total) % 1 }));
  let rest = left - alloc.reduce((s, x) => s + x.n, 0);
  [...alloc].sort((x, y) => y.r - x.r || y.t.k - x.t.k).forEach((x) => {
    if (rest > 0) { x.n++; rest--; }
  });

  // 3. Sens des couples : minimum d'achats
  const A = alloc.filter((x) => x.n > 0);
  const cost = (ks: number[]) => {
    const need: Record<string, number> = {};
    const add = (k: string, v: number) => (need[k] = (need[k] ?? 0) + v);
    A.forEach(({ t, n }, i) => {
      const [a, b] = t.c.recipe!;
      add(key(a, 'M'), ks[i]); add(key(b, 'F'), ks[i]);
      add(key(b, 'M'), n - ks[i]); add(key(a, 'F'), n - ks[i]);
    });
    return Object.entries(need).reduce((s, [k, v]) => s + Math.max(0, v - st(k)), 0);
  };
  let best: { c: number; ks: number[] } | null = null;
  const search = (i: number, ks: number[]) => {
    if (i === A.length) {
      const c = cost(ks);
      if (!best || c < best.c) best = { c, ks: [...ks] };
      return;
    }
    for (let k = A[i].n; k >= 0; k--) { ks.push(k); search(i + 1, ks); ks.pop(); }
  };
  search(0, []);

  A.forEach(({ t, n }, i) => {
    const [a, b] = t.c.recipe!;
    const k = best!.ks[i];
    for (const [m, f, q] of [[a, b, k], [b, a, n - k]] as [string, string, number][]) {
      for (let j = 0; j < q; j++) {
        const bm = st(key(m, 'M')) ? 0 : 1;
        const bf = st(key(f, 'F')) ? 0 : 1;
        if (bm) buy[key(m, 'M')] = (buy[key(m, 'M')] ?? 0) + 1; else stock[key(m, 'M')]--;
        if (bf) buy[key(f, 'F')] = (buy[key(f, 'F')] ?? 0) + 1; else stock[key(f, 'F')]--;
        push(m, f, bm, bf, t.child);
      }
    }
  });

  return { crossings: crossings.sort((x, y) => y.gen - x.gen), buy, weights };
}

/** Total des croisements par couleur visée, sans distinction de sexe ni de sens. */
export function totalsByChild(crossings: Crossing[]) {
  const totals: { child: string; gen: number; n: number }[] = [];
  for (const r of crossings) {
    const e = totals.find((t) => t.child === r.child);
    if (e) e.n += r.n;
    else totals.push({ child: r.child, gen: r.gen, n: r.n });
  }
  return totals.sort((p, q) => q.gen - p.gen || q.n - p.n);
}

export interface NextGenRow {
  color: Color;
  /** Sens possibles avec le nombre maximal de couples pour chacun. */
  options: { m: string; f: string; n: number }[];
  total: number;
}

/** Tous les croisements faisables avec le stock qui montent d'une génération (calcul ligne par ligne). */
export function nextGeneration(dd: Dragodinde[]): NextGenRow[] {
  const s = countStock(dd);
  const n = (c: string, x: Sex) => s[key(c, x)] ?? 0;
  return COLORS.filter((c) => c.recipe)
    .map((c) => {
      const [a, b] = c.recipe!;
      const options = [
        { m: a, f: b, n: Math.min(n(a, 'M'), n(b, 'F')) },
        { m: b, f: a, n: Math.min(n(b, 'M'), n(a, 'F')) },
      ].filter((o) => o.n > 0);
      return { color: c, options, total: options.reduce((t, o) => t + o.n, 0) };
    })
    .filter((r) => r.total > 0)
    .sort((x, y) => y.color.gen - x.color.gen || colorIndex(x.color) - colorIndex(y.color));
}
