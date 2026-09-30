import { describe, expect, it } from 'vitest';
import { COLORS, findColor, treeWeights } from './colors';
import { planCycle } from './plan';
import { newDD } from './stock';
import type { Dragodinde } from './types';

const herd = (spec: [string, 'M' | 'F', number][]) =>
  spec.flatMap(([c, s, n]) => Array.from({ length: n }, () => newDD(c, s)));
const totalBuy = (b: Record<string, number>) => Object.values(b).reduce((a, v) => a + v, 0);

describe('couleurs', () => {
  it('connaît les 66 couleurs', () => expect(COLORS).toHaveLength(66));
  it('tolère accents manquants et ordre inversé', () => {
    expect(findColor('rousse et amande')?.name).toBe('Amande et Rousse');
    expect(findColor('Ebene')?.name).toBe('Ebène');
  });
  it('calcule le ratio de l’arbre', () => {
    const w = treeWeights('Ebène et Indigo');
    expect(w.get('Amande et Dorée')).toBe(2);
    expect(w.get('Dorée et Rousse')).toBe(1);
    expect(w.get('Amande et Rousse')).toBe(1);
  });
});

describe('planCycle', () => {
  it('ne dépasse jamais les places disponibles', () => {
    const p = planCycle([], 'Ebène et Indigo', 13);
    expect(p.crossings.reduce((s, c) => s + c.n, 0)).toBe(6);
  });

  it('chaque achat fait baisser le total d’exactement 1', () => {
    const cols = ['Amande', 'Dorée', 'Rousse', 'Amande et Dorée', 'Dorée et Rousse', 'Amande et Rousse', 'Ebène', 'Indigo'];
    const targets = ['Ebène et Indigo', 'Pourpre', 'Amande et Dorée', 'Ebène', 'Orchidée et Pourpre'];
    let seed = 42;
    const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed % n; };
    for (let it = 0; it < 400; it++) {
      const dd: Dragodinde[] = [];
      for (const c of cols) for (const s of ['M', 'F'] as const) dd.push(...herd([[c, s, rnd(c.includes(' ') ? 3 : 6)]]));
      const target = targets[it % targets.length];
      const places = 2 * (1 + rnd(15));
      let plan = planCycle(dd, target, places);
      while (totalBuy(plan.buy) > 0) {
        const before = totalBuy(plan.buy);
        const keys = Object.keys(plan.buy);
        const [c, s] = keys[rnd(keys.length)].split('|') as [string, 'M' | 'F'];
        dd.push(newDD(c, s));
        plan = planCycle(dd, target, places);
        expect(totalBuy(plan.buy)).toBe(before - 1);
      }
    }
  });
});
