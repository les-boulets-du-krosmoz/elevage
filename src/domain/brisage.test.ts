import { describe, expect, it } from 'vitest';
import { chercherRunes, objectifRunes, runeOfficielle, TOUTES_RUNES, valeurSession } from './brisage';
import type { BreakSession } from './types';

const session = (mounts: number, runes: Record<string, number>, level = 1): BreakSession =>
  ({ id: String(Math.random()), date: '2026-10-26', species: 'volkorne', level, mounts, runes, created: 1 });

describe('brisage v2 : runes', () => {
  it('connaît toutes les runes de forgemagie et retrouve leur nom officiel', () => {
    expect(TOUTES_RUNES.length).toBeGreaterThan(100);
    expect(runeOfficielle('rune ré per air')).toBe('Ré Per Air');
    expect(runeOfficielle('Ga Pme')).toBe('Ga PM');
    expect(runeOfficielle('Ga Pa')).toBe('Ga PA');
    expect(runeOfficielle('Bidule')).toBeNull();
  });
  it('cherche par nom : ce qui commence par la saisie d’abord', () => {
    const r = chercherRunes('vi');
    expect(r[0]).toBe('Vi');
    expect(r).toContain('Pa Vi');
    expect(chercherRunes('ré per')).toContain('Ré Per Air');
    expect(chercherRunes('')).toEqual([]);
  });
});

describe('brisage v2 : objectif et valeur', () => {
  it('exemple du cahier : 100 Ga PA à 0,295 par volkorne → 339, entre 271 et 407', () => {
    const o = objectifRunes([session(1000, { 'Ga PA': 295 })], 'volkorne', 'Ga PA', 100, null)!;
    expect([o.montures, o.min, o.max, o.fragile]).toEqual([339, 271, 407, false]);
  });
  it('rendement par niveau, fragile sous 5 runes, rien sans rune obtenue', () => {
    const l = [session(100, { 'Ga PA': 4 }, 1), session(100, { 'Ga PA': 10 }, 50)];
    expect(objectifRunes(l, 'volkorne', 'Ga PA', 10, 1)!.fragile).toBe(true);
    expect(objectifRunes(l, 'volkorne', 'Ga PA', 10, 50)!.montures).toBe(100);
    expect(objectifRunes(l, 'volkorne', 'Vi', 10, null)).toBeNull();
  });
  it('valeur d’une session avec les prix connus, et les runes sans prix', () => {
    const v = valeurSession(session(100, { 'Ga PA': 3, Cha: 200 }), { 'Ga PA': 50000 });
    expect(v).toEqual({ kamas: 150000, parMonture: 1500, manquants: ['Cha'] });
  });
});
