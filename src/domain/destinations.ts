import { findColorIn, type Espece } from './colors';
import type { BreakSpecies, ExtractDelta, Monture, QueueDelta } from './types';

/**
 * Après un accouplement, les deux parents sont stériles. Chacun part selon la première règle qui lui
 * correspond (espèce, type de couleur, génération) : file « À briser », file « À extraire », ou hors de l'outil.
 */
export type Destination = 'briser' | 'extraire' | 'cloner' | 'vendre' | 'garder';
export type TypeCouleur = 'mono' | 'bi' | '*';

export interface RegleParent {
  id: string;
  espece: Espece | '*';
  type: TypeCouleur;
  /** Générations concernées, bornes comprises (1 à 10). */
  de: number;
  a: number;
  destination: Destination;
}

export const DESTINATIONS: { id: Destination; label: string }[] = [
  { id: 'briser', label: 'À briser' },
  { id: 'extraire', label: 'À extraire' },
  { id: 'cloner', label: 'À cloner' },
  { id: 'vendre', label: 'À vendre' },
  { id: 'garder', label: 'À garder' },
];
export const destinationLabel = (d: Destination) => DESTINATIONS.find((x) => x.id === d)!.label;

/** Par défaut : génération 1 à briser (elle ne s'extrait pas), muldos et volkornes de génération 2 et plus à extraire, dragodindes revendues. */
export const REGLES_DEFAUT: RegleParent[] = [
  { id: 'defaut-g1', espece: '*', type: '*', de: 1, a: 1, destination: 'briser' },
  { id: 'defaut-mv', espece: 'muldo', type: '*', de: 2, a: 10, destination: 'extraire' },
  { id: 'defaut-vk', espece: 'volkorne', type: '*', de: 2, a: 10, destination: 'extraire' },
  { id: 'defaut-dd', espece: 'dragodinde', type: '*', de: 1, a: 10, destination: 'vendre' },
];

/** Raison pour laquelle une règle ne peut pas s'appliquer telle quelle, ou null. */
export function limiteRegle(r: RegleParent): string | null {
  if (r.destination === 'extraire' && r.de <= 1) return 'une génération 1 ne s’extrait pas : elle partira à briser';
  if (r.destination === 'briser' && r.espece === 'dragodinde') return 'les dragodindes ne se brisent pas : elles partiront à vendre';
  return null;
}

/** La règle qui s'applique à une monture (la première qui correspond). */
export function regleDe(m: Monture, regles: RegleParent[]): RegleParent | undefined {
  const c = findColorIn(m.espece, m.couleur);
  if (!c) return undefined;
  const type: TypeCouleur = c.parts.length === 2 ? 'bi' : 'mono';
  return regles.find((r) => (r.espece === '*' || r.espece === m.espece) && (r.type === '*' || r.type === type) && c.gen >= r.de && c.gen <= r.a);
}

/**
 * Destination effective d'un parent : celle de sa règle, corrigée quand le jeu ne la permet pas
 * (une génération 1 ne s'extrait pas, une dragodinde ne se brise pas). Sans règle : à vendre.
 */
export function destinationDe(m: Monture, regles: RegleParent[]): Destination {
  const c = findColorIn(m.espece, m.couleur);
  let d = regleDe(m, regles)?.destination ?? 'vendre';
  if (d === 'extraire' && (c?.gen ?? 1) <= 1) d = 'briser';
  if (d === 'briser' && m.espece === 'dragodinde') d = 'vendre';
  return d;
}

export interface Variation { file: 'briser' | 'extraire'; espece: Espece; couleur: string; delta: number }

/** Ce que les parents ajoutent aux files « À briser » et « À extraire ». */
export function versLesFiles(parents: Monture[], regles: RegleParent[]): Variation[] {
  const out: Variation[] = [];
  for (const p of parents) {
    const d = destinationDe(p, regles);
    if (d !== 'briser' && d !== 'extraire') continue;
    const couleur = findColorIn(p.espece, p.couleur)?.name ?? p.couleur;
    const e = out.find((v) => v.file === d && v.espece === p.espece && v.couleur === couleur);
    if (e) e.delta++; else out.push({ file: d, espece: p.espece, couleur, delta: 1 });
  }
  return out;
}

/** Résumé lisible : « 1 à briser, 1 à extraire ». */
export function resumeDestinations(parents: Monture[], regles: RegleParent[]): string {
  const n = new Map<Destination, number>();
  for (const p of parents) { const d = destinationDe(p, regles); n.set(d, (n.get(d) ?? 0) + 1); }
  return [...n].map(([d, k]) => `${k} ${destinationLabel(d).toLowerCase()}`).join(', ');
}

/** Ce qu'un accouplement noté transmet aux files, prêt pour l'action : file « À briser », file « À extraire », résumé. */
export function filesParents(parents: Monture[], regles: RegleParent[]): { queue: QueueDelta[]; extract: ExtractDelta[]; resume: string } {
  const v = versLesFiles(parents, regles);
  const queue = v.filter((x) => x.file === 'briser' && x.espece !== 'dragodinde')
    .map((x) => ({ espece: x.espece as BreakSpecies, couleur: x.couleur, delta: x.delta }));
  const extract = v.filter((x) => x.file === 'extraire').map(({ espece, couleur, delta }) => ({ espece, couleur, delta }));
  return { queue, extract, resume: v.length ? resumeDestinations(parents, regles) : '' };
}
