import { uid } from '../domain/stock';
import type { ActionType, BreakSession, BreakSpecies, EtableState, ExtractDelta, HistoryEntry, JournalEntry, Monture, QueueDelta } from '../domain/types';
import { applyExtract, applyQueue, capHistory, queueTotal } from './storage';

/**
 * Transitions de l'état, sans React : chaque fonction prend l'état et rend le nouvel état.
 * Le contexte React ne fait que les appeler, sauvegarder et afficher les notifications ;
 * toute la logique est testable seule.
 */

export interface ActOptions { add?: Monture[]; del?: Monture[]; journal?: Omit<JournalEntry, 't'> | null; queue?: QueueDelta[]; extract?: ExtractDelta[] }

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
const plural = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Ajouts et retraits de montures, inscrits à l'historique (et au journal pour un accouplement noté). */
export function applyAct(s: EtableState, type: ActionType, label: string, { add = [], del = [], journal = null, queue = [], extract = [] }: ActOptions = {}, now = Date.now(), id = 'h' + uid()) {
  const delIds = new Set(del.map((d) => d.id));
  const entry: HistoryEntry = { id, t: now, type, label, added: clone(add), removed: clone(del), jt: journal ? now : null, undone: false, ...(queue.length ? { queue } : {}), ...(extract.length ? { extract } : {}) };
  const state: EtableState = {
    ...s,
    dd: [...s.dd.filter((d) => !delIds.has(d.id)), ...add],
    history: capHistory([...s.history, entry]),
    settings: journal ? { ...s.settings, journal: [...s.settings.journal, { ...journal, t: now }] } : s.settings,
    queue: queue.length ? applyQueue(s.queue, queue) : s.queue,
    extract: extract.length ? applyExtract(s.extract, extract) : s.extract,
  };
  return { state, entry };
}

export type UndoResult =
  | { ok: true; state: EtableState; entry: HistoryEntry; gone: number }
  | { ok: false; reason: 'absent' | 'deja-annulee' | 'trop-ancienne' };

/** Remet l'état comme avant l'action. Les montures ajoutées puis utilisées depuis ne peuvent pas être retirées (« gone »). */
export function applyUndo(s: EtableState, id: string, now = Date.now()): UndoResult {
  const h = s.history.find((x) => x.id === id);
  if (!h) return { ok: false, reason: 'absent' };
  if (h.undone) return { ok: false, reason: 'deja-annulee' };
  if (h.pruned) return { ok: false, reason: 'trop-ancienne' };
  const present = new Set(s.dd.map((d) => d.id));
  const addedIds = new Set(h.added.map((d) => d.id));
  const gone = h.added.filter((d) => !present.has(d.id)).length;
  // Une action qui modifie une monture (passage en féconde) la retire puis l'ajoute avec le même identifiant :
  // on retire la version modifiée, puis on remet l'originale si elle n'est plus là.
  const kept = s.dd.filter((d) => !addedIds.has(d.id));
  const keptIds = new Set(kept.map((d) => d.id));
  const bIds = new Set((h.addedBreaks ?? []).map((b) => b.id));
  const state: EtableState = {
    ...s,
    dd: [...kept, ...h.removed.filter((d) => !keptIds.has(d.id))],
    history: s.history.map((x) => (x.id === id ? { ...x, undone: true, undoneAt: now } : x)),
    breaks: s.breaks.filter((b) => !bIds.has(b.id)),
    settings: { ...s.settings, journal: h.jt ? s.settings.journal.filter((j) => j.t !== h.jt) : s.settings.journal },
    queue: h.queue?.length ? applyQueue(s.queue, h.queue.map((d) => ({ ...d, delta: -d.delta }))) : s.queue,
    extract: h.extract?.length ? applyExtract(s.extract, h.extract.map((d) => ({ ...d, delta: -d.delta }))) : s.extract,
  };
  return { ok: true, state, entry: h, gone };
}

export const undoMessage = (r: Extract<UndoResult, { ok: true }>) =>
  `Annulé : ${r.entry.label}${r.gone ? ` (${plural(r.gone, 'monture')} déjà utilisée${r.gone > 1 ? 's' : ''} depuis, non retirée${r.gone > 1 ? 's' : ''})` : ''}`;

/** Import d'une sauvegarde : fusion (ignore ce qui est déjà présent) ou remplacement. Reste annulable. */
export function applyImport(s: EtableState, data: Partial<EtableState>, mode: 'fusion' | 'remplacement', now = Date.now()) {
  const incoming = data.dd ?? [];
  if (mode === 'remplacement') {
    const entry: HistoryEntry = { id: 'h' + uid(), t: now, type: 'import', label: `${plural(incoming.length, 'monture')} importée${incoming.length > 1 ? 's' : ''} (remplacement)`, added: clone(incoming), removed: clone(s.dd), jt: null, undone: false };
    const state: EtableState = { dd: incoming, history: capHistory([...(data.history ?? s.history), entry]), settings: data.settings ?? s.settings, breaks: data.breaks ?? s.breaks, queue: data.queue ?? s.queue, extract: data.extract ?? s.extract };
    return { state, entry, label: entry.label };
  }
  const known = new Set(s.dd.map((d) => d.id));
  const fresh = incoming.filter((d) => !known.has(d.id));
  const knownB = new Set(s.breaks.map((b) => b.id));
  const freshB = (data.breaks ?? []).filter((b) => !knownB.has(b.id));
  const skipped = incoming.length - fresh.length + (data.breaks?.length ?? 0) - freshB.length;
  const parts = [fresh.length && plural(fresh.length, 'monture'), freshB.length && `${plural(freshB.length, 'session')} de brisage`].filter(Boolean);
  const label = `Import : ${parts.join(' et ') || 'rien de nouveau'}${skipped ? ` (${skipped} déjà présente${skipped > 1 ? 's' : ''}, ignorée${skipped > 1 ? 's' : ''})` : ''}`;
  if (!fresh.length && !freshB.length) return { state: s, entry: null, label };
  const entry: HistoryEntry = { id: 'h' + uid(), t: now, type: 'import', label, added: clone(fresh), removed: [], addedBreaks: clone(freshB), jt: null, undone: false };
  const state: EtableState = { ...s, dd: [...s.dd, ...fresh], breaks: [...s.breaks, ...freshB], history: capHistory([...s.history, entry]) };
  return { state, entry, label };
}

/** Montures retirées de la file quand on en brise n : d'abord les couleurs les plus nombreuses. */
export function queueConsumption(s: EtableState, espece: BreakSpecies, n: number): QueueDelta[] {
  const out: QueueDelta[] = [];
  let left = Math.min(n, queueTotal(s.queue, espece));
  for (const [couleur, count] of Object.entries(s.queue[espece]).sort((a, b) => b[1] - a[1])) {
    if (left <= 0) break;
    const take = Math.min(count, left);
    out.push({ espece, couleur, delta: -take });
    left -= take;
  }
  return out;
}

/** Ajoute une session de brisage ; si fromQueue, les montures brisées sortent de la file « à briser ». */
export function addBreakTo(s: EtableState, b: Omit<BreakSession, 'id' | 'created'>, fromQueue = false, now = Date.now()) {
  const session: BreakSession = { ...b, id: 'b' + uid(), created: now };
  const consumed = fromQueue ? queueConsumption(s, b.species, b.mounts) : [];
  return { state: { ...s, breaks: [...s.breaks, session], queue: applyQueue(s.queue, consumed) }, session, consumed };
}

export const removeBreakFrom = (s: EtableState, id: string): EtableState => ({ ...s, breaks: s.breaks.filter((x) => x.id !== id) });
