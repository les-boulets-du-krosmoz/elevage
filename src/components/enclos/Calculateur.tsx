import { useEffect, useState } from 'react';
import { heure, hms, lireSerenite, simuler, SIMULATIONS_MAX, type Cible } from '../../domain/temps';
import type { Simulation } from '../../domain/types';
import { uid } from '../../domain/stock';
import { useEtable } from '../../store/EtableContext';

/** Heure courante, rafraîchie chaque seconde pour le compte à rebours. */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

const nouvelle = (): Simulation => ({ id: uid(), serenite: null, le: Date.now(), cible: 'rester' });

/**
 * Visage de monture, comme dans le jeu : bleu et triste pour −2 000 à −1 (Endurance + Maturité),
 * violet et souriant pour 0 à +2 000 (Amour + Maturité).
 */
function Visage({ cote }: { cote: 'negatif' | 'positif' }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className={`visage ${cote}`}>
      <circle cx="12" cy="12" r="10.5" />
      <circle cx="8.5" cy="10" r="1.4" className="oeil" />
      <circle cx="15.5" cy="10" r="1.4" className="oeil" />
      <path d={cote === 'positif' ? 'M7.5 14.2 Q12 18.6 16.5 14.2' : 'M7.5 17 Q12 12.8 16.5 17'} className="bouche" />
    </svg>
  );
}

/** Une simulation : sérénité saisie, deux visages (rester ou passer), temps restant en hh:mm:ss. */
function LigneSimulation({ sim, vitesse, now, onChange, onRemove, canRemove, n }:
  { sim: Simulation; vitesse: number; now: number; onChange: (s: Simulation) => void; onRemove: () => void; canRemove: boolean; n: number }) {
  const [raw, setRaw] = useState(sim.serenite === null ? '' : String(sim.serenite));
  const invalide = raw.trim() !== '' && lireSerenite(raw) === null;
  const r = sim.serenite === null ? null : simuler(sim.serenite, vitesse, sim.cible);
  const negatif = sim.serenite !== null && sim.serenite < 0;
  // Le visage du même côté que la sérénité saisie = rester ; l'autre = passer
  const cibleDe = (cote: 'negatif' | 'positif'): Cible => ((cote === 'negatif') === negatif ? 'rester' : 'passer');
  const label = (cote: 'negatif' | 'positif') => {
    if (sim.serenite === null) return cote === 'negatif' ? 'Sérénité négative' : 'Sérénité positive';
    return `${cibleDe(cote) === 'rester' ? 'Rester' : 'Passer'} en ${cote === 'negatif' ? 'négatif' : 'positif'}`;
  };
  const arrivee = r ? sim.le + r.secondes * 1000 : null;
  const reste = arrivee === null ? null : Math.max(0, (arrivee - now) / 1000);

  return (
    <li className="sim" aria-label={`Simulation ${n}`}>
      <input inputMode="numeric" aria-label={`Sérénité de la simulation ${n}`} placeholder="−4 200" value={raw}
        className={invalide ? 'bad' : undefined}
        onChange={(e) => {
          setRaw(e.target.value);
          const v = lireSerenite(e.target.value);
          if (e.target.value.trim() === '') onChange({ ...sim, serenite: null, le: Date.now() });
          else if (v !== null) onChange({ ...sim, serenite: v, le: Date.now() });
        }} />
      <span className="visages" role="group" aria-label="Cible">
        {(['negatif', 'positif'] as const).map((cote) => (
          <button key={cote} className="vis" aria-label={label(cote)} title={label(cote)} disabled={sim.serenite === null}
            aria-pressed={sim.serenite !== null && sim.cible === cibleDe(cote)}
            onClick={() => onChange({ ...sim, cible: cibleDe(cote) })}>
            <Visage cote={cote} />
          </button>
        ))}
      </span>
      <span className="temps-sim" aria-live="off">
        {invalide ? <span className="ko">−5 000 à +5 000</span> : r && reste !== null && arrivee !== null ? (
          <>
            <b className={reste === 0 ? 'ok' : undefined} title={`${hms(r.secondes)} au total depuis la saisie`}>{reste === 0 ? 'atteint' : hms(reste)}</b>
            <span className="muted">{`${heure(arrivee, now)} → ${r.valeur.toLocaleString('fr-FR')}`}</span>
          </>
        ) : <span className="muted">saisis une sérénité</span>}
      </span>
      <button className="x" aria-label={`Retirer la simulation ${n}`} disabled={!canRemove} onClick={onRemove}>×</button>
    </li>
  );
}

/** Une carte d'enclos du calculateur : 1 simulation au départ, jusqu'à 10. */
export function CarteCalcul({ id, vitesse }: { id: number; vitesse: number }) {
  const { settings, updateSettings } = useEtable();
  const now = useNow();
  // Sans simulation enregistrée, une simulation vide à identifiant stable (sinon elle se recréerait à chaque seconde)
  const sims = settings.calc.simulations[id]?.length ? settings.calc.simulations[id] : [{ ...nouvelle(), id: `defaut-${id}`, le: 0 }];
  const save = (list: Simulation[]) => updateSettings({ calc: { ...settings.calc, simulations: { ...settings.calc.simulations, [id]: list } } });
  return (
    <article className="panel calc-card" aria-label={`Enclos ${id}`}>
      <div className="enclos-head">
        <h3>Enclos {id}</h3>
        <span className="muted">{sims.length}/{SIMULATIONS_MAX}</span>
        <button className="btn small ghost" style={{ marginLeft: 'auto' }} disabled={sims.length >= SIMULATIONS_MAX}
          onClick={() => save([...sims, nouvelle()])}>+ Simulation</button>
      </div>
      <ul className="sims">
        {sims.map((s, i) => (
          <LigneSimulation key={s.id} sim={s} n={i + 1} vitesse={vitesse} now={now} canRemove={sims.length > 1}
            onChange={(v) => save(sims.map((x) => (x.id === s.id ? v : x)))}
            onRemove={() => save(sims.filter((x) => x.id !== s.id))} />
        ))}
      </ul>
    </article>
  );
}
