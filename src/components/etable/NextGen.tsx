import { useMemo, useState } from 'react';
import { nextGeneration } from '../../domain/plan';
import { countStock, key } from '../../domain/stock';
import { useEtable } from '../../store/EtableContext';
import { MiniBar, type BarTarget } from '../MiniBar';
import { MountTag, Swatch } from '../ui';

/** Croisements de dragodindes possibles avec les fécondes, vers la génération suivante. */
export function NextGen({ onOther }: { onOther: (b: BarTarget) => void }) {
  const { dd } = useEtable();
  const [open, setOpen] = useState<BarTarget | null>(null);
  const ddOnly = useMemo(() => dd.filter((d) => d.espece === 'dragodinde'), [dd]);
  const rows = useMemo(() => nextGeneration(ddOnly), [ddOnly]);
  const stock = useMemo(() => countStock(ddOnly.filter((d) => d.etat === 'feconde')), [ddOnly]);
  const canFlip = (b: BarTarget) => b.m !== b.f && !!stock[key(b.f, 'M')] && !!stock[key(b.m, 'F')];
  const isOpen = (m: string, f: string, child: string) => !!open && open.child === child && open.m === m && open.f === f;
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '1.3rem', marginBottom: 2 }}>
        Accouplements possibles vers la génération suivante{' '}
        <span className="hint" title="Chaque ligne est calculée seule : une même DD peut compter dans plusieurs lignes. Après un accouplement, d'autres lignes peuvent baisser aussi.">(pas cumulatif)</span>
      </h2>
      <p className="note" style={{ margin: '0 0 8px' }}>Avec tes seules fécondes. Clique sur un couple pour noter le résultat : les deux parents sont retirés et le bébé arrive fertile.</p>
      {!rows.length && <p className="muted">Aucun croisement possible avec tes fécondes actuelles.</p>}
      {rows.map((r) => (
        <div className="trow" key={r.color.name}>
          <div className="lead">
            <span className="muted">G{r.color.gen}</span> <Swatch name={r.color.name} size={16} /> <b>{r.color.name}</b>{' '}
            <span className="muted">· {r.total} couple{r.total > 1 ? 's' : ''} max</span>
          </div>
          <div className="slots" style={{ marginLeft: 0 }}>
            {r.options.map((o) => (
              <button key={o.m} className="pair" aria-expanded={isOpen(o.m, o.f, r.color.name)}
                onClick={() => setOpen(isOpen(o.m, o.f, r.color.name) ? null : { m: o.m, f: o.f, child: r.color.name })}>
                {o.n}× <MountTag c={o.m} x="M" size={12} /> × <MountTag c={o.f} x="F" size={12} />
              </button>
            ))}
          </div>
          {open?.child === r.color.name && (
            <MiniBar {...open} onClose={() => setOpen(null)}
              onFlip={canFlip(open) ? () => setOpen({ ...open, m: open.f, f: open.m }) : undefined}
              onOther={() => { onOther(open); setOpen(null); }} />
          )}
        </div>
      ))}
    </div>
  );
}
