import { useMemo, useState } from 'react';
import { ExtractionPanel } from './ExtractionPanel';
import { chercherRunes, FRAGILE_BELOW, MAIN_RUNE, objectifRunes, RUNE_COLORS, runeOfficielle, runesProposees, SPECIES_LABEL, series, summarize, valeurSession } from '../domain/brisage';
import { fmtK } from './couples/format';
import type { BreakSpecies } from '../domain/types';
import { useEtable } from '../store/EtableContext';
import { queueTotal } from '../store/storage';
import { LineChart } from './LineChart';
import { ConfirmButton } from './ui';

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: number, d = 2) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const fmtDate = (d: string) => d.split('-').reverse().join('/');
const FALLBACK = ['#8E6C8A', '#4E8C8C', '#B07D3A', '#6B7FA3'];

export function BrisagePage() {
  const { breaks } = useEtable();
  const [species, setSpecies] = useState<BreakSpecies>('volkorne');
  return (
    <section>
      <ExtractionPanel />
      <div className="bar">
        <div className="seg" role="group" aria-label="Espèce">
          {(['volkorne', 'muldo'] as const).map((s) => (
            <button key={s} aria-pressed={species === s} onClick={() => setSpecies(s)}>{SPECIES_LABEL[s]}s</button>
          ))}
        </div>
      </div>
      <SessionForm species={species} key={species} />
      {breaks.some((b) => b.species === species) ? <Stats species={species} /> : (
        <p className="panel muted" style={{ marginTop: 16 }}>Aucune session de brisage de {species}s pour l'instant.</p>
      )}
    </section>
  );
}

function SessionForm({ species }: { species: BreakSpecies }) {
  const { addBreak, queue, breaks } = useEtable();
  const inQueue = queueTotal(queue, species);
  const [date, setDate] = useState(today);
  const [level, setLevel] = useState(1);
  const [mounts, setMounts] = useState(0);
  const [runes, setRunes] = useState<Record<string, number>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [newRune, setNewRune] = useState('');
  const [err, setErr] = useState('');
  const list = [...new Set([...runesProposees(breaks, species), ...extra])];
  const suggestions = chercherRunes(newRune).filter((r) => !list.includes(r));
  const ajouter = (nom: string) => {
    const r = runeOfficielle(nom);
    if (!r) { setErr(`« ${nom} » n'est pas une rune de forgemagie.`); return; }
    if (!list.includes(r)) setExtra([...extra, r]);
    setNewRune(''); setErr('');
  };

  const save = () => {
    if (!(mounts > 0)) { setErr('Indique le nombre de montures brisées.'); return; }
    const clean = Object.fromEntries(Object.entries(runes).filter(([, v]) => v > 0));
    if (!Object.keys(clean).length) { setErr('Aucune rune saisie.'); return; }
    // Les montures brisées sortent de la file « à briser » quand elle n'est pas vide
    addBreak({ date, species, level: Math.max(1, level || 1), mounts, runes: clean }, inQueue > 0);
    setMounts(0); setRunes({}); setErr('');
  };

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="bar" style={{ margin: '0 0 10px' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Nouvelle session</h2>
        {inQueue > 0 ? (
          <>
            <span className="note" style={{ margin: 0 }}>File à briser : <b>{inQueue}</b> {species}{inQueue > 1 ? 's' : ''} (saisie dans l'inventaire)</span>
            <button className="btn small" onClick={() => setMounts(inQueue)}>Tout briser ({inQueue})</button>
          </>
        ) : <span className="note" style={{ margin: 0 }}>File à briser vide : la colonne « À briser » de l'inventaire la remplit.</span>}
      </div>
      <div className="fields">
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Niveau des montures <input type="number" min={1} max={200} value={level} onChange={(e) => setLevel(+e.target.value)} /></label>
        <label>Montures brisées <input type="number" min={0} value={mounts || ''} onChange={(e) => setMounts(Math.max(0, +e.target.value || 0))} /></label>
        {inQueue > 0 && mounts > 0 && <p className="note" style={{ margin: 0, alignSelf: 'end' }}>À l'enregistrement, {Math.min(mounts, inQueue)} sortiront de la file.</p>}
      </div>
      <fieldset style={{ marginTop: 12 }}>
        <legend>Runes obtenues</legend>
        <div className="runegrid">
          {list.map((r) => (
            <label key={r}>{r}{r === MAIN_RUNE[species] && ' ★'}
              <input type="number" min={0} value={runes[r] || ''} onChange={(e) => setRunes({ ...runes, [r]: Math.max(0, +e.target.value || 0) })} />
            </label>
          ))}
        </div>
        <div className="runesearch">
          <input placeholder="Chercher une rune (ex. Vi, Ré Per Air)" value={newRune} aria-label="Chercher une rune"
            onChange={(e) => setNewRune(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) ajouter(suggestions[0]); }} />
          {newRune.trim() !== '' && (
            <div className="suggest" role="listbox" aria-label="Runes trouvées">
              {suggestions.length ? suggestions.map((r) => (
                <button key={r} role="option" aria-selected="false" className="btn ghost small" onClick={() => ajouter(r)}>{r}</button>
              )) : <span className="muted">{runeOfficielle(newRune) ? 'déjà dans la liste' : 'aucune rune de ce nom'}</span>}
            </div>
          )}
        </div>
      </fieldset>
      <div className="actions" style={{ marginTop: 12, alignItems: 'center' }}>
        {err && <span className="ko">{err}</span>}
        <button className="btn" onClick={save}>Enregistrer la session</button>
      </div>
    </div>
  );
}

function Stats({ species }: { species: BreakSpecies }) {
  const { breaks, removeBreak, settings } = useEtable();
  const prix = settings.prix.runes;
  const sum = useMemo(() => summarize(breaks, species), [breaks, species]);
  const ser = useMemo(() => series(breaks, species), [breaks, species]);
  const main = MAIN_RUNE[species];
  const others = sum.runes.filter((r) => r !== main && ser.perSession.some((p) => p.values[r] !== undefined));
  const color = (r: string, i: number) => RUNE_COLORS[r] ?? FALLBACK[i % FALLBACK.length];
  const sessions = breaks.filter((b) => b.species === species).sort((a, b) => b.date.localeCompare(a.date) || b.created - a.created);

  return (
    <>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="kpis">
          <div><b>{sum.mountsPerMain ? `1 / ${num(sum.mountsPerMain, 1)}` : '—'}</b>
            <span>{sum.mountsPerMain ? `1 ${main} toutes les ${num(sum.mountsPerMain, 1)} montures` : `aucune ${main} pour l'instant`}
              {sum.fragile && <span className="fragile" title={`Moins de ${FRAGILE_BELOW} ${main} obtenues : le taux réel peut être très différent.`}>estimation fragile</span>}</span></div>
          <div><b>{num(sum.main, 0)}</b><span>{main} obtenues</span></div>
          <div><b>{num(sum.mounts, 0)}</b><span>montures brisées</span></div>
          <div><b>{sum.sessions}</b><span>sessions</span></div>
        </div>
        <h3 style={{ fontSize: '1rem', margin: '8px 0 4px' }}>Montures nécessaires pour 1 {main}, en cumulé</h3>
        <LineChart labels={ser.cumulative.map((p) => p.label)} lines={[{ name: `Montures par ${main}`, color: RUNE_COLORS[main], values: ser.cumulative.map((p) => p.value) }]} unit="montures" />
        <p className="note">La courbe se stabilise à mesure que les montures s'accumulent : c'est la valeur où elle se pose qui donne ton vrai rendement.</p>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Rendement par rune (runes par monture)</h2>
        <div className="scroll">
          <table>
            <thead><tr><th>Niveau</th><th className="num">Montures</th>{sum.runes.map((r) => <th key={r} className="num">{r}</th>)}</tr></thead>
            <tbody>
              {sum.byLevel.map((l) => (
                <tr key={l.level}>
                  <td>{l.level}</td><td className="num">{num(l.mounts, 0)}</td>
                  {sum.runes.map((r) => <td key={r} className="num">{l.yield[r] ? num(l.yield[r], 3) : '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {others.length > 0 && (
          <>
            <h3 style={{ fontSize: '1rem', margin: '14px 0 4px' }}>Runes par monture, session par session</h3>
            <LineChart labels={ser.perSession.map((p) => p.label)}
              lines={others.map((r, i) => ({ name: r, color: color(r, i), values: ser.perSession.map((p) => p.values[r] ?? null) }))} unit="par monture" />
            <p className="note" style={{ marginBottom: 0 }}>Les quantités de runes élémentaires dépendent du niveau des montures : compare des sessions de même niveau.</p>
          </>
        )}
      </div>

      <ObjectifPanel species={species} runes={sum.runes} levels={sum.byLevel.map((l) => l.level)} />
      <PrixRunes runes={sum.runes} />

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Sessions</h2>
        {sessions.map((b) => {
          const v = valeurSession(b, prix);
          return (
            <div className="hrow" key={b.id}>
              <span className="when">{fmtDate(b.date)}</span>
              <span className="tag">niv. {b.level}</span>
              <span className="lbl">
                {num(b.mounts, 0)} montures → {Object.entries(b.runes).map(([r, q]) => `${num(q, 0)} ${r}`).join(', ') || 'aucune rune'}
                {v.kamas > 0 && <span className="valeur"> · ≈ {fmtK(v.kamas)} ({fmtK(v.parMonture)} par monture){v.manquants.length ? `, sans ${v.manquants.join(', ')}` : ''}</span>}
              </span>
              <ConfirmButton onConfirm={() => removeBreak(b.id)}>Supprimer</ConfirmButton>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Objectif « N runes » : combien de montures briser, au rendement mesuré (section 6.6 du cahier). */
function ObjectifPanel({ species, runes, levels }: { species: BreakSpecies; runes: string[]; levels: number[] }) {
  const { breaks, settings } = useEtable();
  const [rune, setRune] = useState(MAIN_RUNE[species]);
  const [n, setN] = useState(100);
  const [niveau, setNiveau] = useState<number | null>(null);
  const o = objectifRunes(breaks, species, rune, n, niveau);
  const p = settings.prix.runes[rune];
  return (
    <div className="panel" style={{ marginTop: 16 }} role="region" aria-label="Objectif de runes">
      <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Objectif</h2>
      <div className="bar" style={{ margin: '0 0 8px', alignItems: 'center' }}>
        <label className="inline">Obtenir <input type="number" min={1} style={{ width: '6em' }} aria-label="Nombre de runes visé" value={n} onChange={(e) => setN(Math.max(1, Math.floor(+e.target.value || 1)))} /></label>
        <select aria-label="Rune visée" value={rune} onChange={(e) => setRune(e.target.value)}>
          {runes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select aria-label="Niveau des montures" value={niveau ?? ''} onChange={(e) => setNiveau(e.target.value ? Number(e.target.value) : null)}>
          <option value="">tous niveaux</option>
          {levels.map((l) => <option key={l} value={l}>niveau {l}</option>)}
        </select>
      </div>
      {o ? (
        <p style={{ margin: 0 }}>
          <b>≈ {num(o.montures, 0)} {SPECIES_LABEL[species].toLowerCase()}s</b> à briser, entre {num(o.min, 0)} et {num(o.max, 0)} dans 95 % des cas
          <span className="muted"> (rendement {num(o.rendement, 3)} {rune} par monture, sur {num(o.obtenues, 0)} obtenues)</span>
          {o.fragile && <span className="fragile" title={`Moins de ${FRAGILE_BELOW} ${rune} obtenues : le rendement réel peut être très différent.`}>estimation fragile</span>}
          {p ? <span className="muted"> · valeur visée ≈ {fmtK(n * p)}</span> : null}
        </p>
      ) : <p className="muted" style={{ margin: 0 }}>Aucune {rune} obtenue {niveau ? `au niveau ${niveau}` : 'pour l\'instant'} : pas de rendement mesuré.</p>}
    </div>
  );
}

/** Prix des runes, en kamas : ils donnent la valeur de chaque session. */
function PrixRunes({ runes }: { runes: string[] }) {
  const { settings, updateSettings } = useEtable();
  const prix = settings.prix.runes;
  const set = (r: string, v: string) => {
    const next = { ...prix };
    const n = Math.round(Number(v));
    if (n > 0) next[r] = n; else delete next[r];
    updateSettings({ prix: { ...settings.prix, runes: next } });
  };
  const connus = runes.filter((r) => prix[r] > 0).length;
  return (
    <details className="panel outil" style={{ marginTop: 16 }}>
      <summary>Prix des runes <span className="muted" style={{ fontWeight: 400 }}>({connus}/{runes.length} renseignés)</span></summary>
      <div className="runegrid" style={{ marginTop: 8 }}>
        {runes.map((r) => (
          <div key={r} className="prixrune">
            <span>{r}</span>
            <input inputMode="numeric" aria-label={`Prix ${r}`} placeholder="kamas" value={prix[r] ?? ''} onChange={(e) => set(r, e.target.value)} />
          </div>
        ))}
      </div>
      <p className="note" style={{ marginBottom: 0 }}>En kamas, prix unitaire. La valeur d'une session additionne ses runes au prix connu.</p>
    </details>
  );
}
