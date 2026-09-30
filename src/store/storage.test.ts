import { describe, expect, it } from 'vitest';
import { parseBackup, toBackup } from './storage';

describe('import / export', () => {
  it('lit un ancien export (tableau de DD)', () => {
    const old = JSON.stringify([{ id: 'a', couleur: 'rousse et amande', sexe: 'F', statut: 'Fertile', niveau: 1, gp: ['', '', '', ''] }, { couleur: 'inconnue' }]);
    const r = parseBackup(old);
    expect(r.dd).toHaveLength(1);
    expect(r.dd![0].couleur).toBe('Amande et Rousse');
  });
  it('fait l’aller-retour d’une sauvegarde complète', () => {
    const state = { dd: [{ id: 'x', couleur: 'Ebène', sexe: 'M' as const, pere: '', mere: '', gp: ['', '', '', ''] as [string, string, string, string], created: 1 }], history: [], settings: { places: 12, target: 'Pourpre', journal: [] } };
    const r = parseBackup(toBackup(state));
    expect(r.dd).toEqual(state.dd);
    expect(r.settings?.places).toBe(12);
  });
  it('refuse un fichier qui n’est pas une sauvegarde', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow();
  });
});
