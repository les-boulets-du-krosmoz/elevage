import { describe, expect, it } from 'vitest';
import { findColorIn, type Sex } from './colors';
import { ciblesAuto, planGeneration } from './planGeneration';
import { recettes } from './recettes';
import { newMonture } from './stock';
import type { Monture } from './types';

const n = (c: string) => findColorIn('muldo', c)!.name;
const mk = (c: string, x: Sex, k: number, etat: 'feconde' | 'fertile' = 'feconde'): Monture[] =>
  Array.from({ length: k }, () => newMonture(n(c), x, undefined, undefined, { espece: 'muldo', etat }));
const R = recettes('muldo');
const lotsDe = (p: ReturnType<typeof planGeneration>) => Object.fromEntries(p.lots.map((l) => [`${l.m} × ${l.f}`, l.n]));

describe('lot D : plan d’accouplement par génération', () => {
  it('critère du cahier : Roux et Amande, 10 Doré ♂, 5 Indigo ♂, 5 Ebène ♂, 10 Orchidée ♀, 10 Pourpre ♀', () => {
    const dd = [...mk('Doré', 'M', 10), ...mk('Indigo', 'M', 5), ...mk('Ebène', 'M', 5), ...mk('Orchidée', 'F', 10), ...mk('Pourpre', 'F', 10)];
    const cibles = ciblesAuto('muldo', dd);
    expect(cibles.sort()).toEqual(['Amande', 'Roux']);
    const p = planGeneration('muldo', dd, R, cibles);
    expect(lotsDe(p)).toEqual({ 'Doré × Orchidée': 5, 'Doré × Pourpre': 5, 'Indigo × Pourpre': 5, 'Ebène × Orchidée': 5 });
    expect(p.restes).toEqual([]);
    expect(p.lots.every((l) => l.role === 'prepare')).toBe(true);
  });

  it('un couple qui atteint une monocolore passe avant toute bicolore', () => {
    const dd = [...mk('Doré et Pourpre', 'M', 2), ...mk('Doré et Orchidée', 'F', 2), ...mk('Doré', 'M', 3), ...mk('Pourpre', 'F', 3)];
    const p = planGeneration('muldo', dd, R, ['Roux', 'Amande']);
    expect(p.lots[0]).toMatchObject({ m: n('Doré et Pourpre'), f: n('Doré et Orchidée'), n: 2, bebe: 'Roux', role: 'atteint' });
    expect(p.lots[1]).toMatchObject({ m: 'Doré', f: 'Pourpre', n: 3 });
  });

  it('équilibre les deux moitiés d’une recette, en comptant les fertiles déjà en élevage', () => {
    // 4 Doré et Orchidée déjà en élevage : il faut d'abord des Doré et Pourpre
    const dd = [...mk('Doré et Orchidée', 'M', 4, 'fertile'), ...mk('Doré', 'M', 6), ...mk('Orchidée', 'F', 6), ...mk('Pourpre', 'F', 6)];
    const p = planGeneration('muldo', dd, R, ['Roux']);
    expect(lotsDe(p)).toEqual({ 'Doré × Pourpre': 5, 'Doré × Orchidée': 1 });
  });

  it('préfère une moitié de recette visée, puis épuise le stock avec d’autres bicolores, et liste le reste', () => {
    const p = planGeneration('muldo', [...mk('Indigo', 'M', 3), ...mk('Ebène', 'F', 2), ...mk('Doré', 'M', 2)], R, ['Roux']);
    expect(p.lots).toEqual([expect.objectContaining({ m: 'Doré', f: 'Ebène', n: 2, role: 'prepare', pour: 'Roux' })]);
    expect(p.restes).toEqual([{ c: 'Indigo', x: 'M', n: 3 }]);
    const q = planGeneration('muldo', [...mk('Indigo', 'M', 2), ...mk('Ebène', 'F', 2)], R, ['Roux']);
    expect(q.lots).toEqual([expect.objectContaining({ m: 'Indigo', f: 'Ebène', n: 2, role: 'epuise' })]);
  });

  it('une première monocolore de génération 3 ajoute la génération 5 aux cibles, sans retirer la 3', () => {
    expect(ciblesAuto('muldo', [...mk('Doré', 'M', 1), ...mk('Roux', 'F', 1)]).sort()).toEqual(['Amande', 'Ivoire', 'Roux', 'Turquoise']);
  });

  it('un même sexe sans partenaire reste en entier', () => {
    const p = planGeneration('muldo', [...mk('Doré', 'M', 15), ...mk('Pourpre', 'M', 4)], R, ['Roux']);
    expect(p.lots).toEqual([]);
    expect(p.restes).toEqual([{ c: 'Doré', x: 'M', n: 15 }, { c: 'Pourpre', x: 'M', n: 4 }]);
  });
});
