import { useEffect, useRef, useState } from 'react';

/* La reconnaissance vocale du navigateur (Chrome, Edge) : pas de types officiels dans TypeScript. */
type Reconnaissance = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const Classe = (): (new () => Reconnaissance) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => Reconnaissance; webkitSpeechRecognition?: new () => Reconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
export const voixDisponible = () => typeof window !== 'undefined' && !!Classe();

/** Écoute en continu tant qu'elle est active ; chaque phrase terminée part au gestionnaire. */
function useVoix(onPhrase: (t: string) => void) {
  const [actif, setActif] = useState(false);
  const [erreur, setErreur] = useState('');
  const rec = useRef<Reconnaissance | null>(null);
  const actifRef = useRef(false);
  const cb = useRef(onPhrase);
  cb.current = onPhrase;
  const stop = () => { actifRef.current = false; setActif(false); rec.current?.stop(); };
  const start = () => {
    const R = Classe();
    if (!R) return;
    const r = new R();
    r.lang = 'fr-FR'; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
    };
    // Chrome coupe l'écoute après un silence : on la relance tant que le micro est actif
    r.onend = () => { if (actifRef.current) { try { r.start(); } catch { /* déjà relancée */ } } };
    r.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setErreur('Micro refusé par le navigateur.'); stop(); } };
    rec.current = r; actifRef.current = true; setErreur(''); setActif(true);
    try { r.start(); } catch { /* déjà en cours */ }
  };
  useEffect(() => () => { actifRef.current = false; rec.current?.stop(); }, []);
  return { actif, erreur, start, stop };
}

export interface Retour { ok: boolean; texte: string }

/**
 * Barre de commande vocale : micro (Chrome, Edge), dernière phrase entendue, ce que l'outil en a fait.
 * Les phrases types n'apparaissent que lorsqu'elles servent : micro ouvert, champ de saisie actif, ou phrase pas comprise.
 * Un champ permet aussi de taper la phrase : même effet, utile sans micro.
 */
export function BarreVoix({ onPhrase, modeles, label, onEcoute }: {
  onPhrase: (t: string) => Retour; modeles: string[]; label: string; onEcoute?: (actif: boolean) => void;
}) {
  const [entendu, setEntendu] = useState('');
  const [retour, setRetour] = useState<Retour | null>(null);
  const [tape, setTape] = useState('');
  const [focus, setFocus] = useState(false);
  const traiter = (t: string) => { setEntendu(t); setRetour(onPhrase(t)); };
  const { actif, erreur, start, stop } = useVoix(traiter);
  const dispo = voixDisponible();
  useEffect(() => { onEcoute?.(actif); }, [actif]); // eslint-disable-line react-hooks/exhaustive-deps
  const montrerModeles = actif || focus || (retour !== null && !retour.ok);
  return (
    <div className="voix" role="region" aria-label={label}>
      <div className="bar" style={{ margin: 0, alignItems: 'center' }}>
        <button className={`btn small${actif ? '' : ' ghost'}`} disabled={!dispo} aria-pressed={actif} onClick={actif ? stop : start}
          title={dispo ? 'Dicter (Chrome, Edge)' : 'Commande vocale indisponible dans ce navigateur : utilise Chrome ou Edge'}>
          {actif ? '■ Arrêter le micro' : '🎤 Dicter'}
        </button>
        <input placeholder="… ou tape la phrase, puis Entrée" aria-label={`${label} : phrase`} value={tape} style={{ minWidth: 260 }}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          onChange={(e) => setTape(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tape.trim()) { traiter(tape.trim()); setTape(''); } }} />
        {actif && <span className="ecoute">● écoute</span>}
      </div>
      {montrerModeles && modeles.length > 0 && (
        <p className="modeles" aria-label={`${label} : phrases types`}>
          Dis : {modeles.map((m, i) => <span key={m}>{i ? ' · ' : ''}<q>{m}</q></span>)}
        </p>
      )}
      {(entendu || erreur) && (
        <p className="voix-retour" aria-live="polite" aria-label={`${label} : retour`}>
          {erreur ? <span className="ko">{erreur}</span> : <>
            <span className="muted">« {entendu} » → </span>
            <span className={retour?.ok ? 'ok' : 'ko'}>{retour?.texte}</span>
          </>}
        </p>
      )}
    </div>
  );
}
