/**
 * Données de jeu : les 66 couleurs de dragodindes (Dofus 3.5) et leurs recettes.
 * - une monocolore de génération impaire ≥ 3 s'obtient en croisant deux bicolores précises ;
 * - une bicolore « X et Y » s'obtient en croisant les monocolores X et Y.
 */
export type Sex = 'M' | 'F';

export interface Color {
  name: string;
  gen: number;
  /** Monocolores qui composent la couleur (1 ou 2). */
  parts: string[];
  /** Les deux couleurs parentes, ou null pour une génération 1 (capture). */
  recipe: [string, string] | null;
}

export const MONO: Record<string, { gen: number; hex: string }> = {
  Amande: { gen: 1, hex: '#D8BE93' },
  Dorée: { gen: 1, hex: '#E0B33A' },
  Rousse: { gen: 1, hex: '#B4532F' },
  Ebène: { gen: 3, hex: '#2E2A28' },
  Indigo: { gen: 3, hex: '#3C47A0' },
  Pourpre: { gen: 5, hex: '#7A2B68' },
  Orchidée: { gen: 5, hex: '#C47CC0' },
  Ivoire: { gen: 7, hex: '#EDE5CF' },
  Turquoise: { gen: 7, hex: '#2AA39B' },
  Emeraude: { gen: 9, hex: '#1E874A' },
  Prune: { gen: 9, hex: '#55203F' },
};

const MONO_RECIPE: Record<string, [string, string]> = {
  Ebène: ['Amande et Dorée', 'Dorée et Rousse'],
  Indigo: ['Amande et Dorée', 'Amande et Rousse'],
  Pourpre: ['Ebène et Indigo', 'Amande et Rousse'],
  Orchidée: ['Ebène et Indigo', 'Dorée et Rousse'],
  Ivoire: ['Orchidée et Pourpre', 'Indigo et Pourpre'],
  Turquoise: ['Orchidée et Pourpre', 'Ebène et Orchidée'],
  Emeraude: ['Ivoire et Turquoise', 'Ivoire et Pourpre'],
  Prune: ['Ivoire et Turquoise', 'Turquoise et Orchidée'],
};

/** Noms des bicolores tels qu'affichés en jeu, par génération. */
const BI: Record<number, string[]> = {
  2: ['Amande et Rousse', 'Dorée et Rousse', 'Amande et Dorée'],
  4: ['Indigo et Rousse', 'Ebène et Rousse', 'Amande et Indigo', 'Amande et Ebène', 'Dorée et Indigo', 'Dorée et Ebène', 'Ebène et Indigo'],
  6: ['Pourpre et Rousse', 'Orchidée et Rousse', 'Amande et Pourpre', 'Amande et Orchidée', 'Dorée et Pourpre', 'Dorée et Orchidée', 'Indigo et Pourpre', 'Indigo et Orchidée', 'Ebène et Pourpre', 'Ebène et Orchidée', 'Orchidée et Pourpre'],
  8: ['Ivoire et Rousse', 'Turquoise et Rousse', 'Amande et Ivoire', 'Amande et Turquoise', 'Dorée et Ivoire', 'Dorée et Turquoise', 'Indigo et Ivoire', 'Indigo et Turquoise', 'Ebène et Ivoire', 'Ebène et Turquoise', 'Ivoire et Pourpre', 'Turquoise et Pourpre', 'Ivoire et Orchidée', 'Turquoise et Orchidée', 'Ivoire et Turquoise'],
  10: ['Emeraude et Rousse', 'Prune et Rousse', 'Amande et Emeraude', 'Prune et Amande', 'Dorée et Emeraude', 'Prune et Dorée', 'Emeraude et Indigo', 'Prune et Indigo', 'Ebène et Emeraude', 'Prune et Ebène', 'Emeraude et Pourpre', 'Prune et Pourpre', 'Emeraude et Orchidée', 'Prune et Orchidée', 'Emeraude et Ivoire', 'Prune et Ivoire', 'Emeraude et Turquoise', 'Prune et Turquoise', 'Prune et Emeraude'],
};

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const keyOf = (parts: string[]) => parts.map(norm).sort().join('|');

export const COLORS: Color[] = [
  ...Object.entries(MONO).map(([name, { gen }]): Color => ({ name, gen, parts: [name], recipe: MONO_RECIPE[name] ?? null })),
  ...Object.entries(BI).flatMap(([gen, names]) =>
    names.map((name): Color => {
      const parts = name.split(' et ') as [string, string];
      return { name, gen: Number(gen), parts, recipe: parts };
    }),
  ),
].sort((a, b) => a.gen - b.gen || a.name.localeCompare(b.name, 'fr'));

const BY_KEY = new Map(COLORS.map((c) => [keyOf(c.parts), c]));

/** Retrouve une couleur en tolérant les accents manquants et l'ordre inversé des bicolores. */
export function findColor(input: string | null | undefined): Color | null {
  if (!input) return null;
  const parts = input.split(/\s+et\s+|\s*[/&+]\s*/i).filter(Boolean);
  return BY_KEY.get(keyOf(parts)) ?? null;
}

export const colorIndex = (c: Color) => COLORS.indexOf(c);

/** Fond CSS d'une pastille : plein pour une monocolore, moitié-moitié pour une bicolore. */
export function swatchBackground(name: string): string | null {
  const c = findColor(name);
  if (!c) return null;
  const [a, b] = c.parts.map((p) => MONO[p].hex);
  return b ? `linear-gradient(90deg,${a} 50%,${b} 50%)` : a;
}

/** Nombre de couples de chaque couleur nécessaires pour obtenir 1 DD de la cible. */
export function treeWeights(target: string): Map<string, number> {
  const w = new Map<string, number>();
  const go = (n: string, k: number) => {
    const c = findColor(n);
    if (!c?.recipe) return;
    w.set(c.name, (w.get(c.name) ?? 0) + k);
    c.recipe.forEach((r) => go(r, k));
  };
  go(target, 1);
  return w;
}

/** Toutes les couleurs présentes dans l'arbre d'une cible, génération 1 comprise. */
export function treeColors(target: string): Set<string> {
  const s = new Set<string>();
  const go = (n: string) => {
    const c = findColor(n);
    if (!c || s.has(c.name)) return;
    s.add(c.name);
    c.recipe?.forEach(go);
  };
  go(target);
  return s;
}

export const sexSymbol = (x: Sex) => (x === 'M' ? '♂' : '♀');
