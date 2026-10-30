import { findColorIn } from '../domain/colors';
import { useEtable } from '../store/EtableContext';
import { SexMark, Swatch } from './ui';

export function Header() {
  const { dd } = useEtable();
  const males = dd.filter((d) => d.sexe === 'M').length;
  const herd = [...dd].sort((a, b) => (findColorIn(a.espece, a.couleur)?.gen ?? 0) - (findColorIn(b.espece, b.couleur)?.gen ?? 0));
  return (
    <header className="top">
      <div>
        <h1>Étable</h1>
        <div className="herd" aria-hidden="true">
          {herd.map((d) => <Swatch key={d.id} name={d.couleur} size={14} />)}
        </div>
      </div>
      <div className="counts">
        <span><b>{dd.length}</b>montures</span>
        <span><b className="ok">{dd.filter((d) => d.etat === 'feconde').length}</b>fécondes</span>
        <span><b>{dd.filter((d) => d.etat === 'fertile').length}</b>fertiles</span>
        <span><b className="sex-M">{males} <SexMark x="M" /></b>mâles</span>
        <span><b className="sex-F">{dd.length - males} <SexMark x="F" /></b>femelles</span>
      </div>
    </header>
  );
}
