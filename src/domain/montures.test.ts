import { describe, expect, it } from 'vitest';
import { colorsOf, findColor, findColorIn } from './colors';
import { MONTURES_OFFICIELLES } from './montures';
import { sanitize } from './stock';

describe('noms officiels du jeu', () => {
  it('chaque couleur de l’outil porte un nom de l’encyclopédie, avec son icône', () => {
    for (const e of ['dragodinde', 'volkorne', 'muldo'] as const) {
      const officiels = new Set(MONTURES_OFFICIELLES[e].map(([n]) => n));
      for (const c of colorsOf(e)) expect(officiels.has(c.name), `${e} ${c.name}`).toBe(true);
    }
  });
  it('ordre des couleurs et accents comme en jeu ; l’ancienne écriture reste comprise', () => {
    expect(findColorIn('muldo', 'Indigo et Ebène')!.name).toBe('Ébène et Indigo');
    expect(findColorIn('muldo', 'Amande et Doré')!.name).toBe('Doré et Amande');
    expect(findColor('Ebene')!.name).toBe('Ébène');
    expect(findColor('Pourpre')!.recipe).toEqual(['Ébène et Indigo', 'Amande et Rousse']);
  });
  it('une sauvegarde à l’ancienne écriture se relit au nom officiel', () => {
    expect(sanitize({ espece: 'muldo', couleur: 'Indigo et Ebène', sexe: 'F', etat: 'feconde' })?.couleur).toBe('Ébène et Indigo');
  });
});
