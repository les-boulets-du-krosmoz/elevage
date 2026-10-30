import { describe, expect, it } from 'vitest';
import { dureeNiveau, hms, lireSerenite, palierPour, simuler, VITESSES_DEFAUT } from './temps';

const V = VITESSES_DEFAUT;

describe('calculateur d’enclos : simulation de sérénité', () => {
  it('−4 200 au palier 4 : rester 00:17:20 (−40), passer 00:17:30 (0)', () => {
    expect(simuler(-4200, 40, 'rester')).toEqual({ pas: 104, secondes: 1040, valeur: -40, monte: true });
    expect(simuler(-4200, 40, 'passer')).toEqual({ pas: 105, secondes: 1050, valeur: 0, monte: true });
    expect(hms(1040)).toBe('00:17:20');
  });

  it('en positif, 0 compte encore comme positif : +4 200 reste jusqu’à 0 et passe à −40', () => {
    expect(simuler(4200, 40, 'rester')).toMatchObject({ pas: 105, valeur: 0, monte: false });
    expect(simuler(4200, 40, 'passer')).toMatchObject({ pas: 106, valeur: -40 });
  });

  it('rester et passer sont toujours séparés d’un pas, quel que soit le palier', () => {
    for (const v of V) for (const s of [-5000, -4321, -1, 0, 7, 1999, 5000]) {
      expect(simuler(s, v, 'passer')!.pas - simuler(s, v, 'rester')!.pas).toBe(1);
      const r = simuler(s, v, 'rester')!, p = simuler(s, v, 'passer')!;
      expect(Math.sign(r.valeur + 0.5)).toBe(Math.sign(s + 0.5));
      expect(Math.sign(p.valeur + 0.5)).toBe(-Math.sign(s + 0.5));
    }
  });

  it('déjà au plus près de 0 : rester demande 0 pas', () => {
    expect(simuler(-1, 10, 'rester')!.pas).toBe(0);
    expect(simuler(0, 10, 'rester')!.pas).toBe(0);
  });

  it('palier 1 : 2 000 points demandent 200 pas, soit 00:33:20', () => {
    expect(hms(simuler(-2001, 10, 'rester')!.secondes)).toBe('00:33:20');
  });

  it('lit les saisies du jeu et refuse le hors-bornes', () => {
    expect(lireSerenite('−4 200')).toBe(-4200);
    expect(lireSerenite('-4200')).toBe(-4200);
    expect(lireSerenite('4 200')).toBe(4200);
    expect(lireSerenite('5001')).toBeNull();
    expect(lireSerenite('abc')).toBeNull();
  });
});

describe('calculateur de niveau', () => {
  it('donne une durée qui baisse avec le palier, et le palier minimal pour un délai', () => {
    const p1 = dureeNiveau(1, 100, 1, V), p4 = dureeNiveau(1, 100, 4, V);
    expect(p1 / p4).toBeCloseTo(4);
    expect(p4 / 3600).toBeCloseTo(12, 0); // 172 668 XP à 4 par seconde : environ 12 h
    expect(palierPour(1, 100, p1, V)).toBe(1);
    expect(palierPour(1, 100, p1 / 2 + 1, V)).toBe(2);
    expect(palierPour(1, 200, 60, V)).toBeNull();
  });
});
