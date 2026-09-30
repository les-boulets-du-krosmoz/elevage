import { useEffect, useRef, useState } from 'react';
import { findColor, type Sex } from '../domain/colors';
import { bestParent, newDD } from '../domain/stock';
import { useEtable } from '../store/EtableContext';
import { DDTag, SexMark, Swatch } from './ui';

export interface BarTarget { m: string; f: string; child: string }

interface Props extends BarTarget {
  onClose: () => void;
  /** Inverse les sexes des parents (absent si impossible). */
  onFlip?: () => void;
  /** Ouvre le formulaire complet pour une couleur inattendue. */
  onOther: () => void;
}

type Baby = { c: string; x: Sex };

/** Barre de résultat d'un accouplement : un clic retire les parents et ajoute le bébé. */
export function MiniBar({ m, f, child, onClose, onFlip, onOther }: Props) {
  const { dd, act, settings } = useEtable();
  const [repro, setRepro] = useState(false);
  const [babies, setBabies] = useState<(Baby | undefined)[]>([]);
  const [cur, setCur] = useState(0);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [m, f]);
  useEffect(() => { setBabies([]); setCur(0); }, [repro, m, f]);

  const has = (c: string, x: Sex) => dd.some((d) => findColor(d.couleur)?.name === c && d.sexe === x);
  const ok = has(m, 'M') && has(f, 'F');
  const others = [...new Set([m, f])].filter((c) => c !== child);

  const commit = (list: Baby[]) => {
    const target = findColor(settings.target)?.name ?? null;
    const pm = bestParent(dd, m, 'M', target);
    const pf = bestParent(dd, f, 'F', target);
    if (!pm || !pf) return;
    const kids = list.map((b) => newDD(b.c, b.x, pm, pf));
    act('accouplement', `♂ ${m} × ♀ ${f} → ${kids.map((k) => `${k.couleur} ${k.sexe === 'M' ? '♂' : '♀'}`).join(' + ')}`, {
      add: kids, del: [pm, pf],
      journal: { child, m, f, rc: list[0].c, rs: list[0].x, rc2: list[1]?.c ?? '', rs2: list[1]?.x ?? '' },
    });
    onClose();
  };

  const pick = (c: string, x: Sex) => {
    if (!repro) { commit([{ c, x }]); return; }
    const next = [...babies];
    next[cur] = { c, x };
    setBabies(next);
    setCur(!next[0] ? 0 : !next[1] ? 1 : cur);
  };

  const res = (c: string, x: Sex, win = false) => (
    <button key={c + x} ref={win && x === 'M' ? first : undefined} className={`res ${win ? 'win' : 'alt'}`} onClick={() => pick(c, x)}>
      <Swatch name={c} size={13} /> {c} <SexMark x={x} />
    </button>
  );

  return (
    <div className="mbar" role="group" aria-label="Résultat de l'accouplement" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <span className="ttl"><DDTag c={m} x="M" size={12} /> × <DDTag c={f} x="F" size={12} /></span>
      {onFlip && <button className="res alt" onClick={onFlip} title="Inverser les sexes des parents">⇄</button>}
      <button className="x" onClick={onClose} aria-label="Fermer">✕</button>
      {repro && (
        <div className="slots2">
          {[0, 1].map((i) => (
            <button key={i} className={`slot${cur === i ? ' on' : ''}`} onClick={() => setCur(i)}>
              Bébé {i + 1} : {babies[i] ? <DDTag c={babies[i]!.c} x={babies[i]!.x} size={12} /> : <span className="muted">à choisir</span>}
            </button>
          ))}
          <button className="res win" disabled={!babies[0] || !babies[1]} onClick={() => commit(babies as Baby[])}>Valider les 2 bébés</button>
        </div>
      )}
      {ok ? (
        <>
          <span className="sep">{repro ? `Bébé ${cur + 1} :` : 'Résultat :'}</span>
          {res(child, 'M', true)}{res(child, 'F', true)}
          {others.length > 0 && <span className="sep">autre couleur :</span>}
          {others.flatMap((c) => [res(c, 'M'), res(c, 'F')])}
          <button className="res alt" onClick={onOther}>Autre…</button>
          <label><input type="checkbox" checked={repro} onChange={(e) => setRepro(e.target.checked)} /> Parents reproducteurs (2 bébés)</label>
        </>
      ) : (
        <span className="ko">Il te manque {[!has(m, 'M') && `un ♂ ${m}`, !has(f, 'F') && `une ♀ ${f}`].filter(Boolean).join(' et ')} dans ton enclos.</span>
      )}
    </div>
  );
}
