import { findColorIn, SPECIES_LABEL, type Espece } from '../domain/colors';
import { useEtable } from '../store/EtableContext';
import { extractTotal, ressourcesExtraction } from '../store/storage';
import { Swatch } from './ui';

/** Nom de la ressource rendue par l'extracteur, quand on la connaît. */
const RESSOURCE: Record<Espece, string> = { muldo: 'ambres', volkorne: 'cornes', dragodinde: 'ressources' };

/**
 * File « À extraire » : les parents stériles que leur règle de destination envoie à l'extracteur.
 * Une monture de génération N rend N ressources ; « Extraites » vide la file d'une espèce (annulable).
 */
export function ExtractionPanel() {
  const { extract, act } = useEtable();
  const especes = (['muldo', 'volkorne', 'dragodinde'] as Espece[]).filter((e) => extractTotal(extract, e) > 0);
  if (!especes.length) return (
    <p className="panel muted" style={{ marginBottom: 16 }}>
      File « À extraire » vide. Les parents y arrivent après un accouplement, selon les règles de destination (page Réglages).
    </p>
  );
  return (
    <div className="panel" style={{ marginBottom: 16 }} role="region" aria-label="À extraire">
      <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>À extraire</h2>
      {especes.map((e) => {
        const lignes = Object.entries(extract[e])
          .map(([c, n]) => ({ c, n, gen: findColorIn(e, c)?.gen ?? 0 }))
          .sort((a, b) => b.gen - a.gen || a.c.localeCompare(b.c, 'fr'));
        const total = extractTotal(extract, e);
        const res = ressourcesExtraction(extract, e);
        return (
          <div key={e} className="extraction">
            <div className="bar" style={{ margin: '4px 0', alignItems: 'baseline' }}>
              <b>{SPECIES_LABEL[e]}</b>
              <span>{total} monture{total > 1 ? 's' : ''} → <b>{res.toLocaleString('fr-FR')} {RESSOURCE[e]}</b></span>
              <button className="btn small" style={{ marginLeft: 'auto' }}
                onClick={() => act('extraction', `${SPECIES_LABEL[e]} extraites : ${total} → ${res} ${RESSOURCE[e]}`,
                  { extract: lignes.map((l) => ({ espece: e, couleur: l.c, delta: -l.n })) })}>
                Extraites ({total})
              </button>
            </div>
            <div className="diffs">
              {lignes.map((l) => (
                <span key={l.c}><b>{l.n}</b> <Swatch name={l.c} size={14} /> {l.c} <span className="muted">G{l.gen}</span></span>
              ))}
            </div>
          </div>
        );
      })}
      <p className="note" style={{ marginBottom: 0 }}>Une monture de génération N rend N ressources à l'extracteur ; la génération 1 ne s'extrait pas.</p>
    </div>
  );
}
