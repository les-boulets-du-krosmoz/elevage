import { findColor } from '../domain/colors';
import { useEtable } from '../store/EtableContext';
import { Swatch } from './ui';

export function Header() {
  const { dd } = useEtable();
  const males = dd.filter((d) => d.sexe === 'M').length;
  const herd = [...dd].sort((a, b) => (findColor(a.couleur)?.gen ?? 0) - (findColor(b.couleur)?.gen ?? 0));
  return (
    <header className="top">
      <div>
        <h1>Étable</h1>
        <div className="herd" aria-hidden="true">
          {herd.map((d) => <Swatch key={d.id} name={d.couleur} size={14} />)}
        </div>
      </div>
      <div className="counts">
        <span><b>{dd.length}</b>DD fertiles</span>
        <span><b className="sex-M">{males} ♂</b>mâles</span>
        <span><b className="sex-F">{dd.length - males} ♀</b>femelles</span>
      </div>
    </header>
  );
}
