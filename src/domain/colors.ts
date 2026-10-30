/**
 * Données de jeu : les 66 couleurs de dragodindes (Dofus 3.5) et leurs recettes.
 * - une monocolore de génération impaire ≥ 3 s'obtient en croisant deux bicolores précises ;
 * - une bicolore « X et Y » s'obtient en croisant les monocolores X et Y.
 */
export type Sex = 'M' | 'F';
export type Espece = 'dragodinde' | 'volkorne' | 'muldo';

export interface Color {
  espece: Espece;
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
  ...Object.entries(MONO).map(([name, { gen }]): Color => ({ espece: 'dragodinde', name, gen, parts: [name], recipe: MONO_RECIPE[name] ?? null })),
  ...Object.entries(BI).flatMap(([gen, names]) =>
    names.map((name): Color => {
      const parts = name.split(' et ') as [string, string];
      return { espece: 'dragodinde', name, gen: Number(gen), parts, recipe: parts };
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

export const colorIndex = (c: Color) => colorsOf(c.espece).indexOf(c);

/** Fond CSS d'une pastille : plein pour une monocolore, moitié-moitié pour une bicolore. */
export function swatchBackground(name: string): string | null {
  if (!name) return null;
  const hex = name.split(/\s+et\s+/).map((p) => HEX[norm(p)]);
  if (!hex.length || hex.some((h) => !h)) return null;
  const [a, b] = hex;
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

/* ---------- Volkornes et muldos ----------
 * Données de jeu (couleurs et générations), d'après Dofus pour les Noobs, à vérifier dans l'interface Génétique.
 * Règle commune aux trois espèces : chaque monocolore de génération impaire g se croise avec toutes les
 * monocolores de génération ≤ g pour former les bicolores de la génération g + 1.
 * Les croisements des monocolores (plusieurs possibles par couleur) arrivent avec le lot 7.
 */
const OTHER_MONOS: Record<Exclude<Espece, 'dragodinde'>, [string, number][]> = {
  volkorne: [['Pourpre', 1], ['Orchidée', 1], ['Indigo', 1], ['Ebène', 1], ['Amande', 3], ['Roux', 3], ['Ivoire', 3], ['Turquoise', 3],
    ['Prune', 5], ['Emeraude', 5], ['Doré', 7], ['Jade', 9], ['Rubis', 9], ['Saphir', 9], ['Améthyste', 9]],
  muldo: [['Doré', 1], ['Pourpre', 1], ['Orchidée', 1], ['Indigo', 1], ['Ebène', 1], ['Roux', 3], ['Amande', 3], ['Ivoire', 5], ['Turquoise', 5],
    ['Prune', 7], ['Emeraude', 7], ['Ambre', 9], ['Corail', 9], ['Azur', 9], ['Aigue-marine', 9]],
};

const HEX: Record<string, string> = Object.fromEntries(Object.entries({
  ...Object.fromEntries(Object.entries(MONO).map(([n, v]) => [n, v.hex])),
  Roux: '#B4532F', Doré: '#E0B33A', Jade: '#4FA36B', Rubis: '#B3123E', Saphir: '#1F4FB0', Améthyste: '#8B5FBF',
  Ambre: '#D98E1F', Corail: '#F0775D', Azur: '#3FA9F5', 'Aigue-marine': '#6FD3C7',
}).map(([n, h]) => [norm(n), h]));

function buildSpecies(espece: Exclude<Espece, 'dragodinde'>): Color[] {
  const monos = OTHER_MONOS[espece];
  const out: Color[] = monos.map(([name, gen]) => ({ espece, name, gen, parts: [name], recipe: null }));
  for (const [x, gx] of monos) {
    if (gx % 2 === 0) continue;
    for (const [y, gy] of monos) {
      if (y === x || gy > gx || (gy === gx && monos.findIndex((m) => m[0] === y) < monos.findIndex((m) => m[0] === x))) continue;
      out.push({ espece, name: `${x} et ${y}`, gen: gx + 1, parts: [x, y], recipe: [x, y] });
    }
  }
  return out.sort((a, b) => a.gen - b.gen || out.indexOf(a) - out.indexOf(b));
}

export const SPECIES_COLORS: Record<Espece, Color[]> = {
  dragodinde: COLORS,
  volkorne: buildSpecies('volkorne'),
  muldo: buildSpecies('muldo'),
};
const KEYS_BY_SPECIES: Record<Espece, Map<string, Color>> = Object.fromEntries(
  Object.entries(SPECIES_COLORS).map(([e, list]) => [e, new Map(list.map((c) => [keyOf(c.parts), c]))]),
) as Record<Espece, Map<string, Color>>;

export const colorsOf = (espece: Espece) => SPECIES_COLORS[espece];

/** Comme findColor, pour n'importe quelle espèce. */
export function findColorIn(espece: Espece, input: string | null | undefined): Color | null {
  if (!input) return null;
  const parts = input.split(/\s+et\s+|\s*[/&+]\s*/i).filter(Boolean);
  return KEYS_BY_SPECIES[espece].get(keyOf(parts)) ?? null;
}

export const SPECIES_LABEL: Record<Espece, string> = { dragodinde: 'Dragodindes', volkorne: 'Volkornes', muldo: 'Muldos' };
