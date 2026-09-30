import { useMemo, useState } from 'react';
import { findColor, type Sex } from '../domain/colors';
import { planCycle, totalsByChild } from '../domain/plan';
import { countStock, key, newDD } from '../domain/stock';
import type { JournalEntry } from '../domain/types';
import { useEtable } from '../store/EtableContext';
import { MateDialog, type MateRequest } from './MateDialog';
import { MiniBar, type BarTarget } from './MiniBar';
import { ConfirmButton, DDTag, SexMark, Swatch } from './ui';

function Chip({ r }: { r: JournalEntry }) {
  return (
    <span className={`chip${r.rc === r.child ? '' : ' miss'}`} title={`${r.m} × ${r.f}`}>
      <Swatch name={r.m} size={11} />×<Swatch name={r.f} size={11} /> → <Swatch name={r.rc} size={13} /> {r.rc} <SexMark x={r.rs} />
      {r.rc2 && r.rs2 && <> + <Swatch name={r.rc2} size={13} /> {r.rc2} <SexMark x={r.rs2} /></>}
    </span>
  );
}

export function CouplesPage() {
  const { dd, act, settings, updateSettings } = useEtable();
  const [open, setOpen] = useState<BarTarget | null>(null);
  const [mate, setMate] = useState<MateRequest | null>(null);
  const [targetInput, setTargetInput] = useState(settings.target);
  const T = findColor(targetInput);
  const P = settings.places;

  const plan = useMemo(() => (T?.recipe && P >= 2 ? planCycle(dd, T.name, P) : null), [dd, T, P]);
  const stock = useMemo(() => countStock(dd), [dd]);
  const journal = settings.journal;

  const setTarget = (v: string) => {
    setTargetInput(v);
    const c = findColor(v);
    if (c) updateSettings({ target: c.name });
  };

  const openFor = (child: string) => {
    if (open?.child === child) { setOpen(null); return; }
    const lines = plan?.crossings.filter((r) => r.child === child) ?? [];
    const pick = lines.find((r) => stock[key(r.m, 'M')] && stock[key(r.f, 'F')]) ?? lines[0];
    if (pick) setOpen({ m: pick.m, f: pick.f, child });
  };

  const header = (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="bar" style={{ margin: 0 }}>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>DD visée
          <input list="colorList" value={targetInput} style={{ minWidth: 220 }} onChange={(e) => setTarget(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>Places libres dans l'enclos
          <input type="number" min={0} value={P} style={{ width: 80 }} onChange={(e) => updateSettings({ places: Math.max(0, +e.target.value || 0) })} />
        </label>
      </div>
    </div>
  );

  let body;
  if (!T) body = <p className="muted">Choisis la DD visée.</p>;
  else if (!T.recipe) body = <p className="muted">{T.name} est une génération 1 : elle s'achète ou se capture, pas de croisement.</p>;
  else if (!plan) body = <p className="muted">Indique au moins 2 places libres.</p>;
  else {
    const nb = Object.values(plan.buy).reduce((s, v) => s + v, 0);
    const used = plan.crossings.reduce((s, r) => s + r.n, 0) * 2;
    const ratio = [...plan.weights].filter(([n]) => n !== T.name)
      .sort((a, b) => findColor(b[0])!.gen - findColor(a[0])!.gen).map(([n, k]) => `${k} ${n}`).join(' · ');
    const totals = totalsByChild(plan.crossings);
    const children = new Set(totals.map((t) => t.child));
    const orphans = journal.filter((r) => !children.has(r.child));
    const side = (c: string, x: Sex, b: number) => <><DDTag c={c} x={x} /> <span className={b ? 'ko' : 'muted'}>({b ? 'achat' : 'stock'})</span></>;
    body = (
      <>
        <div className={nb ? 'gridfit' : ''}>
          {nb > 0 && (
            <div className="panel" style={{ borderColor: 'var(--warn)' }}>
              <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>À acheter : {nb} DD</h2>
              {Object.entries(plan.buy).sort().map(([k, v]) => {
                const [c, x] = k.split('|') as [string, Sex];
                return (
                  <div key={k} style={{ fontSize: '1.1rem', margin: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span><b>{v}</b> <DDTag c={c} x={x} size={18} /></span>
                    <button className="btn small" style={{ marginLeft: 'auto' }}
                      onClick={() => act('achat', `${c} ${x === 'M' ? '♂' : '♀'}`, { add: [newDD(c, x)] })}>Acheté</button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="panel">
            <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>
              Croisements à faire{' '}
              {!nb && <span className="ok" style={{ fontSize: '.85rem', fontFamily: 'inherit', marginLeft: 8 }}>✓ aucun achat nécessaire</span>}
            </h2>
            <div className="xlines">
              {plan.crossings.map((r) => (
                <div className="xline" key={`${r.m}|${r.f}|${r.bm}|${r.bf}`}>
                  <b>{r.n}×</b> {side(r.m, 'M', r.bm)} × {side(r.f, 'F', r.bf)} → <Swatch name={r.child} size={14} /> <b>{r.child}</b>
                </div>
              ))}
            </div>
            <p className="note" style={{ marginBottom: 0 }}>{used}/{P} places.{ratio && ` Ratio pour 1 ${T.name} : ${ratio}.`}</p>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Total des croisements</h2>
          {totals.map((t) => (
            <div className="trow" key={t.child}>
              <div className="lead">
                <b>{t.n}×</b> <span className="neutral" aria-label="sexe indifférent">–</span> <Swatch name={t.child} size={16} /> <b>{t.child}</b> <span className="muted">G{t.gen}</span>
              </div>
              <div className="slots">
                {journal.filter((r) => r.child === t.child).map((r) => <Chip key={r.t} r={r} />)}
                <button className="btn small" aria-expanded={open?.child === t.child} onClick={() => openFor(t.child)}>Noter un accouplement</button>
              </div>
              {open?.child === t.child && (
                <MiniBar {...open} onClose={() => setOpen(null)}
                  onFlip={open.m !== open.f && stock[key(open.f, 'M')] && stock[key(open.m, 'F')] ? () => setOpen({ ...open, m: open.f, f: open.m }) : undefined}
                  onOther={() => { setMate({ ...open, babyPre: '', journal: true }); setOpen(null); }} />
              )}
            </div>
          ))}
          {orphans.length > 0 && (
            <div className="trow"><div className="lead muted">Autres accouplements notés</div>
              <div className="slots">{orphans.map((r) => <Chip key={r.t} r={r} />)}</div></div>
          )}
          <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <p className="note" style={{ margin: 0 }}>Recalculé à chaque changement de ton stock. Contour vert : couleur visée obtenue ; rouge : autre couleur.</p>
            {journal.length > 0 && (
              <ConfirmButton onConfirm={() => updateSettings({ journal: [] })}>Vider le journal ({journal.length})</ConfirmButton>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <section>
      {header}
      {body}
      <MateDialog req={mate} onClose={() => setMate(null)} />
    </section>
  );
}
