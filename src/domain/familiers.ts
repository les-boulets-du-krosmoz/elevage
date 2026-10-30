import { FAMILIERS, XP_FAMILIER } from './familiersData';

/**
 * Familiers : aucune reproduction, aucun lien avec les montures. On les obtient en apportant une offrande au familier
 * sur la carte, par une quête, ou contre une monnaie. Ils montent du niveau 0 au niveau 100 en mangeant des ressources.
 *
 * Bonus selon le niveau (à vérifier en jeu) : au niveau 1, 10 % du bonus maximum ; ensuite le pourcentage suit le niveau
 * (50 % au niveau 50). Les bonus entiers rares (PA, PM, Portée, Invocations) n'arrivent qu'au niveau 80. Arrondi à l'inférieur.
 */

export const NIVEAU_MAX = 100;
export const XP_CROQUETTE = 500;
/** Bonus qui ne s'obtiennent qu'en entier, au niveau 80. */
const PALIERS = new Set(['PA', 'PM', 'Portée', 'Invocations']);
export const NIVEAU_PALIER = 80;

export interface Bonus { stat: string; max: number; pct: boolean; palier: boolean }
export type Obtention = 'offrande' | 'quete' | 'monnaie' | 'autre';
export interface Familier { nom: string; bonus: Bonus[]; obtention: string; prerequis: string; type: Obtention }

const MONNAIES = /Kolizéton|Pépite|Orichor|Almaton|Aliton|Troolotons|Gladiation|Jeton|Kama de glace|Kama Doré/;

/** Type d'obtention, pour filtrer : offrande sur la carte, quête, monnaie d'échange, autre (HDV, événement…). */
export function typeObtention(obtention: string, prerequis: string): Obtention {
  if (/^Quête/.test(obtention) || /^Succès/.test(obtention)) return 'quete';
  if (MONNAIES.test(obtention)) return 'monnaie';
  if (/^\[-?\d+,-?\d+\]/.test(obtention) || /^Lieu inconnu/.test(obtention)) return /^Quête/.test(prerequis) ? 'quete' : 'offrande';
  return 'autre';
}

export function lireBonus(txt: string): Bonus[] {
  return txt.split(';').map((s) => s.trim()).filter(Boolean).flatMap((s) => {
    const m = s.match(/^(\d+)\s*(%)?\s*(.+)$/);
    if (!m) return [];
    const stat = m[3].trim();
    return [{ stat, max: Number(m[1]), pct: !!m[2], palier: PALIERS.has(stat) }];
  });
}

export const TOUS_FAMILIERS: Familier[] = FAMILIERS.map(([nom, bonus, obtention, prerequis]) =>
  ({ nom, bonus: lireBonus(bonus), obtention, prerequis, type: typeObtention(obtention, prerequis) }));

export const OBTENTION_LABEL: Record<Obtention, string> = { offrande: 'Offrande sur la carte', quete: 'Quête ou succès', monnaie: 'Monnaie d’échange', autre: 'Autre' };

/** Valeur d'un bonus au niveau L (0 tant que le familier n'a rien mangé). */
export function valeurBonus(b: Bonus, niveau: number): number {
  if (niveau <= 0) return 0;
  if (b.palier) return niveau >= NIVEAU_PALIER ? b.max : 0;
  return Math.floor((b.max * Math.max(10, Math.min(NIVEAU_MAX, niveau))) / 100);
}
export const texteBonus = (b: Bonus, niveau: number) => `${valeurBonus(b, niveau)}${b.pct ? ' %' : ''} ${b.stat}`;

/** Niveau atteint avec une expérience cumulée. */
export function niveauPour(xp: number): number {
  let n = 0;
  while (n < NIVEAU_MAX && XP_FAMILIER[n + 1] <= xp) n++;
  return n;
}
export const xpPour = (niveau: number) => XP_FAMILIER[Math.max(0, Math.min(NIVEAU_MAX, Math.round(niveau)))];

/** Expérience donnée par un lot de ressources : le jeu arrondit le total à l'inférieur, lot par lot. */
export const xpLot = (xpUnite: number, quantite: number) => Math.floor(Math.max(0, xpUnite) * Math.max(0, quantite) + 1e-9);

export interface Repas { nom: string; xp: number; quantite: number; prix?: number; /** Saisie telle que tapée (« 1,25 »). */ xpTxt?: string }

export interface Simulation {
  depart: number;
  xpDepart: number;
  gagne: number;
  xpFinal: number;
  arrivee: number;
  /** Expérience qui manque pour le niveau suivant (0 au niveau 100). */
  manque: number;
  cout: number;
  /** XP perdue par l'arrondi du jeu, lot par lot. */
  perte: number;
}

/** Ce que donnent des repas à un familier qui part d'un niveau (et d'une expérience déjà gagnée dans ce niveau). */
export function simuler(depart: number, repas: Repas[], dansLeNiveau = 0): Simulation {
  const xpDepart = xpPour(depart) + Math.max(0, dansLeNiveau);
  const gagne = repas.reduce((t, r) => t + xpLot(r.xp, r.quantite), 0);
  const xpFinal = Math.min(xpPour(NIVEAU_MAX), xpDepart + gagne);
  const arrivee = niveauPour(xpFinal);
  return {
    depart, xpDepart, gagne, xpFinal, arrivee,
    manque: arrivee >= NIVEAU_MAX ? 0 : xpPour(arrivee + 1) - xpFinal,
    cout: repas.reduce((t, r) => t + (r.prix ?? 0) * r.quantite, 0),
    perte: Math.round(repas.reduce((t, r) => t + perteArrondi(r.xp, r.quantite), 0) * 1000) / 1000,
  };
}

/** Quantité d'une ressource qui apporte au moins cette expérience, donnée en un seul lot (arrondi compris). */
export function quantitePour(besoin: number, xpUnite: number): number | null {
  if (!(xpUnite > 0)) return null;
  if (besoin <= 0) return 0;
  let q = Math.ceil(besoin / xpUnite);
  while (xpLot(xpUnite, q) < besoin) q++;
  return q;
}

/* ---------- Arrondi : pertes théoriques et quantités sans perte ---------- */

const pgcd = (a: number, b: number): number => (b ? pgcd(b, a % b) : a);
const decimales = (x: number) => {
  const s = String(Math.round(x * 1000) / 1000);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

/** Plus petite quantité dont l'XP totale tombe juste : 1,25 → 4 ; 0,5 → 2 ; 1,3 → 10 ; 2 → 1. */
export function pasSansPerte(xpUnite: number): number {
  if (!(xpUnite > 0)) return 1;
  const base = 10 ** decimales(xpUnite);
  const n = Math.round(xpUnite * base);
  return base / pgcd(n, base);
}

/** XP perdue par l'arrondi du jeu sur un lot : 99 Roses des sables à 1,25 donnent 123 XP au lieu de 123,75. */
export const perteArrondi = (xpUnite: number, quantite: number) =>
  Math.max(0, Math.round((xpUnite * quantite - xpLot(xpUnite, quantite)) * 1000) / 1000);

/** La plus grande quantité sans perte, sans dépasser celle prévue (0 si le pas est plus grand). */
export const quantiteSansPerte = (xpUnite: number, quantite: number) => {
  const p = pasSansPerte(xpUnite);
  return Math.floor(quantite / p) * p;
};

/* ---------- Bibliothèque de ressources : nom et XP par unité ---------- */

/**
 * Une table donne, pour chaque ressource, l'XP obtenue pour une quantité donnée (« 1 XP pour 11 Runes Age »).
 * L'outil en tire l'XP par unité (XP ÷ quantité) et sa fiabilité :
 * - « fiable » : quantité de 1 (ou XP déjà décimale sans quantité) : l'XP par unité est celle de la table ;
 * - « approximative » : XP entière pour 2 à 9 unités, ou quantité absente : le jeu arrondit, la vraie valeur est
 *   comprise entre XP ÷ quantité et (XP + 1) ÷ quantité ;
 * - « peu-rentable » : il faut 10 unités ou plus pour l'XP annoncée (0,1 XP par unité au mieux) : inutile de la vérifier ;
 * - « inconnue » : XP absente (« ? ») ou nulle ;
 * - « verifiee » : relevée en jeu par l'utilisateur.
 */
export type Fiabilite = 'fiable' | 'approximative' | 'peu-rentable' | 'inconnue' | 'verifiee';
export interface RessourceXp {
  nom: string;
  /** XP par unité, utilisée par le simulateur. */
  xp: number;
  fiabilite?: Fiabilite;
  /** Valeurs brutes de la table : XP obtenue pour cette quantité. */
  xpTable?: number;
  quantite?: number | null;
}
const nombre = (s: string) => Number(s.replace(/\s|\u202f|\u00a0/g, '').replace(',', '.'));
export const SEUIL_PEU_RENTABLE = 10;

/** Une ressource est-elle à vérifier en jeu avant de s'y fier ? (Les peu rentables ne valent pas la peine.) */
export const aVerifier = (r: RessourceXp) => r.fiabilite === 'approximative' || r.fiabilite === 'inconnue';

/**
 * Lit une table collée depuis un tableur ou une page : une ressource par ligne, le nom, l'XP, puis la quantité
 * pour laquelle cette XP est obtenue (séparés par une tabulation, « ; », « | » ou plusieurs espaces).
 * Une XP « ? » ou absente est gardée comme inconnue ; une ligne dont l'XP n'est ni un nombre ni « ? » (en-tête) est ignorée.
 */
export function lireTable(txt: string): { ressources: RessourceXp[]; ignorees: number } {
  const ressources: RessourceXp[] = [];
  let ignorees = 0;
  for (const ligne of txt.split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    const champs = ligne.split(/\t|;|\||\s{2,}/).map((c) => c.trim());
    const nom = champs[0];
    const brut = champs[1] ?? '';
    const inconnue = brut === '' || brut === '?';
    const xpTable = inconnue ? 0 : nombre(brut);
    if (!nom || (!inconnue && (!Number.isFinite(xpTable) || xpTable < 0))) { ignorees++; continue; }
    const q = champs[2] && champs[2] !== '?' ? nombre(champs[2]) : NaN;
    const quantite = Number.isFinite(q) && q > 0 ? q : null;
    const xp = quantite ? xpTable / quantite : xpTable;
    const fiabilite: Fiabilite = inconnue || xpTable === 0 ? 'inconnue'
      : quantite !== null && quantite >= SEUIL_PEU_RENTABLE ? 'peu-rentable'
        : quantite === 1 || (quantite === null && !Number.isInteger(xpTable)) ? 'fiable'
          : 'approximative';
    ressources.push({ nom, xp: Math.round(xp * 10000) / 10000, fiabilite, xpTable, quantite });
  }
  return { ressources, ignorees };
}

/** Fourchette de l'XP par unité d'une valeur approximative : de XP ÷ quantité à (XP + 1) ÷ quantité. */
export function fourchette(r: RessourceXp): [number, number] | null {
  if (r.fiabilite !== 'approximative' || !r.xpTable) return null;
  const q = r.quantite ?? 1;
  return [r.xpTable / q, (r.xpTable + 1) / q];
}

/** Fusionne une table dans la bibliothèque : même nom (sans accents ni casse) = valeur remplacée. */
export function fusionner(biblio: RessourceXp[], ajout: RessourceXp[]): RessourceXp[] {
  const cle = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const map = new Map(biblio.map((r) => [cle(r.nom), r]));
  // Une valeur vérifiée en jeu n'est jamais écrasée par une table
  for (const r of ajout) if (map.get(cle(r.nom))?.fiabilite !== 'verifiee') map.set(cle(r.nom), r);
  return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/** Note une valeur relevée en jeu : elle devient la référence de la ressource. */
export function verifier(biblio: RessourceXp[], nom: string, xp: number): RessourceXp[] {
  return fusionner(biblio.filter((r) => r.nom.toLowerCase() !== nom.toLowerCase()), [{ nom, xp, fiabilite: 'verifiee', xpTable: xp, quantite: 1 }]);
}

/* ---------- Favoris : valeur à l'unité, coût de l'XP, tri ---------- */

export interface Favori {
  nom: string;
  /** XP par unité (table, import ou vérifiée en jeu). */
  xp: number;
  fiabilite?: Fiabilite;
  /** Valeur à l'unité en kamas : prix d'achat, ou prix de revente pour une ressource farmée. */
  valeur?: number;
  /** Date de saisie de la valeur. */
  le?: number;
  /** Fourchette de l'XP par unité quand elle est approximative. */
  plage?: [number, number] | null;
}

export interface Comparaison {
  /** Kamas par point d'XP, et sa fourchette pour une valeur approximative. */
  coutXp: number | null;
  coutXpMin: number | null;
  coutXpMax: number | null;
  /** Quantité et coût pour l'XP demandée (arrondi du jeu compris). */
  quantite: number | null;
  cout: number | null;
}

export function comparer(f: Favori, besoin: number): Comparaison {
  const ok = f.xp > 0;
  const v = f.valeur && f.valeur > 0 ? f.valeur : null;
  const quantite = ok ? quantitePour(besoin, f.xp) : null;
  return {
    coutXp: ok && v !== null ? v / f.xp : null,
    // Plus la ressource donne d'XP, moins le point coûte : la borne haute de l'XP donne le coût le plus bas
    coutXpMin: v !== null && f.plage ? v / f.plage[1] : null,
    coutXpMax: v !== null && f.plage ? v / f.plage[0] : null,
    quantite,
    cout: v !== null && quantite !== null ? quantite * v : null,
  };
}

export type TriFavoris = 'rentabilite' | 'prix' | 'xp';

/** Tri des favoris : coût du point d'XP croissant, valeur croissante, ou XP par unité décroissante. Sans valeur : à la fin. */
export function trierFavoris(list: Favori[], tri: TriFavoris, besoin: number): Favori[] {
  const cle = (f: Favori): number => {
    if (tri === 'xp') return -(f.xp || 0);
    if (tri === 'prix') return f.valeur && f.valeur > 0 ? f.valeur : Infinity;
    return comparer(f, besoin).coutXp ?? Infinity;
  };
  return [...list].sort((a, b) => cle(a) - cle(b) || a.nom.localeCompare(b.nom, 'fr'));
}
