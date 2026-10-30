import { describe, expect, it } from 'vitest';
import { findColorIn, type Sex } from './colors';
import { conseilsSexe, estATester, gainReussite, nomsJeu, pistes, prixOptimakina, verdictOptimakina } from './conseils';
import { planGeneration } from './planGeneration';
import { recettes } from './recettes';
import { newMonture } from './stock';
import type { Monture, Prix } from './types';

const n = (c: string) => findColorIn('muldo', c)!.name;
const mk = (c: string, x: Sex, k: number, etat: 'feconde' | 'fertile' = 'feconde'): Monture[] =>
  Array.from({ length: k }, () => newMonture(n(c), x, undefined, undefined, { espece: 'muldo', etat }));
const R = recettes('muldo');
const PRIX: Prix = { ressource: { muldo: 20000 }, runes: {}, optimakina: {}, geneton: null };

describe('lot E : Optimakina', () => {
  it('seuils du cahier : 8 000 kamas pour G1 × G1 → G2, 4 000 pour G2 × G2 → G3', () => {
    expect(verdictOptimakina('muldo', { m: 'Doré', f: 'Pourpre', bebe: n('Doré et Pourpre'), gen: 2 }, PRIX).seuil).toBe(8000);
    expect(verdictOptimakina('muldo', { m: n('Doré et Pourpre'), f: n('Doré et Orchidée'), bebe: 'Roux', gen: 3 }, PRIX).seuil).toBe(4000);
  });
  it('les génétons comptent quand leur prix est connu, et seulement si le bébé dépasse ses parents', () => {
    expect(gainReussite('muldo', { m: 'Doré', f: 'Pourpre', bebe: n('Doré et Pourpre') }, { ...PRIX, geneton: 1000 }).genetons).toBe(4);
    expect(verdictOptimakina('muldo', { m: 'Doré', f: 'Pourpre', bebe: n('Doré et Pourpre'), gen: 2 }, { ...PRIX, geneton: 1000 }).seuil).toBe(8800);
  });
  it('prend l’Optimakina la moins chère de génération suffisante, et rend un verdict', () => {
    const prix: Prix = { ...PRIX, optimakina: { muldo: { 2: 12000, 3: 6000, 5: 3000 } } };
    expect(prixOptimakina(prix, 'muldo', 2)).toBe(3000);
    expect(prixOptimakina(prix, 'muldo', 6)).toBeNull();
    expect(verdictOptimakina('muldo', { m: n('Doré et Pourpre'), f: n('Doré et Orchidée'), bebe: 'Roux', gen: 3 }, prix).rentable).toBe(true);
    expect(verdictOptimakina('muldo', { m: 'Doré', f: 'Pourpre', bebe: n('Doré et Pourpre'), gen: 2 }, { ...PRIX, optimakina: { muldo: { 2: 12000 } } }).rentable).toBe(false);
  });
});

describe('lot E : sexes à cibler (Animakina)', () => {
  it('rien quand les sexes sont équilibrés', () => {
    const dd = [...mk('Doré', 'M', 5), ...mk('Orchidée', 'F', 5), ...mk('Pourpre', 'F', 5), ...mk('Doré', 'F', 5), ...mk('Orchidée', 'M', 5)];
    const p = planGeneration('muldo', dd, R, ['Roux']);
    expect(conseilsSexe('muldo', dd, p.lots, R, ['Roux'], 40)).toEqual([]);
  });
  it('15 ♂ Doré et Pourpre en attente sans ♀ Doré et Orchidée : Animakina ♀ sur le lot Doré × Orchidée', () => {
    const dd = [...mk('Doré et Pourpre', 'M', 15, 'fertile'), ...mk('Doré', 'M', 10), ...mk('Orchidée', 'F', 10)];
    const p = planGeneration('muldo', dd, R, ['Roux']);
    const c = conseilsSexe('muldo', dd, p.lots, R, ['Roux'], 40);
    expect(c[0]).toMatchObject({ sexe: 'F', attente: { c: n('Doré et Pourpre'), x: 'M', n: 15 }, pour: 'Roux' });
    expect(c[0].lot).toMatchObject({ m: 'Doré', f: 'Orchidée' });
    expect(c[0].accouplements).toBe(10); // 15 / 40 % = 38, plafonné aux 10 du lot
  });
});

describe('lot E : montures à tester', () => {
  it('un bébé sous la génération de ses parents est à tester, et reçoit un nom à la suite', () => {
    expect(estATester('muldo', 'Doré', n('Doré et Pourpre'), n('Doré et Orchidée'))).toBe(true);
    expect(estATester('muldo', n('Doré et Pourpre'), n('Doré et Pourpre'), n('Doré et Orchidée'))).toBe(false);
    const dd = [{ ...newMonture('Doré', 'M', undefined, undefined, { espece: 'muldo' }), nom: 'T-Dor-03' }];
    expect(nomsJeu('T', 'Doré', 2, dd)).toEqual(['T-Dor-04', 'T-Dor-05']);
    expect(nomsJeu('R', n('Doré et Pourpre'), 1, dd)).toEqual(['R-DorPou-01']);
  });
  it('propose des partenaires d’après ses parents', () => {
    const [pm] = mk('Doré et Pourpre', 'M', 1);
    const [pf] = mk('Doré et Orchidée', 'F', 1);
    const bebe = newMonture('Doré', 'M', pm, pf, { espece: 'muldo' });
    const dd = [bebe, ...mk('Doré et Indigo', 'F', 2)];
    const p = pistes('muldo', bebe, dd, R);
    expect(p.every((x) => x.vise === 'Roux' && x.sexe === 'F')).toBe(true);
    expect(p[0]).toMatchObject({ avec: n('Doré et Indigo'), dispo: 2 });
  });
});
