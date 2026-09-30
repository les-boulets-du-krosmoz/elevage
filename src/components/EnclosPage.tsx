import { Fragment, useMemo, useState } from 'react';
import { COLORS, findColor, type Color, type Sex } from '../domain/colors';
import { nextGeneration } from '../domain/plan';
import { countStock, key, newDD } from '../domain/stock';
import { useEtable } from '../store/EtableContext';
import { MateDialog, type MateRequest } from './MateDialog';
import { MiniBar, type BarTarget } from './MiniBar';
import { DDTag, Swatch } from './ui';

const FOLD_KEY = 'etable-fold';
const readFold = (): string[] => { try { return JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]'); } catch { return []; } };
const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');

export function EnclosPage() {
  const [mate, setMate] = useState<MateRequest | null>(null);
  return (
    <section>
      <AddForm onManual={() => setMate({ m: '', f: '', child: '', babyPre: '', journal: false })} />
      <StockTable />
      <NextGen onOther={(b) => setMate({ ...b, babyPre: '', journal: true })} />
      <MateDialog req={mate} onClose={() => setMate(null)} />
    </section>
  );
}

function AddForm({ onManual }: { onManual: () => void }) {
  const { act } = useEtable();
  const [c, setC] = useState('');
  const [x, setX] = useState<Sex>('M');
  const [q, setQ] = useState(1);
  const [err, setErr] = useState('');
  const add = () => {
    const col = findColor(c);
    if (!col) { setErr('Choisis une couleur de la liste'); return; }
    const n = Math.max(1, Math.min(250, q || 1));
    setErr('');
    act('ajout', `${n} ${col.name} ${sym(x)}`, { add: Array.from({ length: n }, () => newDD(col.name, x)) });
  };
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="bar" style={{ margin: 0 }}>
        <input list="colorList" placeholder="Couleur" aria-label="Couleur" style={{ minWidth: 200 }} value={c}
          onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select aria-label="Sexe" value={x} onChange={(e) => setX(e.target.value as Sex)}>
          <option value="M">♂ Mâle</option><option value="F">♀ Femelle</option>
        </select>
        <input type="number" min={1} value={q} style={{ width: 70 }} aria-label="Quantité" onChange={(e) => setQ(+e.target.value)} />
        <button className="btn" onClick={add}>Ajouter</button>
        {err && <span className="ko">{err}</span>}
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onManual}>Noter un accouplement (formulaire)</button>
      </div>
    </div>
  );
}

function StockTable() {
  const { dd, act } = useEtable();
  const [fold, setFold] = useState<string[]>(readFold);
  const stock = useMemo(() => countStock(dd), [dd]);
  const byGen = useMemo(() => {
    const g = new Map<number, Color[]>();
    for (const c of COLORS) if (stock[key(c.name, 'M')] || stock[key(c.name, 'F')]) g.set(c.gen, [...(g.get(c.gen) ?? []), c]);
    return [...g].sort((a, b) => a[0] - b[0]);
  }, [stock]);

  const toggle = (g: string) => {
    const next = fold.includes(g) ? fold.filter((v) => v !== g) : [...fold, g];
    setFold(next);
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(next)); } catch { /* cache indisponible */ }
  };
  const n = (c: string, x: Sex) => stock[key(c, x)] ?? 0;
  const minus = (c: string, x: Sex) => {
    const d = dd.filter((v) => findColor(v.couleur)?.name === c && v.sexe === x).sort((a, b) => a.created - b.created)[0];
    if (d) act('retrait', `1 ${c} ${sym(x)}`, { del: [d] });
  };
  const cell = (c: string, x: Sex) => (
    <span className="cnt">
      <button className="pm" disabled={!n(c, x)} aria-label={`Retirer 1 ${c} ${sym(x)}`} onClick={() => minus(c, x)}>−</button>
      <b className={`sex-${x}`}>{n(c, x)}</b>
      <button className="pm" aria-label={`Ajouter 1 ${c} ${sym(x)}`} onClick={() => act('ajout', `1 ${c} ${sym(x)}`, { add: [newDD(c, x)] })}>+</button>
    </span>
  );

  if (!dd.length) return <div className="scroll"><p className="empty">Ton enclos est vide. Ajoute tes DD fertiles ci-dessus.</p></div>;
  const TM = byGen.reduce((s, [, cols]) => s + cols.reduce((t, c) => t + n(c.name, 'M'), 0), 0);
  const TF = byGen.reduce((s, [, cols]) => s + cols.reduce((t, c) => t + n(c.name, 'F'), 0), 0);
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Couleur</th><th className="num">♂ Mâles</th><th className="num">♀ Femelles</th><th className="num">Total</th></tr></thead>
        <tbody>
          {byGen.map(([g, cols]) => {
            const M = cols.reduce((s, c) => s + n(c.name, 'M'), 0);
            const F = cols.reduce((s, c) => s + n(c.name, 'F'), 0);
            const open = !fold.includes(String(g));
            return (
              <Fragment key={g}>
                <tr className="genrow" aria-expanded={open} tabIndex={0} title={open ? 'Replier' : 'Déplier'}
                  onClick={() => toggle(String(g))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(String(g)); } }}>
                  <td><span className="caret">▾</span> Génération {g}</td>
                  <td className="num sex-M">{M}</td><td className="num sex-F">{F}</td><td className="num">{M + F}</td>
                </tr>
                {open && cols.map((c) => (
                  <tr key={c.name}>
                    <td><Swatch name={c.name} /> {c.name}</td>
                    <td className="num">{cell(c.name, 'M')}</td>
                    <td className="num">{cell(c.name, 'F')}</td>
                    <td className="num">{n(c.name, 'M') + n(c.name, 'F')}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
          <tr className="total"><td>Total</td><td className="num sex-M">{TM}</td><td className="num sex-F">{TF}</td><td className="num">{TM + TF}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function NextGen({ onOther }: { onOther: (b: BarTarget) => void }) {
  const { dd } = useEtable();
  const [open, setOpen] = useState<BarTarget | null>(null);
  const rows = useMemo(() => nextGeneration(dd), [dd]);
  const stock = useMemo(() => countStock(dd), [dd]);
  const canFlip = (b: BarTarget) => b.m !== b.f && !!stock[key(b.f, 'M')] && !!stock[key(b.m, 'F')];
  const isOpen = (m: string, f: string, child: string) => !!open && open.child === child && open.m === m && open.f === f;
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '1.3rem', marginBottom: 2 }}>
        Accouplements possibles vers la génération suivante{' '}
        <span className="hint" title="Chaque ligne est calculée seule : une même DD peut compter dans plusieurs lignes. Après un accouplement, d'autres lignes peuvent baisser aussi.">(pas cumulatif)</span>
      </h2>
      <p className="note" style={{ margin: '0 0 8px' }}>Clique sur un couple pour noter le résultat : les deux parents sont retirés et le bébé ajouté.</p>
      {!rows.length && <p className="muted">Aucun croisement possible avec ton stock actuel.</p>}
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
                {o.n}× <DDTag c={o.m} x="M" size={12} /> × <DDTag c={o.f} x="F" size={12} />
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
      {rows.length > 0 && <p className="note" style={{ marginBottom: 0 }}>Uniquement les croisements qui font monter d'une génération ; les accouplements de même couleur sont exclus.</p>}
    </div>
  );
}
