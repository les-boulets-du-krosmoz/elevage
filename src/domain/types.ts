import type { Espece, Sex } from './colors';
import type { RegleParent } from './destinations';
import type { RecettesPerso } from './recettes';

export type { Espece };
/** Fertile : en élevage, pas encore prête. Féconde : peut s'accoupler. Les stériles sortent de l'outil. */
export type Etat = 'fertile' | 'feconde';

/** Une monture suivie par l'outil : dragodinde, volkorne ou muldo. */
export interface Monture {
  id: string;
  espece: Espece;
  couleur: string;
  sexe: Sex;
  etat: Etat;
  /** Lignée : couleurs des parents et des 4 grands-parents (père du père, mère du père, père de la mère, mère de la mère). */
  pere: string;
  mere: string;
  gp: [string, string, string, string];
  created: number;
  /** Nom à lui donner en jeu pour la retrouver (monture « à tester » ou reproductrice). */
  nom?: string;
  /** Née reproductrice : elle donnera deux bébés. */
  reproducteur?: boolean;
  /** Tombée sous la génération de ses parents : sa généalogie peut viser plus haut. */
  aTester?: boolean;
}

/** Accouplement noté, affiché en pastille dans la page Couples. */
export interface JournalEntry {
  t: number;
  /** Couleur visée par le croisement. */
  child: string;
  m: string;
  f: string;
  rc: string;
  rs: Sex;
  rc2?: string;
  rs2?: Sex | '';
  /** Objet de sexe utilisé (sexe garanti). */
  sexItem?: boolean;
  /** Objet de chance utilisé (plus de chances d'obtenir la couleur visée). */
  chanceItem?: boolean;
}

export type ActionType = 'ajout' | 'retrait' | 'achat' | 'accouplement' | 'import' | 'effacement' | 'inventaire' | 'extraction';

/** Action de l'historique : ce qu'elle a ajouté et retiré, pour pouvoir l'annuler. */
export interface HistoryEntry {
  id: string;
  t: number;
  type: ActionType;
  label: string;
  added: Monture[];
  removed: Monture[];
  /** Sessions de brisage ajoutées par un import, retirées si on l'annule. */
  addedBreaks?: BreakSession[];
  /** Variations de la file « à briser » faites par l'action. */
  queue?: QueueDelta[];
  /** Variations de la file « À extraire » portées par l'action. */
  extract?: ExtractDelta[];
  /** Horodatage de l'entrée de journal créée par l'action, s'il y en a une. */
  jt: number | null;
  undone: boolean;
  undoneAt?: number;
  /** Copie des montures supprimée pour alléger l'historique : l'action reste lisible mais n'est plus annulable. */
  pruned?: boolean;
}

export type Palier = 1 | 2 | 3 | 4;

/** Une simulation du calculateur d'enclos : une sérénité lue en jeu à l'instant le, et la cible choisie. */
export interface Simulation {
  id: string;
  /** −5 000 à +5 000 ; null tant que rien n'est saisi. */
  serenite: number | null;
  le: number;
  cible: 'rester' | 'passer';
}

/** Calculateur d'enclos : un palier global pour tous les enclos, et les simulations de chaque enclos (1 à 10). */
export interface Calculateur {
  palier: Palier;
  simulations: Record<number, Simulation[]>;
}

export interface Settings {
  /** Places prévues pour le plan d'achats des dragodindes (couples complets). */
  places: number;
  /** Nombre d'enclos du calculateur (1 à 6). */
  nbEnclos: number;
  /** Prix estimé de l'Animakina (sexe choisi), en kamas. */
  sexItemPriceK: number;
  target: string;
  journal: JournalEntry[];
  /** Vitesse des paliers 1 à 4, en points par 10 secondes (gain des jauges). */
  vitesses: number[];
  calc: Calculateur;
  /** Destination des parents après un accouplement : la première règle qui correspond s'applique. */
  regles: RegleParent[];
  /** Recettes modifiées, qui remplacent celles de DPLN couleur par couleur. */
  recettes: RecettesPerso;
  /** Monocolores visées par espèce pour le plan par génération ; absent : choix automatique. */
  cibles: Partial<Record<'muldo' | 'volkorne', string[]>>;
  /** Prix en kamas : ressource d'extraction par espèce, Optimakina par espèce et génération, généton. */
  prix: Prix;
  /** Chance de base d'obtenir la génération cible, en % (30 + 0,15 par niveau de chaque parent). */
  chanceBase: number;
}

export interface Prix {
  ressource: Partial<Record<Espece, number>>;
  /** Prix des runes de forgemagie, par nom (« Ga PA »). */
  runes: Record<string, number>;
  optimakina: Partial<Record<Espece, Record<number, number>>>;
  geneton: number | null;
}

export type BreakSpecies = 'volkorne' | 'muldo';

/** Session de brisage : un lot de montures de même espèce et même niveau. */
export interface BreakSession {
  id: string;
  /** Date du brisage, au format AAAA-MM-JJ. */
  date: string;
  species: BreakSpecies;
  level: number;
  mounts: number;
  /** Quantité obtenue par rune. */
  runes: Record<string, number>;
  created: number;
}

/** File « à briser » : nombre de volkornes et de muldos à briser, par couleur, sans sexe. */
export type BreakQueue = Record<BreakSpecies, Record<string, number>>;
/** Variation de la file « à briser » portée par une action (pour pouvoir l'annuler). */
export interface QueueDelta { espece: BreakSpecies; couleur: string; delta: number }
/** File « À extraire » : montures stériles à passer à l'extracteur, par espèce et couleur, sans sexe. */
export type ExtractQueue = Record<Espece, Record<string, number>>;
export interface ExtractDelta { espece: Espece; couleur: string; delta: number }

export interface EtableState {
  dd: Monture[];
  history: HistoryEntry[];
  settings: Settings;
  breaks: BreakSession[];
  queue: BreakQueue;
  extract: ExtractQueue;
}
