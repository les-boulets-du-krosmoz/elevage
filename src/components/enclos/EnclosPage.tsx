import { PALIERS } from '../../domain/temps';
import { useEtable } from '../../store/EtableContext';
import { ENCLOS_MAX } from '../../store/storage';
import { CarteCalcul } from './Calculateur';
import { CalculateurNiveau, VitessesPaliers } from './Outils';

/**
 * Page Enclos : calculateur de sérénité. Un palier global pour tous les enclos, une carte par enclos,
 * de 1 à 10 simulations par carte. Rien ici ne suit les montures de l'étable.
 */
export function EnclosPage() {
  const { settings, updateSettings } = useEtable();
  const n = settings.nbEnclos;
  const { palier } = settings.calc;
  const vitesse = settings.vitesses[palier - 1];
  const setCount = (k: number) => { if (k >= 1 && k <= ENCLOS_MAX) updateSettings({ nbEnclos: k }); };

  return (
    <section>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="bar" style={{ margin: 0, alignItems: 'center' }}>
          <span className="cnt">
            <b>Enclos</b>
            <button className="pm" aria-label="Retirer un enclos" disabled={n <= 1} onClick={() => setCount(n - 1)}>−</button>
            <b>{n}</b>
            <button className="pm" aria-label="Ajouter un enclos" disabled={n >= ENCLOS_MAX} onClick={() => setCount(n + 1)}>+</button>
          </span>
          <span className="palier-ctl">
            <b>Palier des jauges</b>
            <span className="seg" role="group" aria-label="Palier des jauges">
              {PALIERS.map((p) => (
                <button key={p} aria-pressed={palier === p} onClick={() => updateSettings({ calc: { ...settings.calc, palier: p } })}>P{p}</button>
              ))}
            </span>
            <span className="muted">{vitesse} points toutes les 10 s</span>
          </span>
        </div>
        <p className="note" style={{ margin: '8px 0 0' }}>
          Saisis la sérénité lue en jeu. Négative, elle monte avec la jauge de gain ; positive, elle descend avec la jauge de perte.
          Le visage du même côté donne le temps pour y rester au plus près de 0, l'autre pour passer de l'autre côté. Précision : 10 s.
        </p>
      </div>
      <div className="enclos-grid">
        {Array.from({ length: n }, (_, i) => <CarteCalcul key={i + 1} id={i + 1} vitesse={vitesse} />)}
      </div>
      <div className="outils">
        <VitessesPaliers />
        <CalculateurNiveau />
      </div>
    </section>
  );
}
