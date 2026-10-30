import { describe, expect, it } from 'vitest';
import { parseBackup, toBackup } from './storage';

describe('import / export', () => {
  it('lit un ancien export (tableau de DD)', () => {
    const old = JSON.stringify([{ id: 'a', couleur: 'rousse et amande', sexe: 'F', statut: 'Fertile', niveau: 1, gp: ['', '', '', ''] }, { couleur: 'inconnue' }]);
    const r = parseBackup(old);
    expect(r.dd).toHaveLength(1);
    expect(r.dd![0].couleur).toBe('Amande et Rousse');
    // Migration v1 : fécondes ; la zone et l'enclos d'avant la v3 sont oubliés
    expect([r.dd![0].etat, r.dd![0].espece]).toEqual(['feconde', 'dragodinde']);
    expect(r.dd![0]).not.toHaveProperty('zone');
  });
  it('fait l’aller-retour d’une sauvegarde complète', () => {
    const state = { dd: [{ id: 'x', espece: 'dragodinde' as const, couleur: 'Ebène', sexe: 'M' as const, etat: 'feconde' as const, pere: '', mere: '', gp: ['', '', '', ''] as [string, string, string, string], created: 1 }], history: [], settings: { places: 12, nbEnclos: 1, sexItemPriceK: 10000, target: 'Pourpre', journal: [], vitesses: [10, 20, 30, 40], calc: { palier: 4 as const, simulations: {} }, regles: [], recettes: {}, cibles: {}, prix: { ressource: {}, runes: {}, optimakina: {}, geneton: null }, chanceBase: 40 }, breaks: [], queue: { volkorne: {}, muldo: {} }, extract: { dragodinde: {}, volkorne: {}, muldo: {} } };
    const r = parseBackup(toBackup(state));
    expect(r.dd).toEqual(state.dd);
    expect(r.settings?.places).toBe(12);
  });
  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow();
  });
});

import { capHistory } from './storage';
import type { HistoryEntry } from '../domain/types';
import { newMonture } from '../domain/stock';

describe('historique plafonné', () => {
  const entry = (i: number, n: number): HistoryEntry => ({
    id: 'h' + i, t: i, type: 'inventaire', label: 'x', added: Array.from({ length: n }, () => newMonture('Amande', 'M')), removed: [], jt: null, undone: false,
  });
  it('retire les copies des plus anciennes et garde la plus récente', () => {
    const list = [entry(1, 400), entry(2, 400), entry(3, 400)];
    const size = JSON.stringify(list).length;
    const out = capHistory(list, Math.floor(size * 0.6));
    expect(out[0].pruned).toBe(true);
    expect(out[2].pruned).toBeUndefined();
    expect(out[2].added).toHaveLength(400);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(Math.floor(size * 0.6));
  });
  it('ne touche à rien sous la limite', () => {
    const list = [entry(1, 3)];
    expect(capHistory(list)).toBe(list);
  });
});

import { normalizeSettings } from './storage';

describe('calculateur d’enclos : sauvegarde', () => {
  it('garde le palier et les simulations, écarte l’invalide, plafonne à 10', () => {
    const sims = Array.from({ length: 12 }, (_, i) => ({ id: 's' + i, serenite: -100 * i, le: 5, cible: 'passer' }));
    const s = normalizeSettings({ calc: { palier: 3, simulations: { 1: sims, 2: [{ id: 'x', serenite: 9000, le: 1, cible: 'nope' }] } } as never });
    expect(s.calc.palier).toBe(3);
    expect(s.calc.simulations[1]).toHaveLength(10);
    expect(s.calc.simulations[1][1]).toEqual({ id: 's1', serenite: -100, le: 5, cible: 'passer' });
    expect(s.calc.simulations[2][0]).toMatchObject({ serenite: null, cible: 'rester' });
    expect(normalizeSettings({ calc: { palier: 9 } as never }).calc.palier).toBe(4);
  });
  it('un ancien réglage d’enclos (v2) donne le nombre d’enclos, puis disparaît', () => {
    const s = normalizeSettings({ enclos: [{ id: 1, cote: '+' }, { id: 2, cote: null }] } as never);
    expect(s.nbEnclos).toBe(2);
    expect(s).not.toHaveProperty('enclos');
    expect(normalizeSettings({}).nbEnclos).toBe(6);
  });
});

import { applyExtract, emptyExtract, ressourcesExtraction, sanitizeRecettes, sanitizeRegles } from './storage';

describe('lot C : sauvegarde des règles, recettes et file à extraire', () => {
  it('écarte les règles et les recettes invalides', () => {
    const r = sanitizeRegles([{ espece: 'muldo', type: 'bi', de: 3, a: 1, destination: 'extraire' }, { destination: 'nope' }]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ espece: 'muldo', type: 'bi', de: 3, a: 3 });
    const rec = sanitizeRecettes({ muldo: { roux: [['Doré et Pourpre', 'Doré et Indigo'], ['Doré', 'Doré'], 'x'], Inconnue: [] } });
    expect(Object.keys(rec.muldo!)).toEqual(['Roux']);
    expect(rec.muldo!.Roux).toHaveLength(1);
  });
  it('la file à extraire ne descend pas sous zéro et compte une ressource par génération', () => {
    let q = applyExtract(emptyExtract(), [{ espece: 'muldo', couleur: 'Roux', delta: 2 }, { espece: 'muldo', couleur: 'Doré et Pourpre', delta: 1 }]);
    expect(ressourcesExtraction(q, 'muldo')).toBe(2 * 3 + 2);
    q = applyExtract(q, [{ espece: 'muldo', couleur: 'Roux', delta: -5 }]);
    expect(q.muldo).toEqual({ 'Doré et Pourpre': 1 });
  });
});
