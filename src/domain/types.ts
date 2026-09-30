import type { Sex } from './colors';

export interface Dragodinde {
  id: string;
  couleur: string;
  sexe: Sex;
  /** Lignée : couleurs des parents et des 4 grands-parents (père du père, mère du père, père de la mère, mère de la mère). */
  pere: string;
  mere: string;
  gp: [string, string, string, string];
  created: number;
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
}

export type ActionType = 'ajout' | 'retrait' | 'achat' | 'accouplement' | 'import' | 'effacement';

/** Action de l'historique : ce qu'elle a ajouté et retiré, pour pouvoir l'annuler. */
export interface HistoryEntry {
  id: string;
  t: number;
  type: ActionType;
  label: string;
  added: Dragodinde[];
  removed: Dragodinde[];
  /** Horodatage de l'entrée de journal créée par l'action, s'il y en a une. */
  jt: number | null;
  undone: boolean;
  undoneAt?: number;
}

export interface Settings {
  places: number;
  target: string;
  journal: JournalEntry[];
}

export interface EtableState {
  dd: Dragodinde[];
  history: HistoryEntry[];
  settings: Settings;
}
