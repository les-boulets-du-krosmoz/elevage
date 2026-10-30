import { findColorIn, type Espece } from '../../domain/colors';
import { pistes } from '../../domain/conseils';
import type { RecettesEspece } from '../../domain/recettes';
import type { Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { MountTag, SexMark, Swatch } from '../ui';

/**
 * Les montures que le site garde en mémoire pour les ressortir au bon moment : celles « à tester »
 * (tombées sous la génération de leurs parents) et les reproductrices. Chacune porte le nom à lui donner en jeu.
 */
export function ARetenir({ espece, rec }: { espece: Espece; rec: RecettesEspece }) {
  const { dd, act } = useEtable();
  const list = dd.filter((d) => d.espece === espece && (d.aTester || d.reproducteur))
    .sort((a, b) => Number(!!b.reproducteur) - Number(!!a.reproducteur) || a.created - b.created);
  if (!list.length) return null;
  const oublier = (d: Monture) => {
    const { aTester: _t, reproducteur: _r, nom: _n, ...rest } = d;
    act('ajout', `${d.nom ?? d.couleur} : plus suivie`, { del: [d], add: [rest] });
  };
  return (
    <div className="panel retenir" style={{ marginTop: 12 }} role="region" aria-label="À retenir">
      <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>À retenir</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {list.map((d) => {
          const p = d.aTester ? pistes(espece, d, dd, rec).slice(0, 3) : [];
          return (
            <li key={d.id}>
              <b>{d.nom ?? '—'}</b> <MountTag c={findColorIn(espece, d.couleur)?.name ?? d.couleur} x={d.sexe} />{' '}
              <span className="muted">{d.etat === 'feconde' ? 'féconde' : 'fertile'}</span>
              {d.reproducteur && <span className="badge" style={{ marginLeft: 6 }}>reproducteur : 2 bébés</span>}
              {(d.pere || d.mere) && <span className="muted"> · parents {d.pere} × {d.mere}</span>}
              {p.length > 0 && (
                <div className="note" style={{ margin: '2px 0 0 18px' }}>
                  À tester avec{' '}
                  {p.map((x, i) => (
                    <span key={`${x.avec}|${x.vise}`}>{i ? ', ' : ''}<SexMark x={x.sexe} /> {x.avec}{x.dispo ? ` (${x.dispo} féconde${x.dispo > 1 ? 's' : ''})` : ''} → <Swatch name={x.vise} size={11} /> {x.vise} possible</span>
                  ))}
                </div>
              )}
              <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={() => oublier(d)}>Oublier</button>
            </li>
          );
        })}
      </ul>
      <p className="note" style={{ marginBottom: 0 }}>Donne-leur ce nom en jeu dès la naissance : tu les retrouveras sans chercher. Un reproducteur donne deux bébés : place-le dans le lot le plus utile.</p>
    </div>
  );
}
