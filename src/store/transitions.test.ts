import { describe, expect, it } from 'vitest';
import { newMonture } from '../domain/stock';
import type { EtableState } from '../domain/types';
import { defaultSettings, emptyExtract, emptyQueue } from './storage';
import { applyAct, applyImport, applyUndo } from './transitions';

const empty = (): EtableState => ({ dd: [], history: [], settings: defaultSettings(), breaks: [], queue: emptyQueue(), extract: emptyExtract() });

describe('transitions de l’état', () => {
  it('une action puis son annulation rendent l’état de départ', () => {
    const a = newMonture('Amande', 'M');
    const s1 = applyAct(empty(), 'ajout', '1 Amande', { add: [a] });
    expect(s1.state.dd).toHaveLength(1);
    const s2 = applyUndo(s1.state, s1.entry.id);
    expect(s2.ok && s2.state.dd).toEqual([]);
    expect(s2.ok && s2.state.history[0].undone).toBe(true);
  });

  it('annuler une modification remet la monture d’origine au lieu de la supprimer', () => {
    const a = newMonture('Amande', 'M');
    const s1 = applyAct(empty(), 'ajout', '1 Amande', { add: [a] });
    const s2 = applyAct(s1.state, 'ajout', '→ féconde', { del: [a], add: [{ ...a, etat: 'feconde' }] });
    const r = applyUndo(s2.state, s2.entry.id);
    expect(r.ok && r.state.dd).toEqual([a]);
  });

  it('signale les montures déjà utilisées depuis', () => {
    const baby = newMonture('Amande et Dorée', 'F');
    const s1 = applyAct(empty(), 'ajout', 'bébé', { add: [baby] });
    const s2 = applyAct(s1.state, 'retrait', 'utilisée', { del: [baby] });
    const r = applyUndo(s2.state, s1.entry.id);
    expect(r.ok && r.gone).toBe(1);
  });

  it('refuse d’annuler une action allégée', () => {
    const s1 = applyAct(empty(), 'ajout', 'x', { add: [newMonture('Amande', 'M')] });
    const pruned = { ...s1.state, history: [{ ...s1.entry, added: [], pruned: true }] };
    expect(applyUndo(pruned, s1.entry.id)).toEqual({ ok: false, reason: 'trop-ancienne' });
  });

  it('l’import en fusion ignore ce qui est déjà présent', () => {
    const a = newMonture('Amande', 'M');
    const s1 = applyAct(empty(), 'ajout', 'x', { add: [a] });
    const r = applyImport(s1.state, { dd: [a, newMonture('Dorée', 'F')] }, 'fusion');
    expect(r.state.dd).toHaveLength(2);
    expect(r.label).toBe('Import : 1 monture (1 déjà présente, ignorée)');
  });
});
