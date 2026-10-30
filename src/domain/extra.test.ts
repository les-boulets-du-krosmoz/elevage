import { describe, expect, it } from 'vitest';
import { series, summarize } from './brisage';
import { planCycle } from './plan';
import { planSexes } from './sexPlan';
import { newMonture } from './stock';
import type { BreakSession } from './types';

describe('planSexes', () => {
  it('impose des sexes opposés pour former les couples de génération 3', () => {
    const dd = [...Array.from({ length: 4 }, () => newMonture('Amande', 'M')), ...Array.from({ length: 4 }, () => newMonture('Dorée', 'F')),
      ...Array.from({ length: 2 }, () => newMonture('Rousse', 'M'))];
    const plan = planCycle(dd, 'Ebène', 8);
    const sp = planSexes(dd, plan.crossings, 'Ebène');
    expect(sp.babies['Amande et Dorée']).toBeGreaterThan(0);
    expect(sp.babies['Dorée et Rousse']).toBeGreaterThan(0);
    // Chaque couple d'Ebène vient de deux bébés : 2 objets par couple
    expect(sp.next['Ebène'].couples).toBe(Math.min(sp.babies['Amande et Dorée'], sp.babies['Dorée et Rousse']));
    expect(sp.items).toBe(sp.next['Ebène'].couples * 2);
  });
  it('utilise le stock existant avant les objets', () => {
    const dd = [newMonture('Dorée et Rousse', 'F'), ...Array.from({ length: 2 }, () => newMonture('Amande', 'M')), ...Array.from({ length: 2 }, () => newMonture('Dorée', 'F'))];
    const plan = planCycle(dd, 'Ebène', 2);
    const sp = planSexes(dd, plan.crossings, 'Ebène');
    // Le bébé Amande et Dorée doit être ♂ pour aller avec la Dorée et Rousse ♀ du stock : 1 seul objet
    expect(sp.forced['Amande et Dorée']).toEqual({ M: 1, F: 0 });
    expect(sp.items).toBe(1);
  });
});

describe('brisage', () => {
  const s = (date: string, mounts: number, runes: Record<string, number>, level = 1): BreakSession =>
    ({ id: date + mounts, date, species: 'volkorne', level, mounts, runes, created: 0 });
  const list = [s('2026-10-01', 100, { 'Ga PA': 3, Cha: 300 }), s('2026-10-02', 100, { 'Ga PA': 2, Cha: 280 }), s('2026-10-03', 50, { Fo: 40 }, 20)];
  it('calcule les montures par Ga PA et la fragilité', () => {
    const r = summarize(list, 'volkorne');
    expect(r.mounts).toBe(250);
    expect(r.main).toBe(5);
    expect(r.mountsPerMain).toBe(50);
    expect(r.fragile).toBe(false);
  });
  it('sépare le rendement par niveau', () => {
    const r = summarize(list, 'volkorne');
    expect(r.byLevel.map((l) => l.level)).toEqual([1, 20]);
    expect(r.byLevel[0].yield.Cha).toBeCloseTo(2.9);
    expect(r.byLevel[1].yield.Fo).toBeCloseTo(0.8);
  });
  it('suit le cumul dans l’ordre des dates', () => {
    const c = series([...list].reverse(), 'volkorne').cumulative.map((p) => p.value);
    expect(c[0]).toBeCloseTo(100 / 3);
    expect(c[1]).toBe(40);
  });
});

import { nextGeneration, planNow, withoutUsed } from './plan';

describe('lot 1 : fécondité', () => {
  const f = (c: string, s: 'M' | 'F', n: number, etat: 'feconde' | 'fertile' = 'feconde') =>
    Array.from({ length: n }, () => newMonture(c, s, undefined, undefined, { etat }));

  it('« maintenant » n’utilise que les fécondes, sans achat', () => {
    const dd = [...f('Amande', 'M', 3), ...f('Dorée', 'F', 2), ...f('Dorée', 'F', 5, 'fertile')];
    const now = planNow(dd, 'Amande et Dorée');
    expect(now).toEqual([expect.objectContaining({ m: 'Amande', f: 'Dorée', n: 2, bm: 0, bf: 0 })]);
  });

  it('respecte le ratio de l’arbre entre recettes de même génération', () => {
    const dd = [...f('Amande', 'M', 6), ...f('Dorée', 'M', 6), ...f('Rousse', 'M', 6), ...f('Amande', 'F', 6), ...f('Dorée', 'F', 6), ...f('Rousse', 'F', 6)];
    const now = planNow(dd, 'Ebène et Indigo');
    const n = (child: string) => now.filter((c) => c.child === child).reduce((s, c) => s + c.n, 0);
    expect(n('Amande et Dorée')).toBeGreaterThanOrEqual(n('Dorée et Rousse'));
    expect(n('Amande et Dorée')).toBeGreaterThanOrEqual(n('Amande et Rousse'));
  });

  it('les fécondes utilisées maintenant ne sont pas recomptées pour la suite', () => {
    const dd = [...f('Amande', 'M', 2), ...f('Dorée', 'F', 1), ...f('Dorée', 'F', 3, 'fertile')];
    const rest = withoutUsed(dd, planNow(dd, 'Amande et Dorée'));
    expect(rest.filter((d) => d.etat === 'feconde')).toHaveLength(1);
    expect(rest.filter((d) => d.etat === 'fertile')).toHaveLength(3);
  });

  it('les accouplements possibles ignorent les fertiles', () => {
    expect(nextGeneration([...f('Amande', 'M', 2, 'fertile'), ...f('Dorée', 'F', 2)])).toHaveLength(0);
  });
});

import { SPECIES_COLORS, findColorIn } from './colors';
import { countStock } from './stock';

describe('lot 2 : trois espèces', () => {
  it('connaît les 120 volkornes et les 120 muldos, avec la bonne répartition par génération', () => {
    const byGen = (e: 'volkorne' | 'muldo') => SPECIES_COLORS[e].reduce<Record<number, number>>((m, c) => ({ ...m, [c.gen]: (m[c.gen] ?? 0) + 1 }), {});
    expect(SPECIES_COLORS.volkorne).toHaveLength(120);
    expect(SPECIES_COLORS.muldo).toHaveLength(120);
    expect(byGen('volkorne')).toEqual({ 1: 4, 2: 6, 3: 4, 4: 22, 5: 2, 6: 17, 7: 1, 8: 10, 9: 4, 10: 50 });
    expect(byGen('muldo')).toEqual({ 1: 5, 2: 10, 3: 2, 4: 11, 5: 2, 6: 15, 7: 2, 8: 19, 9: 4, 10: 50 });
  });
  it('ne confond pas une couleur partagée entre espèces', () => {
    expect(findColorIn('muldo', 'Doré')?.gen).toBe(1);
    expect(findColorIn('volkorne', 'Doré')?.gen).toBe(7);
    expect(findColorIn('dragodinde', 'Doré')).toBeNull();
    const dd = [newMonture('Indigo', 'M', undefined, undefined, { espece: 'muldo' })];
    expect(countStock(dd)['Indigo|M']).toBe(1);
    expect(nextGeneration(dd)).toHaveLength(0);
  });
});
