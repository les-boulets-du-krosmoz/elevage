import { Fragment, useMemo, useState } from 'react';
import { colorsOf, findColorIn, type Color, type Espece, type Sex } from '../../domain/colors';
import { countStock, key, newMonture } from '../../domain/stock';
import type { Etat, Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { readPref, writePref } from '../../store/prefs';
import { SexMark, Swatch } from '../ui';

export type Filtre = 'toutes' | 'feconde' | 'fertile';
const FOLD_KEY = 'etable-fold';
const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');

/** Stock d'une espèce par génération, couleur et sexe, avec fécondité. */
export function StockTable({ filtre, espece }: { filtre: Filtre; espece: Espece }) {
  const { dd, act } = useEtable();
  const [fold, setFold] = useState<string[]>(() => readPref<string[]>(FOLD_KEY, []));
  const mine = useMemo(() => dd.filter((d) => d.espece === espece), [dd, espece]);
  const shown = useMemo(() => (filtre === 'toutes' ? mine : mine.filter((d) => d.etat === filtre)), [mine, filtre]);
  const stock = useMemo(() => countStock(shown), [shown]);
  const fec = useMemo(() => countStock(mine.filter((d) => d.etat === 'feconde')), [mine]);
  const byGen = useMemo(() => {
    const g = new Map<number, Color[]>();
    for (const c of colorsOf(espece)) if (stock[key(c.name, 'M')] || stock[key(c.name, 'F')]) g.set(c.gen, [...(g.get(c.gen) ?? []), c]);
    return [...g].sort((a, b) => a[0] - b[0]);
  }, [stock, espece]);

  const toggle = (g: string) => {
    const next = fold.includes(g) ? fold.filter((v) => v !== g) : [...fold, g];
    setFold(next);
    writePref(FOLD_KEY, next);
  };
  const n = (c: string, x: Sex) => stock[key(c, x)] ?? 0;
  const of = (c: string, x: Sex, etat?: Etat) =>
    mine.filter((d) => findColorIn(espece, d.couleur)?.name === c && d.sexe === x && (!etat || d.etat === etat))
      .sort((a, b) => a.created - b.created);

  const minus = (c: string, x: Sex) => {
    // En vue « Toutes », on retire d'abord une fertile (la féconde est plus précieuse)
    const list = filtre === 'toutes' ? [...of(c, x, 'fertile'), ...of(c, x, 'feconde')] : of(c, x, filtre);
    if (list[0]) act('retrait', `1 ${c} ${sym(x)}`, { del: [list[0]] });
  };
  const plus = (c: string, x: Sex) => {
    const etat: Etat = filtre === 'feconde' ? 'feconde' : 'fertile';
    act('ajout', `1 ${c} ${sym(x)} ${etat === 'feconde' ? 'féconde' : 'fertile'}`, { add: [newMonture(c, x, undefined, undefined, { etat, espece })] });
  };
  const promote = (list: Monture[], label: string) => {
    if (!list.length) return;
    act('ajout', `${label} → féconde`, { del: list, add: list.map((d) => ({ ...d, etat: 'feconde' as const })) });
  };
  const cell = (c: string, x: Sex) => {
    const fert = of(c, x, 'fertile');
    return (
      <div>
        <span className="cnt">
          <button className="pm" disabled={!n(c, x)} aria-label={`Retirer 1 ${c} ${sym(x)}`} onClick={() => minus(c, x)}>−</button>
          <b className={`sex-${x}`}>{n(c, x)}</b>
          <button className="pm" aria-label={`Ajouter 1 ${c} ${sym(x)}`} onClick={() => plus(c, x)}>+</button>
        </span>
        {filtre === 'toutes' && n(c, x) > 0 && (
          <div className="sub">dont {fec[key(c, x)] ?? 0} féc.</div>
        )}
        {filtre !== 'feconde' && fert.length > 0 && (
          <button className="promote" title="Ses trois jauges sont pleines : elle passe en féconde"
            onClick={() => promote([fert[0]], `1 ${c} ${sym(x)}`)}>→ féconde</button>
        )}
      </div>
    );
  };

  if (!shown.length) return (
    <div className="scroll"><p className="empty">
      {mine.length ? `Aucune ${filtre === 'feconde' ? 'féconde' : 'fertile'} pour l'instant.` : `Aucune monture de cette espèce. Ajoute-les ci-dessus, ou saisis tout ton cheptel d'un coup avec l'Inventaire.`}
    </p></div>
  );
  const TM = byGen.reduce((s, [, cols]) => s + cols.reduce((t, c) => t + n(c.name, 'M'), 0), 0);
  const TF = byGen.reduce((s, [, cols]) => s + cols.reduce((t, c) => t + n(c.name, 'F'), 0), 0);
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Couleur</th><th className="num"><SexMark x="M" /> Mâles</th><th className="num"><SexMark x="F" /> Femelles</th><th className="num">Total</th></tr></thead>
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
                {open && cols.map((c) => {
                  const fertAll = [...of(c.name, 'M', 'fertile'), ...of(c.name, 'F', 'fertile')];
                  return (
                    <tr key={c.name}>
                      <td>
                        <Swatch name={c.name} /> {c.name}
                        {filtre !== 'feconde' && fertAll.length > 1 && (
                          <div><button className="promote" onClick={() => promote(fertAll, `${fertAll.length} ${c.name}`)}>Toutes → féconde ({fertAll.length})</button></div>
                        )}
                      </td>
                      <td className="num">{cell(c.name, 'M')}</td>
                      <td className="num">{cell(c.name, 'F')}</td>
                      <td className="num">{n(c.name, 'M') + n(c.name, 'F')}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
          <tr className="total"><td>Total</td><td className="num sex-M">{TM}</td><td className="num sex-F">{TF}</td><td className="num">{TM + TF}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
