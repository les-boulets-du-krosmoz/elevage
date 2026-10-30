/** Préférences d'affichage propres à ce navigateur (filtres, groupes repliés…), hors sauvegarde. */
export const readPref = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
export const writePref = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* cache indisponible */ }
};
