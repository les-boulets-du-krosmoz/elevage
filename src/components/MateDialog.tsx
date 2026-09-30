import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { colorIndex, findColor, treeColors, type Sex } from '../domain/colors';
import { ancestry, newDD, treeScore } from '../domain/stock';
import { useEtable } from '../store/EtableContext';

export interface MateRequest {
  m: string;
  f: string;
  /** Couleur visée, pour le journal (vide pour une saisie libre). */
  child: string;
  /** Couleur pré-remplie pour le bébé 1. */
  babyPre: string;
  /** Inscrit l'accouplement dans le journal de la page Couples. */
  journal: boolean;
}

/** Formulaire complet : choix des DD précises, 1 ou 2 bébés de n'importe quelle couleur. */
export function MateDialog({ req, onClose }: { req: MateRequest | null; onClose: () => void }) {
  const { dd, act, settings } = useEtable();
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (req && !d.open) { setErr(''); d.showModal(); }
    if (!req && d.open) d.close();
  }, [req]);

  const useful = useMemo(() => {
    const t = findColor(settings.target);
    return t ? treeColors(t.name) : new Set<string>();
  }, [settings.target]);
  const list = (x: Sex) =>
    dd.filter((d) => d.sexe === x && findColor(d.couleur))
      .sort((a, b) => colorIndex(findColor(a.couleur)!) - colorIndex(findColor(b.couleur)!) || treeScore(b, useful) - treeScore(a, useful) || a.created - b.created);
  const pre = (x: Sex, c: string) => list(x).find((d) => findColor(d.couleur)?.name === c)?.id ?? '';

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const F = new FormData(e.currentTarget);
    const pm = dd.find((d) => d.id === F.get('pm'));
    const pf = dd.find((d) => d.id === F.get('pf'));
    if (!pm || !pf) { setErr('Choisis les deux parents.'); return; }
    const babies: { c: string; x: Sex }[] = [];
    for (const i of [0, 1]) {
      const raw = String(F.get('c' + i) ?? '').trim();
      if (!raw) continue;
      const c = findColor(raw);
      if (!c) { setErr(`« ${raw} » n'est pas une couleur connue.`); return; }
      babies.push({ c: c.name, x: F.get('s' + i) === 'F' ? 'F' : 'M' });
    }
    if (req?.journal && !babies.length) { setErr('Indique le résultat obtenu.'); return; }
    const kids = babies.map((b) => newDD(b.c, b.x, pm, pf));
    const mc = findColor(pm.couleur)!.name, fc = findColor(pf.couleur)!.name;
    act('accouplement', `♂ ${mc} × ♀ ${fc} → ${kids.length ? kids.map((k) => `${k.couleur} ${k.sexe === 'M' ? '♂' : '♀'}`).join(' + ') : 'aucun bébé noté'}`, {
      add: kids, del: [pm, pf],
      journal: req?.journal && babies[0] ? { child: req.child, m: mc, f: fc, rc: babies[0].c, rs: babies[0].x, rc2: babies[1]?.c ?? '', rs2: babies[1]?.x ?? '' } : null,
    });
    onClose();
  };

  const opt = (x: Sex) => list(x).map((d) => (
    <option key={d.id} value={d.id}>
      {d.couleur} — {ancestry(d)}{useful.size && (d.pere || d.mere) ? ` · arbre ${treeScore(d, useful)}/8` : ''}
    </option>
  ));

  return (
    <dialog ref={ref} onClose={onClose}>
      {req && (
        <form onSubmit={submit} key={`${req.m}|${req.f}|${req.child}`}>
          <h2>Accouplement{req.child ? ` : ${req.child}` : ''}</h2>
          <p className="note">Les deux parents sont retirés de ton enclos. Le bébé garde la trace de ses parents et grands-parents. Les parents les mieux placés pour ta cible sont proposés en premier.</p>
          <div className="fields" style={{ gridTemplateColumns: '1fr' }}>
            <label><span className="sex-M">♂ Père</span>
              <select name="pm" required defaultValue={pre('M', req.m)}><option value="">Choisir…</option>{opt('M')}</select></label>
            <label><span className="sex-F">♀ Mère</span>
              <select name="pf" required defaultValue={pre('F', req.f)}><option value="">Choisir…</option>{opt('F')}</select></label>
          </div>
          {[0, 1].map((i) => (
            <fieldset key={i}>
              <legend>Bébé {i + 1}{i ? ' (facultatif, capacité Reproducteur)' : req.journal ? ' : résultat obtenu' : ' (facultatif)'}</legend>
              <div className="fields">
                <label>Couleur <input name={'c' + i} list="colorList" defaultValue={i ? '' : req.babyPre} autoComplete="off" /></label>
                <label>Sexe <select name={'s' + i}><option value="M">♂ Mâle</option><option value="F">♀ Femelle</option></select></label>
              </div>
            </fieldset>
          ))}
          <p className="ko" role="alert">{err}</p>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn">Valider</button>
          </div>
        </form>
      )}
    </dialog>
  );
}
