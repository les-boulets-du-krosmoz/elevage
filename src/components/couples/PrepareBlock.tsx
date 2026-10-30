import { useMemo } from 'react';
import type { Color, Sex } from '../../domain/colors';
import { planCycle } from '../../domain/plan';
import { newMonture } from '../../domain/stock';
import type { Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { MountTag, SexMark, Swatch } from '../ui';

const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');

/**
 * Bloc 2 : le plan d'achats des dragodindes pour un nombre de places réglable, en couples complets.
 * Il part de ce qui reste après « À faire maintenant » (fertiles et fécondes non utilisées), et dit quoi acheter.
 * Les enclos ne sont plus suivis : on ne place rien, on prépare.
 */
export function PrepareBlock({ T, rest }: { T: Color; rest: Monture[] }) {
  const { act, settings, updateSettings } = useEtable();
  const P = settings.places;
  const plan = useMemo(() => (P >= 2 ? planCycle(rest, T.name, P) : null), [rest, T, P]);
  const buy = plan ? Object.entries(plan.buy).filter(([, n]) => n > 0).sort() : [];
  const nbBuy = buy.reduce((s, [, n]) => s + n, 0);
  const used = plan ? plan.crossings.reduce((s, r) => s + r.n, 0) * 2 : 0;
  const side = (c: string, x: Sex, b: 0 | 1) => (
    <><MountTag c={c} x={x} /> <span className={b ? 'ko' : 'muted'}>({b ? 'à acheter' : 'étable'})</span></>
  );

  return (
    <>
      <div className="block-title">
        <h2>2 · À préparer</h2>
        <label className="inline">Places
          <input type="number" min={0} step={2} value={P} aria-label="Places pour les couples" style={{ width: 80 }}
            onChange={(e) => updateSettings({ places: Math.max(0, Math.floor(+e.target.value || 0)) })} />
        </label>
        <span className="note" style={{ margin: 0 }}>couples complets, avec ce qui reste après « À faire maintenant »</span>
      </div>
      {!plan ? <p className="panel muted">Indique au moins 2 places.</p> : (
        <>
          <div className="panel" style={{ marginBottom: 12, borderColor: nbBuy ? 'var(--warn)' : undefined }}>
            <h3 style={{ fontSize: '1.15rem' }}>{nbBuy ? `À acheter : ${nbBuy} DD` : '✓ Aucun achat nécessaire'}</h3>
            {buy.map(([k, n]) => {
              const [c, x] = k.split('|') as [string, Sex];
              return (
                <div key={k} className="planline">
                  <span style={{ fontSize: '1.05rem' }}><b>{n}</b> <Swatch name={c} size={16} /> <SexMark x={x} /> {c}</span>
                  <button className="btn small" style={{ marginLeft: 'auto' }}
                    onClick={() => act('achat', `1 ${c} ${sym(x)} achetée`, { add: [newMonture(c, x, undefined, undefined, { etat: 'fertile' })] })}>Acheté</button>
                </div>
              );
            })}
          </div>
          <div className="panel" role="region" aria-label="Couples à préparer">
            <h3 style={{ fontSize: '1.15rem' }}>Couples à préparer</h3>
            {plan.crossings.map((r) => (
              <div className="planline" key={`${r.m}|${r.f}|${r.bm}|${r.bf}`}>
                <b>{r.n}×</b> {side(r.m, 'M', r.bm)} × {side(r.f, 'F', r.bf)} → <Swatch name={r.child} size={14} /> <b>{r.child}</b>
              </div>
            ))}
            <p className="note" style={{ marginBottom: 0 }}>{used}/{P} places. Chaque « Acheté » ajoute la monture à l'étable, fertile, et fait baisser les achats de 1.</p>
          </div>
        </>
      )}
    </>
  );
}
