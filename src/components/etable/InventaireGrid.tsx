import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { colorsOf, findColorIn, SPECIES_LABEL, type Color, type Espece, type Sex } from '../../domain/colors';
import { newMonture } from '../../domain/stock';
import type { BreakSpecies, Etat, Monture, QueueDelta } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { lireInventaire, plat as aplatir } from '../../domain/voix';
import { ConfirmButton, SexMark, Swatch } from '../ui';
import { BarreVoix, type Retour } from '../Voix';

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

  // « Les miennes » : seulement les couleurs connues dans l'état compté (ou déjà saisies) ; une recherche montre tout ce qui correspond
  const aDuStock = colors.some((c) => current[c.name] || curQueue(c.name));
  const [miennes, setMiennes] = useState(aDuStock);
  const plat = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const byGen = useMemo(() => {
    const q = plat(search.trim());
    const g = new Map<number, Color[]>();
    for (const c of colors) {
      const visible = q ? plat(c.name).includes(q) : !miennes || current[c.name] || curQueue(c.name) || rows[c.name];
      if (visible) g.set(c.gen, [...(g.get(c.gen) ?? []), c]);
    }
    return [...g].sort((a, b) => a[0] - b[0]);
  }, [colors, search, miennes, current, queue, rows]);
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

  // Commande vocale (ou phrase tapée) : « Doré, douze mâles, cinq femelles » ; « annuler » défait la dernière
  const historique = useRef<Record<string, Row>[]>([]);
  const dicter = (phrase: string): Retour => {
    const r = lireInventaire(espece, phrase);
    if (!r) return { ok: false, texte: 'pas compris : dis la couleur, puis « total », « mâles » ou « femelles » avec un nombre' };
    if ('commande' in r) {
      if (r.commande === 'annuler') {
        const avant = historique.current.pop();
        if (!avant) return { ok: false, texte: 'rien à annuler' };
        setRows(avant);
        return { ok: true, texte: 'dernière saisie annulée' };
      }
      if (r.commande === 'valider') { apply(); return { ok: true, texte: 'inventaire validé' }; }
      onDone();
      return { ok: true, texte: 'inventaire fermé' };
    }
    historique.current.push(rows);
    const { t, m: mm, f: ff, b: bb } = r.champs;
    if (t !== undefined) edit(r.couleur, 't', String(t));
    if (mm !== undefined) edit(r.couleur, 'm', String(mm));
    if (ff !== undefined) edit(r.couleur, 'f', String(ff));
    if (bb !== undefined && breakable) edit(r.couleur, 'b', String(bb));
    const morceaux = [t !== undefined && `total ${t}`, mm !== undefined && `${mm} ♂`, ff !== undefined && `${ff} ♀`, bb !== undefined && breakable && `${bb} à briser`].filter(Boolean);
    return { ok: true, texte: `${r.couleur} : ${morceaux.join(', ')}` };
  };

  // Clavier : lettres = aller à une couleur ; ↑ ↓ et Entrée = même colonne ; Ctrl + Entrée = valider ; Échap = fermer
  const saisie = useRef({ texte: '', le: 0 });
  const esc = (x: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(x) : x.replace(/["\\]/g, '\\$&'));
  const allerA = (debut: string) => {
    const c = colors.find((x) => aplatir(x.name).startsWith(debut)) ?? colors.find((x) => aplatir(x.name).includes(debut));
    if (!c) return;
    if (!rows[c.name] && !document.querySelector(`input[data-couleur="${esc(c.name)}"]`)) setRows((all) => ({ ...all, [c.name]: {} }));
    setTimeout(() => document.querySelector<HTMLInputElement>(`input[data-couleur="${esc(c.name)}"][data-champ="t"]`)?.focus(), 0);
  };
  // Phrases types, avec une couleur réelle de l'espèce (la première que tu possèdes)
  const exemple = colors.find((c) => current[c.name])?.name ?? colors[0]?.name ?? 'Doré';
  const modeles = [`${exemple}, 12 mâles, 5 femelles`, `${exemple}, total 20, femelles 8`, ...(breakable ? [`${exemple}, à briser 6`] : []), 'annuler', 'valider'];
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); return; }
    if (e.key === 'Escape') { e.preventDefault(); onDone(); return; }
    if (e.key.length === 1 && /\p{L}/u.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const s = saisie.current;
      s.texte = (Date.now() - s.le < 900 ? s.texte : '') + aplatir(e.key);
      s.le = Date.now();
      allerA(s.texte);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll<HTMLInputElement>(`input[data-col="${e.currentTarget.dataset.col}"]`)];
    const i = inputs.indexOf(e.currentTarget);
    inputs[e.key === 'ArrowUp' ? i - 1 : i + 1]?.focus();
  };
  const cell = (c: string, field: 't' | 'm' | 'f' | 'b', value: string, label: string, changed: boolean, col: number) => (
    <td className="num">
      <input className={`invcell${changed ? ' changed' : ''}${field === 't' ? ' total' : ''}`} inputMode="numeric" data-col={col} data-couleur={c} data-champ={field}
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
        <span className="seg" role="group" aria-label="Couleurs affichées">
          <button aria-pressed={miennes} onClick={() => setMiennes(true)}>Les miennes</button>
          <button aria-pressed={!miennes} onClick={() => setMiennes(false)}>Toutes</button>
        </span>
        <input type="search" placeholder="Chercher une couleur (même nouvelle)" aria-label="Chercher une couleur" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span style={{ flex: 1 }} />
        <ConfirmButton confirmLabel="Tout mettre à 0 ?" onConfirm={() => setRows(Object.fromEntries(colors.map((c) => [c.name, { t: '0', m: '0', f: '0', b: '0' }])))}>
          Partir de zéro
        </ConfirmButton>
      </div>
      <BarreVoix label="Dictée de l'inventaire" onPhrase={dicter} modeles={modeles} />
      <p className="note" style={{ marginTop: 0 }}>
        Pour chaque couleur : tape le <b>total</b> affiché par le jeu, puis le nombre du <b>sexe le moins nombreux</b> ; l'autre se calcule seul.
        Tab pour avancer, ↑ ↓ ou Entrée pour changer de ligne, les premières lettres d'une couleur pour y aller, Ctrl + Entrée pour valider. La grille part des <b>{mot}</b> que l'outil connaît :
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
                        <td><Swatch espece={espece} name={c.name} /> {c.name}{bad && <span className="ko" title="Le total ne correspond pas à ♂ + ♀ : saisis un sexe"> ⚠</span>}</td>
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
