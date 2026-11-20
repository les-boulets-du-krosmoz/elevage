import { colorsOf, findColorIn, type Espece, type Sex } from './colors';

/**
 * Commande vocale : la reconnaissance du navigateur (Chrome, Edge) rend une phrase ; ces fonctions la lisent.
 * Inventaire : « Doré, douze mâles, cinq femelles », « Ébène et Indigo, total vingt, femelles huit », « annuler ».
 * Accouplement : « Doré avec Pourpre donne Doré et Pourpre femelle », « Roux mâle » (lot actif), « jumeau Doré mâle ».
 */

export const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mots = (s: string) => plat(s).replace(/[-'’,.;:!?]/g, ' ').split(/\s+/).filter(Boolean);

/* ---------- Nombres ---------- */

const UNITES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60,
};
const estNombre = (w: string) => /^\d+$/.test(w) || w in UNITES || w === 'cent' || w === 'cents' || w === 'mille';

/** Lit les nombres d'une liste de mots : chiffres ou lettres (« vingt et un », « quatre vingt dix », « 12 »). */
export function nombres(ws: string[]): { valeur: number; debut: number; fin: number }[] {
  const out: { valeur: number; debut: number; fin: number }[] = [];
  let i = 0;
  while (i < ws.length) {
    if (/^\d+$/.test(ws[i])) { out.push({ valeur: Number(ws[i]), debut: i, fin: i }); i++; continue; }
    if (!estNombre(ws[i]) || ((ws[i] === 'un' || ws[i] === 'une') && !estNombre(ws[i + 1] ?? ''))) {
      // « un » ou « une » seuls sont des nombres, sauf comme article devant un mot qui n'en est pas
      if ((ws[i] === 'un' || ws[i] === 'une') && (i === ws.length - 1 || ['male', 'males', 'mal', 'femelle', 'femelles', 'au'].includes(ws[i + 1]))) {
        out.push({ valeur: 1, debut: i, fin: i });
      }
      i++; continue;
    }
    const debut = i;
    let total = 0, courant = 0;
    while (i < ws.length) {
      const w = ws[i];
      if (w === 'et' && courant > 0 && (ws[i + 1] === 'un' || ws[i + 1] === 'onze')) { i++; continue; }
      if (w === 'vingt' || w === 'vingts') courant = courant === 4 ? 80 : courant + 20;
      else if (w === 'cent' || w === 'cents') courant = (courant || 1) * 100;
      else if (w === 'mille') { total += (courant || 1) * 1000; courant = 0; }
      else if (w in UNITES) courant += UNITES[w];
      else break;
      i++;
    }
    out.push({ valeur: total + courant, debut, fin: i - 1 });
  }
  return out;
}

/* ---------- Couleurs ---------- */

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}
const proche = (mot: string, cible: string) => mot === cible || (cible.length >= 4 && distance(mot, cible) <= (cible.length >= 7 ? 2 : 1));

/** Monocolores reconnues dans une suite de mots, dans l'ordre (« ebene indigo » → Ébène, Indigo). */
function monosDans(espece: Espece, ws: string[]): string[] {
  const monos = colorsOf(espece).filter((c) => c.parts.length === 1).map((c) => ({ nom: c.name, ws: mots(c.name) }))
    .sort((a, b) => b.ws.length - a.ws.length);
  const trouves: string[] = [];
  for (let i = 0; i < ws.length;) {
    const m = monos.find((x) => x.ws.every((w, k) => ws[i + k] !== undefined && proche(ws[i + k], w)));
    if (m) { trouves.push(m.nom); i += m.ws.length; } else i++;
  }
  return trouves;
}

/** Couleur nommée dans un bout de phrase : une bicolore si deux monocolores y figurent, sinon la monocolore. */
export function couleurDans(espece: Espece, texte: string | string[]): string | null {
  const ws = Array.isArray(texte) ? texte : mots(texte);
  const m = monosDans(espece, ws);
  if (m.length >= 2 && m[0] !== m[1]) return findColorIn(espece, `${m[0]} et ${m[1]}`)?.name ?? findColorIn(espece, m[0])?.name ?? null;
  return m.length ? findColorIn(espece, m[0])?.name ?? null : null;
}

const SEXE: Record<string, Sex> = { male: 'M', males: 'M', mal: 'M', garcon: 'M', femelle: 'F', femelles: 'F', fille: 'F' };
const champDe = (w: string): 'm' | 'f' | 't' | 'b' | null =>
  SEXE[w] === 'M' ? 'm' : SEXE[w] === 'F' ? 'f' : w === 'total' ? 't' : w === 'briser' ? 'b' : null;

/* ---------- Inventaire ---------- */

export type PhraseInventaire =
  | { commande: 'annuler' | 'valider' | 'fermer' }
  | { couleur: string; champs: Partial<Record<'m' | 'f' | 't' | 'b', number>> };

/** « Doré, douze mâles, cinq femelles » → Doré : 12 ♂, 5 ♀ ; un nombre sans mot-clé est le total. */
export function lireInventaire(espece: Espece, phrase: string): PhraseInventaire | null {
  const ws = mots(phrase);
  if (!ws.length) return null;
  if (ws.length <= 2 && ['annuler', 'annule'].includes(ws[0])) return { commande: 'annuler' };
  if (ws.length <= 2 && ['valider', 'valide'].includes(ws[0])) return { commande: 'valider' };
  if (ws.length <= 2 && ['fermer', 'ferme'].includes(ws[0])) return { commande: 'fermer' };
  const ns = nombres(ws);
  const premier = Math.min(...[...ns.map((n) => n.debut), ...ws.map((w, i) => (champDe(w) ? i : Infinity))], ws.length);
  const couleur = couleurDans(espece, ws.slice(0, premier));
  if (!couleur) return null;
  const champs: Partial<Record<'m' | 'f' | 't' | 'b', number>> = {};
  const pris = new Set<number>();
  ws.forEach((w, k) => {
    const c = champDe(w);
    if (!c) return;
    // Le nombre juste avant (« douze mâles »), sinon juste après (« femelles huit »)
    const n = ns.find((x, j) => !pris.has(j) && x.fin === k - 1) ?? ns.find((x, j) => !pris.has(j) && x.debut === k + 1);
    if (n) { champs[c] = n.valeur; pris.add(ns.indexOf(n)); }
  });
  const libre = ns.filter((_, j) => !pris.has(j));
  if (libre.length && champs.t === undefined) champs.t = libre[0].valeur;
  return Object.keys(champs).length ? { couleur, champs } : null;
}

/* ---------- Accouplement ---------- */

export interface Naissance { c: string; x: Sex }
export type PhraseAccouplement =
  | { commande: 'annuler' }
  | { lot?: { m: string; f: string }; bebes: Naissance[]; jumeau: boolean }
  | { lot: { m: string; f: string }; bebes: []; jumeau: false };

/** Bébés d'un bout de phrase : une couleur puis un sexe, autant de fois que dit. */
function bebesDans(espece: Espece, ws: string[]): Naissance[] {
  const out: Naissance[] = [];
  let debut = 0;
  ws.forEach((w, k) => {
    if (!SEXE[w]) return;
    const c = couleurDans(espece, ws.slice(debut, k).filter((x) => !['bebe', 'un', 'une', 'donne'].includes(x)));
    if (c) out.push({ c, x: SEXE[w] });
    debut = k + 1;
  });
  return out;
}

/**
 * « Doré avec Pourpre donne Doré et Pourpre femelle » : le lot et son bébé ; « Roux mâle » : un bébé pour le lot actif ;
 * « Doré avec Pourpre » : changer de lot actif ; « jumeau Doré mâle » : second bébé du dernier accouplement ; « annuler ».
 */
export function lireAccouplement(espece: Espece, phrase: string): PhraseAccouplement | null {
  const ws = mots(phrase);
  if (!ws.length) return null;
  if (ws.length <= 2 && ['annuler', 'annule'].includes(ws[0])) return { commande: 'annuler' };
  const jumeau = ws[0] === 'jumeau' || ws[0] === 'jumelle';
  const reste = jumeau ? ws.slice(1) : ws;
  const iDonne = reste.findIndex((w) => w === 'donne' || w === 'donnent' || w === 'egal');
  const iAvec = reste.findIndex((w) => w === 'avec' || w === 'sur' || w === 'fois');
  let lot: { m: string; f: string } | undefined;
  if (iAvec >= 0) {
    const m = couleurDans(espece, reste.slice(0, iAvec));
    const f = couleurDans(espece, reste.slice(iAvec + 1, iDonne >= 0 ? iDonne : undefined));
    if (m && f) lot = { m, f };
  }
  const zoneBebes = iDonne >= 0 ? reste.slice(iDonne + 1) : iAvec >= 0 ? [] : reste;
  const bebes = bebesDans(espece, zoneBebes);
  if (!lot && !bebes.length) return null;
  if (lot && !bebes.length) return { lot, bebes: [], jumeau: false };
  return { ...(lot ? { lot } : {}), bebes, jumeau };
}
