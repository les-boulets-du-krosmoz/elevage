import { useState } from 'react';
import { duree, dureeNiveau, NIVEAU_MAX, PALIERS, palierPour, VITESSES_DEFAUT } from '../../domain/temps';
import type { Palier } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';

/** Vitesse des 4 paliers, en points par 10 secondes : toutes les heures affichées en dépendent. */
export function VitessesPaliers() {
  const { settings, updateSettings } = useEtable();
  const set = (i: number, raw: string) => {
    const n = Number(raw);
    if (!(n > 0)) return;
    updateSettings({ vitesses: settings.vitesses.map((v, k) => (k === i ? n : v)) });
  };
  const defaut = settings.vitesses.every((v, i) => v === VITESSES_DEFAUT[i]);
  return (
    <details className="panel outil">
      <summary>Vitesse des paliers</summary>
      <p className="note">Points gagnés toutes les 10 secondes par une jauge d'enclos, selon le palier de son réservoir.</p>
      <div className="bar" style={{ margin: 0 }}>
        {settings.vitesses.map((v, i) => (
          <label key={i} className="inline">P{i + 1}
            <input type="number" min={1} style={{ width: '5em' }} aria-label={`Vitesse du palier ${i + 1}`} value={v} onChange={(ev) => set(i, ev.target.value)} />
          </label>
        ))}
        {!defaut && <button className="btn small ghost" onClick={() => updateSettings({ vitesses: [...VITESSES_DEFAUT] })}>Valeurs par défaut</button>}
      </div>
    </details>
  );
}

const clampNiv = (n: number) => Math.max(1, Math.min(NIVEAU_MAX, Math.round(n) || 1));

/** Calculateur de niveau (Mangeoire) : durée au palier choisi, ou palier minimal pour un délai donné. */
export function CalculateurNiveau() {
  const { settings } = useEtable();
  const v = settings.vitesses;
  const [a, setA] = useState(1);
  const [b, setB] = useState(100);
  const [p, setP] = useState<Palier>(2);
  const [h, setH] = useState(12);
  const from = clampNiv(a), to = clampNiv(b);
  const sec = dureeNiveau(from, to, p, v);
  const need = palierPour(from, to, h * 3600, v);
  return (
    <details className="panel outil">
      <summary>Calculateur de niveau</summary>
      <div className="bar" style={{ margin: '8px 0' }}>
        <label className="inline">du niveau <input type="number" min={1} max={NIVEAU_MAX} style={{ width: '5em' }} aria-label="Niveau actuel" value={a} onChange={(ev) => setA(Number(ev.target.value))} /></label>
        <label className="inline">au niveau <input type="number" min={1} max={NIVEAU_MAX} style={{ width: '5em' }} aria-label="Niveau visé" value={b} onChange={(ev) => setB(Number(ev.target.value))} /></label>
      </div>
      {to <= from ? <p className="muted">Le niveau visé doit dépasser le niveau actuel.</p> : (
        <>
          <p style={{ margin: '0 0 6px' }}>
            <span className="seg" role="group" aria-label="Palier de la Mangeoire" style={{ marginRight: 10 }}>
              {PALIERS.map((k) => <button key={k} aria-pressed={p === k} onClick={() => setP(k)}>P{k}</button>)}
            </span>
            <b>{duree(sec * 1000)}</b> <span className="muted">environ</span>
          </p>
          <p style={{ margin: 0 }}>
            <label className="inline" style={{ display: 'inline-flex' }}>En moins de <input type="number" min={1} style={{ width: '4.5em' }} aria-label="Délai en heures" value={h} onChange={(ev) => setH(Number(ev.target.value))} /> h :</label>{' '}
            {need ? <b>palier {need} minimum</b> : <span className="ko">impossible, même au palier 4 ({duree(dureeNiveau(from, to, 4, v) * 1000)})</span>}
          </p>
          <p className="note">Approximatif : la courbe d'expérience est ajustée sur six relevés en jeu (niveaux 11 à 200).</p>
        </>
      )}
    </details>
  );
}
