import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import { colorsOf, findColorIn, SPECIES_LABEL, type Color, type Espece, type Sex } from '../../domain/colors';
import { newMonture } from '../../domain/stock';
import type { BreakSpecies, Etat, Monture, QueueDelta } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { ConfirmButton, SexMark, Swatch } from '../ui';

/** Saisie d'une ligne : ce que l'utilisateur a tapé, et le dernier sexe saisi (celui qu'on garde quand le total change). */
interface Row { t?: string; m?: string; f?: string; b?: string; fixed?: Sex; totalTyped?: boolean }

const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');
const num = (v: string | undefined) => Math.max(0, Math.floor(Number(v) || 0));
const clean = (v: string) => v.replace(/[^0-9]/g, '');
const isBreakSpecies = (e: Espece): e is BreakSpecies => e === 'volkorne' || e === 'muldo';

/** Ordre de retrait quand on recompte à la baisse : sans lignée d'abord, puis les plus anciennes. */
const removalOrder = (a: Monture, b: Monture) =>
  Number(!!(a.pere || a.mere)) - Number(!!(b.pere || b.mere)) || a.created - b.created;

/**
 * Inventaire d'une espèce. Méthode de comptage en jeu : filtrer une couleur (le jeu donne le total),
 * compter le sexe le moins nombreux, l'autre s'en déduit. On saisit donc le total et un sexe, l'outil calcule l'autre.
 * On compte un état à la fois, féconde par défaut : la grille part de ce que l'outil connaît dans cet état,
 * et l'écart avec les totaux saisis s'applique dans les deux sens. Volkornes et muldos ont en plus une colonne
 * « À briser », sans sexe.
 */
export function InventaireGrid({ espece, onDone }: { espece: Espece; onDone: () => void }) {
  const { dd, queue, act } = useEtable();
  const [etat, setEtatState] = useState<Etat>('feconde');
  const mine = useMemo(() => dd.filter((d) => d.espece === espece && d.etat === etat), [dd, espece, etat]);
  const breakable = isBreakSpecies(espece);

  // Ce que l'outil connaît dans l'état compté, par couleur et par sexe
  const current = useMemo(() => {
    const m: Record<string, { M: number; F: number }> = {};
    for (const d of mine) {
      const c = findColorIn(espece, d.couleur);
      if (c) (m[c.name] ??= { M: 0, F: 0 })[d.sexe]++;
    }
    return m;
  }, [mine, espece]);
  const curQueue = (c: string) => (breakable ? queue[espece][c] ?? 0 : 0);

  const [rows, setRows] = useState<Record<string, Row>>({});
  // Changer d'état change le point de départ de la grille : la saisie en cours repart de zéro
  const setEtat = (e: Etat) => { setEtatState(e); setRows({}); };
  const mot = etat === 'feconde' ? 'fécondes' : 'fertiles';
  const [search, setSearch] = useState('');
  const colors = colorsOf(espece);

  const cur = (c: string, x: Sex) => current[c]?.[x] ?? 0;
  const m = (c: string) => (rows[c]?.m !== undefined ? num(rows[c].m) : cur(c, 'M'));
  const f = (c: string) => (rows[c]?.f !== undefined ? num(rows[c].f) : cur(c, 'F'));
  const b = (c: string) => (rows[c]?.b !== undefined ? num(rows[c].b) : curQueue(c));
  const shownTotal = (c: string) => rows[c]?.t ?? String(m(c) + f(c));

  const edit = (c: string, field: 'm' | 'f' | 't' | 'b', raw: string) => setRows((all) => {
    const r: Row = { ...all[c] };
    const v = clean(raw);
    const val = (x: Sex) => (x === 'M' ? (r.m !== undefined ? num(r.m) : cur(c, 'M')) : (r.f !== undefined ? num(r.f) : cur(c, 'F')));
    if (field === 'b') r.b = v;
    if (field === 'm' || field === 'f') {
      const x: Sex = field === 'm' ? 'M' : 'F';
      const other: 'm' | 'f' = field === 'm' ? 'f' : 'm';
      r[field] = v;
      r.fixed = x;
      // Total déjà saisi : l'autre sexe s'en déduit. Sinon, le total suit les deux sexes.
      if (r.totalTyped) r[other] = String(Math.max(0, num(r.t) - num(v)));
      else r.t = String(num(v) + val(x === 'M' ? 'F' : 'M'));
    }
    if (field === 't') {
      r.t = v;
      r.totalTyped = true;
      if (r.fixed) {
        const other: 'm' | 'f' = r.fixed === 'M' ? 'f' : 'm';
        r[other] = String(Math.max(0, num(v) - val(r.fixed)));
      }
    }
    return { ...all, [c]: r };
  });

  const byGen = useMemo(() => {
    const q = search.trim().toLowerCase();
    const g = new Map<number, Color[]>();
    for (const c of colors) if (!q || c.name.toLowerCase().includes(q)) g.set(c.gen, [...(g.get(c.gen) ?? []), c]);
    return [...g].sort((a, b) => a[0] - b[0]);
  }, [colors, search]);
  const gensWithStock = useMemo(() => new Set(colors.filter((c) => current[c.name] || curQueue(c.name)).map((c) => c.gen)),
    [colors, current, queue]);
  const [open, setOpen] = useState<Set<number>>(() => new Set([1, 2, ...gensWithStock]));
  const toggle = (g: number) => setOpen((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });

  // Écarts entre la grille et l'outil
  const diffs = colors.flatMap((c) => [
    { c: c.name, x: 'M' as Sex | null, delta: m(c.name) - cur(c.name, 'M') },
    { c: c.name, x: 'F' as Sex | null, delta: f(c.name) - cur(c.name, 'F') },
    ...(breakable ? [{ c: c.name, x: null, delta: b(c.name) - curQueue(c.name) }] : []),
  ]).filter((d) => d.delta);
  const plus = diffs.filter((d) => d.x && d.delta > 0).reduce((s, d) => s + d.delta, 0);
  const minus = diffs.filter((d) => d.x && d.delta < 0).reduce((s, d) => s - d.delta, 0);
  const queueDelta = diffs.filter((d) => !d.x).reduce((s, d) => s + d.delta, 0);
  const mismatch = colors.filter((c) => rows[c.name]?.t !== undefined && num(rows[c.name].t) !== m(c.name) + f(c.name));

  const sum = (fn: (c: string) => number) => colors.reduce((s, c) => s + fn(c.name), 0);

  const apply = () => {
    const add: Monture[] = [];
    const del: Monture[] = [];
    const q: QueueDelta[] = [];
    for (const d of diffs) {
      if (!d.x) { if (breakable) q.push({ espece, couleur: d.c, delta: d.delta }); continue; }
      if (d.delta > 0) {
        for (let i = 0; i < d.delta; i++) add.push(newMonture(d.c, d.x, undefined, undefined, { etat, espece }));
      } else {
        const pool = mine.filter((x) => findColorIn(espece, x.couleur)?.name === d.c && x.sexe === d.x).sort(removalOrder);
        del.push(...pool.slice(0, -d.delta));
      }
    }
    const parts = [`+${plus} / −${minus}`, ...(queueDelta ? [`à briser ${queueDelta > 0 ? '+' : '−'}${Math.abs(queueDelta)}`] : [])];
    act('inventaire', `Inventaire ${SPECIES_LABEL[espece]} (${mot}) : ${parts.join(', ')}`, { add, del, queue: q });
    setRows({});
    onDone();
  };

  // ↑ ↓ et Entrée : même colonne, ligne précédente ou suivante
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>(`input[data-col="${e.currentTarget.dataset.col}"]`)];
    const i = inputs.indexOf(e.currentTarget);
    inputs[e.key === 'ArrowUp' ? i - 1 : i + 1]?.focus();
  };
  const cell = (c: string, field: 't' | 'm' | 'f' | 'b', value: string, label: string, changed: boolean, col: number) => (
    <td className="num">
      <input className={`invcell${changed ? ' changed' : ''}${field === 't' ? ' total' : ''}`} inputMode="numeric" data-col={col}
        aria-label={label} value={value} onFocus={(e) => e.target.select()} onChange={(e) => edit(c, field, e.target.value)} onKeyDown={onKey} />
    </td>
  );

  return (
    <div className="panel inventaire">
      <div className="bar" style={{ margin: '0 0 8px' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Inventaire · {SPECIES_LABEL[espece]}</h2>
        <span className="seg" role="group" aria-label="Je compte">
          <button aria-pressed={etat === 'feconde'} onClick={() => setEtat('feconde')}>Fécondes</button>
          <button aria-pressed={etat === 'fertile'} onClick={() => setEtat('fertile')}>Fertiles</button>
        </span>
        <input type="search" placeholder="Chercher une couleur" aria-label="Chercher une couleur" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span style={{ flex: 1 }} />
        <ConfirmButton confirmLabel="Tout mettre à 0 ?" onConfirm={() => setRows(Object.fromEntries(colors.map((c) => [c.name, { t: '0', m: '0', f: '0', b: '0' }])))}>
          Partir de zéro
        </ConfirmButton>
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        Pour chaque couleur : tape le <b>total</b> affiché par le jeu, puis le nombre du <b>sexe le moins nombreux</b> ; l'autre se calcule seul.
        Tab pour avancer, ↑ ↓ ou Entrée pour changer de ligne. La grille part des <b>{mot}</b> que l'outil connaît :
        saisis les nouveaux totaux du jeu, l'outil ajoute ou retire la différence.
        {breakable && ' La colonne « À briser » n’a pas de sexe : elle alimente la file de la page Brisage.'}
      </p>
      <div className="scroll">
        <table className="inv">
          <thead>
            <tr>
              <th>Couleur</th><th className="num">Total</th><th className="num"><SexMark x="M" /></th><th className="num"><SexMark x="F" /></th>
              {breakable && <th className="num">À briser</th>}
            </tr>
          </thead>
          <tbody>
            {byGen.map(([g, cols]) => {
              const isOpen = open.has(g) || !!search;
              const subM = cols.reduce((s, c) => s + m(c.name), 0);
              const subF = cols.reduce((s, c) => s + f(c.name), 0);
              const subB = cols.reduce((s, c) => s + b(c.name), 0);
              return (
                <Fragment key={g}>
                  <tr className="genrow" aria-expanded={isOpen} tabIndex={0} onClick={() => toggle(g)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(g); } }}>
                    <td><span className="caret">▾</span> Génération {g} <span className="muted" style={{ fontWeight: 400 }}>· {cols.length} couleurs</span></td>
                    <td className="num">{subM + subF}</td><td className="num sex-M">{subM}</td><td className="num sex-F">{subF}</td>
                    {breakable && <td className="num">{subB}</td>}
                  </tr>
                  {isOpen && cols.map((c) => {
                    const r = rows[c.name];
                    const bad = r?.t !== undefined && num(r.t) !== m(c.name) + f(c.name);
                    return (
                      <tr key={c.name} className={bad ? 'mismatch' : ''}>
                        <td><Swatch name={c.name} /> {c.name}{bad && <span className="ko" title="Le total ne correspond pas à ♂ + ♀ : saisis un sexe"> ⚠</span>}</td>
                        {cell(c.name, 't', shownTotal(c.name), `${c.name} total`, m(c.name) + f(c.name) !== cur(c.name, 'M') + cur(c.name, 'F') || bad, 0)}
                        {cell(c.name, 'm', String(m(c.name)), `${c.name} ${sym('M')}`, m(c.name) !== cur(c.name, 'M'), 1)}
                        {cell(c.name, 'f', String(f(c.name)), `${c.name} ${sym('F')}`, f(c.name) !== cur(c.name, 'F'), 2)}
                        {breakable && cell(c.name, 'b', String(b(c.name)), `${c.name} à briser`, b(c.name) !== curQueue(c.name), 3)}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="total">
              <td>Total</td><td className="num">{sum(m) + sum(f)}</td><td className="num sex-M">{sum(m)}</td><td className="num sex-F">{sum(f)}</td>
              {breakable && <td className="num">{sum(b)}</td>}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="actions" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="note" style={{ margin: 0 }}>
          {mismatch.length > 0 && <div className="ko">⚠ {mismatch.length} ligne{mismatch.length > 1 ? 's' : ''} où le total ne correspond pas à <SexMark x="M" /> + <SexMark x="F" /> : saisis le sexe manquant.</div>}
          {diffs.length === 0 ? 'Aucun écart avec l’outil.' : (
            <>
              <b>Écarts à appliquer : +{plus} / −{minus}{queueDelta ? ` · à briser ${queueDelta > 0 ? '+' : '−'}${Math.abs(queueDelta)}` : ''}</b>
              <div className="diffs">
                {diffs.slice(0, 12).map((d) => (
                  <span key={`${d.c}|${d.x ?? 'b'}`} className={d.delta > 0 ? 'ok' : 'ko'}>
                    {d.delta > 0 ? '+' : '−'}{Math.abs(d.delta)} {d.c} {d.x ? <SexMark x={d.x} /> : 'à briser'}
                  </span>
                ))}
                {diffs.length > 12 && <span className="muted">… et {diffs.length - 12} autres</span>}
              </div>
              {minus > 0 && <div>Les retraits prennent d'abord des {mot} sans lignée, puis les plus anciennes.</div>}
            </>
          )}
        </div>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => { setRows({}); onDone(); }}>Annuler</button>
          <button className="btn" disabled={!diffs.length || mismatch.length > 0} onClick={apply}>Valider l'inventaire</button>
        </span>
      </div>
    </div>
  );
}
