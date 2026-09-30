import { findColor, treeColors, type Sex } from './colors';
import type { Dragodinde } from './types';

export type StockCount = Record<string, number>;
export const key = (color: string, sex: Sex) => `${color}|${sex}`;

/** Compte les DD par « couleur|sexe ». */
export function countStock(dd: Iterable<Dragodinde>): StockCount {
  const s: StockCount = {};
  for (const d of dd) {
    const c = findColor(d.couleur);
    if (c) s[key(c.name, d.sexe)] = (s[key(c.name, d.sexe)] ?? 0) + 1;
  }
  return s;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

export function newDD(couleur: string, sexe: Sex, pm?: Dragodinde, pf?: Dragodinde): Dragodinde {
  return {
    id: uid(),
    couleur,
    sexe,
    pere: pm?.couleur ?? '',
    mere: pf?.couleur ?? '',
    gp: [pm?.pere ?? '', pm?.mere ?? '', pf?.pere ?? '', pf?.mere ?? ''],
    created: Date.now(),
  };
}

/** Part de l'arbre d'une DD dans les couleurs utiles : parents ×2, grands-parents ×1, sur 8. */
export function treeScore(d: Dragodinde, useful: Set<string>): number {
  const weighted: [string, number][] = [[d.pere, 2], [d.mere, 2], ...d.gp.map((c): [string, number] => [c, 1])];
  return weighted.reduce((s, [c, w]) => {
    const col = findColor(c);
    return col && useful.has(col.name) ? s + w : s;
  }, 0);
}

export const ancestry = (d: Dragodinde) =>
  d.pere || d.mere ? `issue de ${d.pere || '?'} × ${d.mere || '?'}` : 'origine inconnue';

/** Parent à consommer : le meilleur arbre pour la cible, puis le plus ancien. */
export function bestParent(dd: Dragodinde[], color: string, sex: Sex, target: string | null): Dragodinde | undefined {
  const useful = target ? treeColors(target) : new Set<string>();
  return dd
    .filter((d) => findColor(d.couleur)?.name === color && d.sexe === sex)
    .sort((a, b) => treeScore(b, useful) - treeScore(a, useful) || a.created - b.created)[0];
}

/** Normalise une DD venant d'un import (anciens exports compris). */
export function sanitize(x: unknown): Dragodinde | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const c = findColor(typeof o.couleur === 'string' ? o.couleur : '');
  if (!c) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const gp = Array.isArray(o.gp) ? o.gp.map(str) : [];
  return {
    id: str(o.id) || uid(),
    couleur: c.name,
    sexe: o.sexe === 'F' ? 'F' : 'M',
    pere: str(o.pere),
    mere: str(o.mere),
    gp: [gp[0] ?? '', gp[1] ?? '', gp[2] ?? '', gp[3] ?? ''],
    created: typeof o.created === 'number' ? o.created : Date.now(),
  };
}
