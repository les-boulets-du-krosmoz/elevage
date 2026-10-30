import { useMemo, useState } from 'react';
import type { Color } from '../../domain/colors';
import { totalsByChild, type Crossing } from '../../domain/plan';
import { planSexes } from '../../domain/sexPlan';
import { countStock, key } from '../../domain/stock';
import type { JournalEntry, Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { MateDialog, type MateRequest } from '../MateDialog';
import { MiniBar, type BarTarget } from '../MiniBar';
import { ConfirmButton, MountTag, SexMark, Swatch } from '../ui';
import { fmtK, pct } from './format';
import { JournalChip } from './JournalChip';

/** Bloc 1 : les croisements possibles maintenant, avec les seules fécondes, et le journal. */
export function NowBlock({ T, dd, now }: { T: Color; dd: Monture[]; now: Crossing[] }) {
  const { settings, updateSettings } = useEtable();
  const [open, setOpen] = useState<BarTarget | null>(null);
  const [mate, setMate] = useState<MateRequest | null>(null);
  const fec = useMemo(() => countStock(dd.filter((d) => d.etat === 'feconde')), [dd]);
  const journal = settings.journal;
  const totals = totalsByChild(now);
  const sexes = planSexes(dd, now, T.name);
  const price = settings.sexItemPriceK;
  const children = new Set(totals.map((t) => t.child));
  const orphans = journal.filter((r) => !children.has(r.child));

  const openFor = (child: string) => {
    if (open?.child === child) { setOpen(null); return; }
    const lines = now.filter((r) => r.child === child);
    const pick = lines.find((r) => fec[key(r.m, 'M')] && fec[key(r.f, 'F')]) ?? lines[0];
    if (pick) setOpen({ m: pick.m, f: pick.f, child });
  };

  return (
    <>
      <div className="block-title">
        <h2>1 · À faire maintenant</h2>
        <span className="note" style={{ margin: 0 }}>avec tes fécondes, sans achat</span>
      </div>
      {!now.length ? (
        <p className="panel muted">Aucun croisement vers {T.name} n'est possible avec tes fécondes actuelles. Regarde le bloc « À préparer ».</p>
      ) : (
        <div className="panel">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Croisements possibles</h3>
          <div className="xlines">
            {now.map((r) => (
              <div className="xline" key={`${r.m}|${r.f}`}>
                <b>{r.n}×</b> <MountTag c={r.m} x="M" /> × <MountTag c={r.f} x="F" /> → <Swatch name={r.child} size={14} /> <b>{r.child}</b>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '1.05rem', margin: '14px 0 4px' }}>Total et résultats</h3>
          {totals.map((t) => (
            <div className="trow" key={t.child}>
              <div className="lead">
                <b>{t.n}×</b> <span className="neutral" aria-label="sexe indifférent">–</span> <Swatch name={t.child} size={16} /> <b>{t.child}</b> <span className="muted">G{t.gen}</span>
              </div>
              <div className="slots">
                {journal.filter((r) => r.child === t.child).map((r) => <JournalChip key={r.t} r={r} />)}
                <button className="btn small" aria-expanded={open?.child === t.child} onClick={() => openFor(t.child)}>Noter un accouplement</button>
              </div>
              {open?.child === t.child && (
                <MiniBar {...open} onClose={() => setOpen(null)}
                  onFlip={open.m !== open.f && fec[key(open.f, 'M')] && fec[key(open.m, 'F')] ? () => setOpen({ ...open, m: open.f, f: open.m }) : undefined}
                  onOther={() => { setMate({ ...open, babyPre: '', journal: true }); setOpen(null); }} />
              )}
            </div>
          ))}
          {orphans.length > 0 && (
            <div className="trow"><div className="lead muted">Autres accouplements notés</div>
              <div className="slots">{orphans.map((r) => <JournalChip key={r.t} r={r} />)}</div></div>
          )}

          {Object.keys(sexes.next).length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Sexes à demander (Animakina)</h3>
              {Object.entries(sexes.forced).map(([c, f]) => (
                <div key={c} className="xline">
                  <Swatch name={c} size={14} /> <b>{c}</b> : imposer{' '}
                  {f.M > 0 && <span className="sex-M">{f.M} <SexMark x="M" /></span>}{f.M > 0 && f.F > 0 && ' et '}{f.F > 0 && <span className="sex-F">{f.F} <SexMark x="F" /></span>}
                  {' '}sur {sexes.babies[c]} bébé{sexes.babies[c] > 1 ? 's' : ''}
                </div>
              ))}
              <p style={{ margin: '8px 0 4px' }}>
                Couples formés ensuite :{' '}
                {Object.entries(sexes.next).map(([c, n], i) => (
                  <span key={c}>{i ? ', ' : ''}<b>{n.couples}</b> <Swatch name={c} size={12} /> {c}{n.withItems < n.couples ? ` (dont ${n.couples - n.withItems} sans Animakina)` : ''}</span>
                ))}
              </p>
              <div className="bar" style={{ margin: '6px 0 0', alignItems: 'center' }}>
                <b>{sexes.items} Animakina{sexes.items > 1 ? 's' : ''} ≈ {fmtK(sexes.items * price)}</b>
                <label className="inline" style={{ marginLeft: 'auto' }}>Prix de l'Animakina
                  <input type="number" min={0} step={500} value={price} style={{ width: 100 }}
                    onChange={(e) => updateSettings({ sexItemPriceK: Math.max(0, +e.target.value || 0) })} /> kamas
                </label>
              </div>
            </div>
          )}

          <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <p className="note" style={{ margin: 0 }}>
              Les bébés arrivent fertiles dans ton étable. Contour vert : couleur visée obtenue ; rouge : autre couleur. ⚥ Animakina, ☘ Optimakina.
              {journal.length > 0 && (() => {
                const used = journal.filter((r) => r.sexItem).length;
                const withC = journal.filter((r) => r.chanceItem), without = journal.filter((r) => !r.chanceItem);
                const ok = (l: JournalEntry[]) => l.filter((r) => r.rc === r.child).length;
                return (<><br />Animakinas utilisées : <b>{used}</b> (≈ {fmtK(used * price)}). Couleur visée obtenue : avec Optimakina <b>{pct(ok(withC), withC.length)}</b> ({withC.length}), sans <b>{pct(ok(without), without.length)}</b> ({without.length}).</>);
              })()}
            </p>
            {journal.length > 0 && <ConfirmButton onConfirm={() => updateSettings({ journal: [] })}>Vider le journal ({journal.length})</ConfirmButton>}
          </div>
        </div>
      )}
      <MateDialog req={mate} onClose={() => setMate(null)} />
    </>
  );
}
