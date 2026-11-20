import { describe, expect, it } from 'vitest';
import { couleurDans, lireAccouplement, lireInventaire, nombres } from './voix';

const n = (s: string) => nombres(s.split(' ')).map((x) => x.valeur);

describe('voix : nombres', () => {
  it('chiffres et lettres', () => {
    expect(n('12')).toEqual([12]);
    expect(n('vingt et un')).toEqual([21]);
    expect(n('soixante dix sept')).toEqual([77]);
    expect(n('quatre vingt dix')).toEqual([90]);
    expect(n('deux cents trente')).toEqual([230]);
    expect(n('mille deux cents')).toEqual([1200]);
    expect(n('femelles une')).toEqual([1]);
  });
});

describe('voix : couleurs', () => {
  it('monocolore, bicolore dans les deux ordres, nom approché', () => {
    expect(couleurDans('muldo', 'doré')).toBe('Doré');
    expect(couleurDans('muldo', 'indigo et ébène')).toBe('Ébène et Indigo');
    expect(couleurDans('muldo', 'ebene indigo')).toBe('Ébène et Indigo');
    expect(couleurDans('muldo', 'orchidé')).toBe('Orchidée');
    expect(couleurDans('muldo', 'aigue marine')).toBe('Aigue-marine');
    expect(couleurDans('dragodinde', 'amande et dorée')).toBe('Amande et Dorée');
    expect(couleurDans('muldo', 'bidule')).toBeNull();
  });
});

describe('voix : inventaire', () => {
  it('lit couleur, sexes, total et file à briser', () => {
    expect(lireInventaire('muldo', 'Doré, 12 mâles, 5 femelles')).toEqual({ couleur: 'Doré', champs: { m: 12, f: 5 } });
    expect(lireInventaire('muldo', 'Ébène et Indigo total vingt femelles huit')).toEqual({ couleur: 'Ébène et Indigo', champs: { t: 20, f: 8 } });
    expect(lireInventaire('muldo', 'orchidée femelles trois')).toEqual({ couleur: 'Orchidée', champs: { f: 3 } });
    expect(lireInventaire('muldo', 'pourpre 14')).toEqual({ couleur: 'Pourpre', champs: { t: 14 } });
    expect(lireInventaire('muldo', 'doré à briser 6')).toEqual({ couleur: 'Doré', champs: { b: 6 } });
    expect(lireInventaire('muldo', 'annuler')).toEqual({ commande: 'annuler' });
    expect(lireInventaire('muldo', 'valider')).toEqual({ commande: 'valider' });
    expect(lireInventaire('muldo', 'il pleut')).toBeNull();
  });
});

describe('voix : accouplement', () => {
  it('lot et bébé, bébé seul, jumeau, changement de lot, annuler', () => {
    expect(lireAccouplement('muldo', 'Doré avec Pourpre donne Doré et Pourpre femelle')).toEqual({ lot: { m: 'Doré', f: 'Pourpre' }, bebes: [{ c: 'Doré et Pourpre', x: 'F' }], jumeau: false });
    expect(lireAccouplement('muldo', 'Roux mâle')).toEqual({ bebes: [{ c: 'Roux', x: 'M' }], jumeau: false });
    expect(lireAccouplement('muldo', 'Doré et Pourpre femelle et Doré mâle')).toEqual({ bebes: [{ c: 'Doré et Pourpre', x: 'F' }, { c: 'Doré', x: 'M' }], jumeau: false });
    expect(lireAccouplement('muldo', 'jumeau Doré mâle')).toEqual({ bebes: [{ c: 'Doré', x: 'M' }], jumeau: true });
    expect(lireAccouplement('muldo', 'Indigo avec Pourpre')).toEqual({ lot: { m: 'Indigo', f: 'Pourpre' }, bebes: [], jumeau: false });
    expect(lireAccouplement('muldo', 'annuler')).toEqual({ commande: 'annuler' });
    expect(lireAccouplement('muldo', 'bonjour')).toBeNull();
  });
});
