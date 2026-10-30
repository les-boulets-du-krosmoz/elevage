import { describe, expect, it } from 'vitest';
import { colorsOf, findColorIn } from './colors';
import { filesParents, destinationDe, REGLES_DEFAUT, type RegleParent } from './destinations';
import { NB_BRUT, RECETTES_DPLN, recettes, memePaire } from './recettes';
import { newMonture } from './stock';

describe('lot C : recettes DPLN', () => {
  it('aucune recette perdue en route : chaque nom se résout dans l’espèce', () => {
    for (const e of ['muldo', 'volkorne'] as const) {
      for (const [c, brut] of Object.entries(NB_BRUT[e])) {
        const nom = findColorIn(e, c)!.name;
        expect(RECETTES_DPLN[e]![nom], `${e} ${c}`).toHaveLength(brut.length);
      }
    }
  });

  it('chaque recette est un couple de deux bicolores plus jeunes, dont une de la génération précédente', () => {
    // Exemple DPLN : Volkorne Jade (G9) = Doré et Pourpre (G8) + Prune et Emeraude (G6)
    for (const e of ['muldo', 'volkorne'] as const) {
      for (const [c, list] of Object.entries(RECETTES_DPLN[e]!)) {
        const g = findColorIn(e, c)!.gen;
        for (const [a, b] of list) {
          expect(a).not.toBe(b);
          const cols = [a, b].map((p) => findColorIn(e, p)!);
          expect(cols.every((x) => x.parts.length === 2 && x.gen < g), `${e} ${c} : ${a} + ${b}`).toBe(true);
          expect(cols.some((x) => x.gen === g - 1), `${e} ${c} : ${a} + ${b}`).toBe(true);
        }
      }
    }
  });

  it('toutes les monocolores à partir de la génération 3 ont des recettes', () => {
    for (const e of ['muldo', 'volkorne'] as const) {
      const r = recettes(e);
      for (const c of colorsOf(e)) if (c.parts.length === 1 && c.gen >= 3) expect(r[c.name]?.length, `${e} ${c.name}`).toBeGreaterThan(0);
    }
    expect(RECETTES_DPLN.muldo!.Roux).toHaveLength(6);
    expect(RECETTES_DPLN.muldo!.Amande).toHaveLength(3);
    expect(RECETTES_DPLN.volkorne!.Prune).toHaveLength(12);
  });

  it('les bicolores de Kevin sont bien des recettes du Roux et de l’Amande', () => {
    const n = (s: string) => findColorIn('muldo', s)!.name;
    expect(RECETTES_DPLN.muldo!.Roux.some((p) => memePaire(p, [n('Doré et Orchidée'), n('Doré et Pourpre')]))).toBe(true);
    expect(RECETTES_DPLN.muldo!.Amande.some((p) => memePaire(p, [n('Indigo et Pourpre'), n('Ebène et Orchidée')]))).toBe(true);
  });

  it('une bicolore a ses deux monocolores pour recette ; une recette modifiée remplace DPLN', () => {
    const r = recettes('muldo', { muldo: { Roux: [['Doré et Pourpre', 'Doré et Indigo']] } });
    const bi = findColorIn('muldo', 'Doré et Pourpre')!.name;
    expect(r[bi]).toHaveLength(1);
    expect(r.Roux).toHaveLength(1);
    expect(r['Doré']).toBeUndefined();
  });
});

describe('lot C : destination des parents', () => {
  const m = (c: string, e: 'muldo' | 'volkorne' | 'dragodinde') => newMonture(c, 'M', undefined, undefined, { espece: e });
  it('par défaut : génération 1 à briser, muldos et volkornes à extraire, dragodindes à vendre', () => {
    expect(destinationDe(m('Doré', 'muldo'), REGLES_DEFAUT)).toBe('briser');
    expect(destinationDe(m('Doré et Pourpre', 'muldo'), REGLES_DEFAUT)).toBe('extraire');
    expect(destinationDe(m('Roux', 'volkorne'), REGLES_DEFAUT)).toBe('extraire');
    expect(destinationDe(m('Amande', 'dragodinde'), REGLES_DEFAUT)).toBe('vendre');
    expect(destinationDe(m('Amande et Dorée', 'dragodinde'), REGLES_DEFAUT)).toBe('vendre');
  });

  it('la première règle qui correspond l’emporte ; le jeu corrige ce qui est impossible', () => {
    const regles: RegleParent[] = [
      { id: 'a', espece: 'muldo', type: 'bi', de: 2, a: 2, destination: 'garder' },
      { id: 'b', espece: '*', type: '*', de: 1, a: 10, destination: 'extraire' },
    ];
    expect(destinationDe(m('Doré et Pourpre', 'muldo'), regles)).toBe('garder');
    expect(destinationDe(m('Roux', 'muldo'), regles)).toBe('extraire');
    expect(destinationDe(m('Doré', 'muldo'), regles)).toBe('briser'); // une génération 1 ne s'extrait pas
    expect(destinationDe(m('Amande', 'dragodinde'), [{ ...regles[1], destination: 'briser' }])).toBe('vendre'); // une dragodinde ne se brise pas
    expect(destinationDe(m('Roux', 'muldo'), [])).toBe('vendre');
  });

  it('un accouplement remplit les files et se résume', () => {
    const f = filesParents([m('Doré et Pourpre', 'muldo'), m('Doré', 'muldo')], REGLES_DEFAUT);
    expect(f.extract).toEqual([{ espece: 'muldo', couleur: findColorIn('muldo', 'Doré et Pourpre')!.name, delta: 1 }]);
    expect(f.queue).toEqual([{ espece: 'muldo', couleur: 'Doré', delta: 1 }]);
    expect(f.resume).toBe('1 à extraire, 1 à briser');
    expect(filesParents([m('Amande', 'dragodinde')], REGLES_DEFAUT)).toEqual({ queue: [], extract: [], resume: '' });
  });
});
