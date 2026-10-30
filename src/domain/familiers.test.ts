import { describe, expect, it } from 'vitest';
import { niveauPour, quantitePour, simuler, TOUS_FAMILIERS, typeObtention, valeurBonus, xpLot, xpPour } from './familiers';

const fam = (n: string) => TOUS_FAMILIERS.find((f) => f.nom === n)!;

describe('familiers : données', () => {
  it('tous les familiers ont un nom unique et au moins un bonus lisible', () => {
    expect(TOUS_FAMILIERS.length).toBeGreaterThanOrEqual(138);
    expect(new Set(TOUS_FAMILIERS.map((f) => f.nom)).size).toBe(TOUS_FAMILIERS.length);
    for (const f of TOUS_FAMILIERS) expect(f.bonus.length, f.nom).toBeGreaterThan(0);
    expect(fam('El Scarador').bonus).toHaveLength(6);
    expect(fam("Bwak d'Air").bonus[0]).toEqual({ stat: 'Résistance Air', max: 25, pct: true, palier: false });
  });
  it('classe l’obtention : offrande sur la carte, quête, monnaie, autre', () => {
    expect(fam('Abra Kadabra').type).toBe('offrande');
    expect(fam('Nomoon').type).toBe('quete');
    expect(fam('Molosk').type).toBe('quete');
    expect(fam('Brûlih').type).toBe('monnaie');
    expect(fam('Chienchien').type).toBe('autre');
    expect(typeObtention('[1,1] 5 Laine', 'Quête : X')).toBe('quete');
  });
});

describe('familiers : bonus selon le niveau', () => {
  it('10 % au niveau 1, puis le niveau en pourcentage, arrondi à l’inférieur', () => {
    const p = fam('Bloalak').bonus[0];
    expect([valeurBonus(p, 0), valeurBonus(p, 1), valeurBonus(p, 9), valeurBonus(p, 50), valeurBonus(p, 100)]).toEqual([0, 12, 12, 60, 120]);
    expect(valeurBonus(fam("Bwak d'Air").bonus[0], 50)).toBe(12);
  });
  it('PA, PM, Portée et Invocations n’arrivent qu’au niveau 80', () => {
    const pa = fam('Fëanor').bonus.find((b) => b.stat === 'PA')!;
    expect([valeurBonus(pa, 1), valeurBonus(pa, 79), valeurBonus(pa, 80)]).toEqual([0, 0, 1]);
  });
});

describe('familiers : expérience', () => {
  it('360 croquettes enrichies mènent du niveau 0 au niveau 100', () => {
    expect(xpPour(100)).toBe(179592);
    expect(simuler(0, [{ nom: 'Croquette', xp: 500, quantite: 360 }]).arrivee).toBe(100);
    expect(simuler(0, [{ nom: 'Croquette', xp: 500, quantite: 359 }]).arrivee).toBe(99);
    expect(niveauPour(1882)).toBe(50);
  });
  it('le jeu arrondit chaque lot à l’inférieur : 100 Roses des sables à 1,25 donnent 125 XP', () => {
    expect(xpLot(1.25, 100)).toBe(125);
    expect(xpLot(1.25, 1)).toBe(1);
    expect(quantitePour(125, 1.25)).toBe(100);
    expect(quantitePour(126, 1.25)).toBe(101);
  });
  it('compte l’XP déjà gagnée dans le niveau et le coût', () => {
    const s = simuler(50, [{ nom: 'X', xp: 2, quantite: 100, prix: 30 }], 50);
    expect(s.xpDepart).toBe(1753);
    expect(s.cout).toBe(3000);
    expect(s.arrivee).toBe(51);
  });
});

import { aVerifier, fourchette, fusionner, lireTable, pasSansPerte, perteArrondi, quantiteSansPerte, verifier } from './familiers';

describe('familiers : pertes d’arrondi', () => {
  it('quantité sans perte selon les décimales', () => {
    expect([pasSansPerte(1.25), pasSansPerte(0.5), pasSansPerte(1.3), pasSansPerte(2), pasSansPerte(1.59), pasSansPerte(0.125)]).toEqual([4, 2, 10, 1, 100, 8]);
  });
  it('perte théorique d’un lot et quantité ajustée', () => {
    expect(perteArrondi(1.25, 99)).toBe(0.75);
    expect(perteArrondi(1.25, 100)).toBe(0);
    expect(quantiteSansPerte(1.25, 99)).toBe(96);
    expect(quantiteSansPerte(1.59, 50)).toBe(0);
    expect(simuler(0, [{ nom: 'Rose', xp: 1.25, quantite: 99 }, { nom: 'Eau', xp: 0.5, quantite: 3 }]).perte).toBe(1.25);
  });
});

describe('familiers : table de ressources collée', () => {
  it('lit tabulations, points-virgules, barres et espaces ; ignore les en-têtes', () => {
    const t = lireTable('Nom de la Ressource\tXP Donné\tQuantité\nRose des sables\t1,25\t1\nEau calme ; 0,5\nPeau de Maho Firefoux | 1.59 | 1\nOs de Fantôme Pandore   1,3\n\nligne cassée');
    expect(t.ressources.map((r) => [r.nom, r.xp, r.fiabilite])).toEqual([
      ['Rose des sables', 1.25, 'fiable'], ['Eau calme', 0.5, 'fiable'], ['Peau de Maho Firefoux', 1.59, 'fiable'],
      ['Os de Fantôme Pandore', 1.3, 'fiable'], ['ligne cassée', 0, 'inconnue'],
    ]);
    expect(t.ignorees).toBe(1);
  });
  it('la quantité divise l’XP : 1 XP pour 3 Pinces vaut 0,33 par pince, à vérifier ; 1 pour 11 Runes Age est peu rentable', () => {
    const t = lireTable('Ressource\tExpérience\tQuantitée\nRune Ga Pa\t500\t1\nPince de Crabe Hijacob\t1\t3\nRune Age\t1\t11\nRune Pa Pui\t1\t\nGraine de Sésame\t1\t?\nPépite\t1,25\t1\nSoie chatoyante\t0\t1\nMuseau de Rat Luisant\t?\t\nCervelle de Courtilieur\t?\t1').ressources;
    expect(t.map((r) => [r.nom, r.fiabilite])).toEqual([
      ['Rune Ga Pa', 'fiable'], ['Pince de Crabe Hijacob', 'approximative'], ['Rune Age', 'peu-rentable'], ['Rune Pa Pui', 'approximative'],
      ['Graine de Sésame', 'approximative'], ['Pépite', 'fiable'], ['Soie chatoyante', 'inconnue'], ['Museau de Rat Luisant', 'inconnue'], ['Cervelle de Courtilieur', 'inconnue'],
    ]);
    expect(t[1].xp).toBe(0.3333);
    expect(fourchette(t[1])).toEqual([1 / 3, 2 / 3]);
    expect(t[2].xp).toBe(0.0909);
    expect(t.filter(aVerifier)).toHaveLength(6);
  });
  it('une valeur vérifiée en jeu n’est pas écrasée par une nouvelle table', () => {
    const b = verifier([{ nom: 'Pince de Crabe Hijacob', xp: 0.3333, fiabilite: 'approximative', xpTable: 1, quantite: 3 }], 'Pince de Crabe Hijacob', 0.5);
    expect(b).toEqual([{ nom: 'Pince de Crabe Hijacob', xp: 0.5, fiabilite: 'verifiee', xpTable: 0.5, quantite: 1 }]);
    expect(fusionner(b, [{ nom: 'pince de crabe hijacob', xp: 0.3333, fiabilite: 'approximative' }])[0].xp).toBe(0.5);
  });
  it('une nouvelle valeur remplace l’ancienne, sans tenir compte des accents', () => {
    const b = fusionner([{ nom: 'Eau calme', xp: 0.4 }], [{ nom: 'eau Calme', xp: 0.5 }, { nom: 'Ambre', xp: 1 }]);
    expect(b).toEqual([{ nom: 'Ambre', xp: 1 }, { nom: 'eau Calme', xp: 0.5 }]);
  });
});

import { TABLE_RESSOURCES } from './ressourcesFamiliers';

describe('familiers : table intégrée', () => {
  it('se lit en entier, avec les valeurs attendues', () => {
    const t = lireTable(TABLE_RESSOURCES);
    expect(t.ignorees).toBe(0);
    expect(t.ressources.length).toBeGreaterThan(1000);
    const r = (n: string) => t.ressources.find((x) => x.nom === n)!;
    expect([r('Rune Ga Pa').xp, r('Rune Ga Pa').fiabilite]).toEqual([500, 'fiable']);
    expect([r('Pépite').xp, r('Os de Fantôme Pandore').xp, r('Peau de Maho Firefoux').xp]).toEqual([1.25, 1.3, 1.59]);
    expect(r('Pince de Crabe Hijacob').fiabilite).toBe('approximative');
    expect(r('Plume de Piou Bleu').fiabilite).toBe('peu-rentable');
    expect(r('Museau de Rat Luisant').fiabilite).toBe('inconnue');
    expect(r('Graine de Sésame').fiabilite).toBe('approximative');
  });
});

import { comparer, trierFavoris, type Favori } from './familiers';

describe('familiers : favoris et rentabilité', () => {
  const favoris: Favori[] = [
    { nom: 'Croquette enrichie', xp: 500, valeur: 4000 },
    { nom: 'Rose des sables', xp: 1.25, valeur: 5 },
    { nom: 'Pince de Crabe Hijacob', xp: 1 / 3, valeur: 1, fiabilite: 'approximative', plage: [1 / 3, 2 / 3] },
    { nom: 'Galet acajou', xp: 1250 },
  ];
  it('coût d’un point d’XP et coût pour l’XP visée, arrondi compris', () => {
    expect(comparer(favoris[0], 1000)).toMatchObject({ coutXp: 8, quantite: 2, cout: 8000 });
    expect(comparer(favoris[1], 1000)).toMatchObject({ coutXp: 4, quantite: 800, cout: 4000 });
    expect(comparer(favoris[2], 1000)).toMatchObject({ coutXpMin: 1.5, coutXpMax: 3 });
    expect(comparer(favoris[3], 1000)).toMatchObject({ coutXp: null, cout: null, quantite: 1 });
  });
  it('trie par rentabilité, valeur ou gain d’XP ; sans valeur en dernier', () => {
    expect(trierFavoris(favoris, 'rentabilite', 1000).map((f) => f.nom)).toEqual(['Pince de Crabe Hijacob', 'Rose des sables', 'Croquette enrichie', 'Galet acajou']);
    expect(trierFavoris(favoris, 'prix', 1000).map((f) => f.nom)).toEqual(['Pince de Crabe Hijacob', 'Rose des sables', 'Croquette enrichie', 'Galet acajou']);
    expect(trierFavoris(favoris, 'xp', 1000).map((f) => f.nom)).toEqual(['Galet acajou', 'Croquette enrichie', 'Rose des sables', 'Pince de Crabe Hijacob']);
  });
});
