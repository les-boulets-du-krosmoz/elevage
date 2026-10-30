import { useState } from 'react';
import { colorsOf, findColorIn, SPECIES_LABEL, type Espece } from '../domain/colors';
import { DESTINATIONS, limiteRegle, REGLES_DEFAUT, type Destination, type RegleParent, type TypeCouleur } from '../domain/destinations';
import { A_VERIFIER, estPerso, lirePaire, memePaire, recettes, type Paire } from '../domain/recettes';
import { uid } from '../domain/stock';
import { useEtable } from '../store/EtableContext';
import { colorListId, ConfirmButton, Swatch } from './ui';

const ESPECES: (Espece | '*')[] = ['*', 'dragodinde', 'volkorne', 'muldo'];
const TYPES: { id: TypeCouleur; label: string }[] = [{ id: '*', label: 'Tous types' }, { id: 'mono', label: 'Monocolores' }, { id: 'bi', label: 'Bicolores' }];
const GENS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Page Réglages : ce que deviennent les parents après un accouplement, et les recettes des muldos et volkornes. */
export function ReglagesPage() {
  return (
    <section>
      <Regles />
      <Prix />
      <Recettes />
    </section>
  );
}

function Regles() {
  const { settings, updateSettings } = useEtable();
  const regles = settings.regles;
  const save = (list: RegleParent[]) => updateSettings({ regles: list });
  const set = (id: string, patch: Partial<RegleParent>) => save(regles.map((r) => {
    if (r.id !== id) return r;
    const n = { ...r, ...patch };
    if (n.a < n.de) n.a = n.de;
    return n;
  }));
  const monter = (i: number) => { if (i > 0) { const l = [...regles]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; save(l); } };

  return (
    <div className="panel" style={{ marginBottom: 16 }} role="region" aria-label="Règles de destination">
      <div className="bar" style={{ margin: '0 0 6px' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Après l'accouplement</h2>
        <span style={{ flex: 1 }} />
        <button className="btn small ghost" onClick={() => save([{ id: uid(), espece: '*', type: '*', de: 1, a: 10, destination: 'garder' }, ...regles])}>+ Règle</button>
        <ConfirmButton confirmLabel="Remettre les règles par défaut ?" onConfirm={() => save(REGLES_DEFAUT.map((r) => ({ ...r })))}>Par défaut</ConfirmButton>
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        Les deux parents deviennent stériles. Chacun suit la <b>première</b> règle qui lui correspond ; sans règle, il sort de l'outil (à vendre).
        « À briser » et « À extraire » remplissent les files de la page Brisage.
      </p>
      {!regles.length && <p className="muted">Aucune règle : tous les parents sortent de l'outil.</p>}
      <ol className="regles">
        {regles.map((r, i) => {
          const limite = limiteRegle(r);
          return (
            <li key={r.id} className="regle" aria-label={`Règle ${i + 1}`}>
              <select aria-label="Espèce" value={r.espece} onChange={(e) => set(r.id, { espece: e.target.value as Espece | '*' })}>
                {ESPECES.map((e) => <option key={e} value={e}>{e === '*' ? 'Toutes espèces' : SPECIES_LABEL[e]}</option>)}
              </select>
              <select aria-label="Type" value={r.type} onChange={(e) => set(r.id, { type: e.target.value as TypeCouleur })}>
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <span className="gens">G
                <select aria-label="De la génération" value={r.de} onChange={(e) => set(r.id, { de: Number(e.target.value) })}>
                  {GENS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                à
                <select aria-label="À la génération" value={r.a} onChange={(e) => set(r.id, { a: Number(e.target.value) })}>
                  {GENS.filter((g) => g >= r.de).map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </span>
              <span aria-hidden="true">→</span>
              <select aria-label="Destination" value={r.destination} onChange={(e) => set(r.id, { destination: e.target.value as Destination })}>
                {DESTINATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <span className="regle-btns">
                <button className="x" aria-label={`Monter la règle ${i + 1}`} disabled={i === 0} onClick={() => monter(i)}>↑</button>
                <button className="x" aria-label={`Supprimer la règle ${i + 1}`} onClick={() => save(regles.filter((x) => x.id !== r.id))}>×</button>
              </span>
              {limite && <span className="note warn-txt" style={{ flexBasis: '100%', margin: 0 }}>{limite}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const ESP3: Espece[] = ['muldo', 'volkorne', 'dragodinde'];
const RESSOURCE: Record<Espece, string> = { muldo: 'Ambre', volkorne: 'Corne', dragodinde: 'Ressource des dragodindes' };
const nombre = (v: string) => (Number(v) > 0 ? Math.round(Number(v)) : null);

/** Prix en kamas et chance de base : ils servent au verdict de l'Optimakina et aux conseils d'Animakina. */
function Prix() {
  const { settings, updateSettings } = useEtable();
  const prix = settings.prix;
  const setRessource = (e: Espece, v: string) => {
    const r = { ...prix.ressource };
    const n = nombre(v);
    if (n) r[e] = n; else delete r[e];
    updateSettings({ prix: { ...prix, ressource: r } });
  };
  const setOpti = (e: Espece, g: number, v: string) => {
    const grid = { ...(prix.optimakina[e] ?? {}) };
    const n = nombre(v);
    if (n) grid[g] = n; else delete grid[g];
    updateSettings({ prix: { ...prix, optimakina: { ...prix.optimakina, [e]: grid } } });
  };
  return (
    <div className="panel" style={{ marginBottom: 16 }} role="region" aria-label="Prix et chances">
      <h2 style={{ fontSize: '1.3rem', marginBottom: 6 }}>Prix et chances</h2>
      <p className="note" style={{ marginTop: 0 }}>En kamas. Laisse vide ce que tu ne connais pas : l'outil affiche alors seulement le seuil de rentabilité.</p>
      <div className="bar" style={{ margin: '0 0 8px' }}>
        {ESP3.map((e) => (
          <label key={e} className="inline">{RESSOURCE[e]}
            <input inputMode="numeric" style={{ width: '7em' }} aria-label={`Prix ${RESSOURCE[e]}`} value={prix.ressource[e] ?? ''} onChange={(ev) => setRessource(e, ev.target.value)} />
          </label>
        ))}
        <label className="inline">Généton
          <input inputMode="numeric" style={{ width: '6em' }} aria-label="Prix du généton" value={prix.geneton ?? ''} onChange={(ev) => updateSettings({ prix: { ...prix, geneton: nombre(ev.target.value) } })} />
        </label>
        <label className="inline">Animakina
          <input inputMode="numeric" style={{ width: '7em' }} aria-label="Prix de l'Animakina" value={settings.sexItemPriceK || ''} onChange={(ev) => updateSettings({ sexItemPriceK: nombre(ev.target.value) ?? 0 })} />
        </label>
        <label className="inline">Chance de base
          <input type="number" min={1} max={100} style={{ width: '5em' }} aria-label="Chance de base" value={settings.chanceBase} onChange={(ev) => updateSettings({ chanceBase: Math.max(1, Math.min(100, Number(ev.target.value) || 40)) })} /> %
        </label>
      </div>
      <div className="scroll">
        <table className="inv" aria-label="Prix de l'Optimakina">
          <thead><tr><th>Optimakina</th>{GENS.map((g) => <th key={g} className="num">G{g}</th>)}</tr></thead>
          <tbody>
            {ESP3.map((e) => (
              <tr key={e}>
                <td>{SPECIES_LABEL[e]}</td>
                {GENS.map((g) => (
                  <td key={g} className="num">
                    <input className="invcell" inputMode="numeric" aria-label={`Optimakina ${SPECIES_LABEL[e]} G${g}`} value={prix.optimakina[e]?.[g] ?? ''}
                      onChange={(ev) => setOpti(e, g, ev.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginBottom: 0 }}>
        Chance de base observée : 30 % plus 0,15 % par niveau de chaque parent. Une Optimakina sert pour toute génération cible inférieure ou égale à la sienne : l'outil prend la moins chère qui convient.
      </p>
    </div>
  );
}

function Recettes() {
  const { settings, updateSettings } = useEtable();
  const [espece, setEspece] = useState<'muldo' | 'volkorne'>('muldo');
  const toutes = recettes(espece, settings.recettes);
  const monos = colorsOf(espece).filter((c) => c.parts.length === 1 && c.gen >= 3);
  const save = (couleur: string, list: Paire[] | null) => {
    const sp = { ...(settings.recettes[espece] ?? {}) };
    if (list) sp[couleur] = list; else delete sp[couleur];
    updateSettings({ recettes: { ...settings.recettes, [espece]: sp } });
  };
  return (
    <div className="panel" role="region" aria-label="Recettes">
      <div className="bar" style={{ margin: '0 0 6px' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Recettes</h2>
        <div className="seg" role="group" aria-label="Espèce des recettes">
          {(['muldo', 'volkorne'] as const).map((e) => <button key={e} aria-pressed={espece === e} onClick={() => setEspece(e)}>{SPECIES_LABEL[e]}</button>)}
        </div>
      </div>
      <p className="note" style={{ marginTop: 0 }}>
        Une bicolore n'a qu'une recette, ses deux monocolores. Une monocolore à partir de la génération 3 en a plusieurs, relevées sur
        Dofus pour les Noobs ; en jeu, le bouton en forme d'arbre au-dessus de la monture les montre toutes. Une recette modifiée ici remplace celle de DPLN.
      </p>
      {monos.map((c) => (
        <RecetteCouleur key={c.name} espece={espece} couleur={c.name} gen={c.gen} list={toutes[c.name] ?? []}
          perso={estPerso(settings.recettes, espece, c.name)} onChange={(l) => save(c.name, l)} />
      ))}
    </div>
  );
}

function RecetteCouleur({ espece, couleur, gen, list, perso, onChange }:
  { espece: Espece; couleur: string; gen: number; list: Paire[]; perso: boolean; onChange: (l: Paire[] | null) => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const douteuses = (A_VERIFIER[espece]?.[couleur] ?? []).map((t) => lirePaire(espece, t)).filter((p): p is Paire => !!p);
  const ajouter = () => {
    const p = lirePaire(espece, `${a} + ${b}`);
    if (!p) { setErr('Deux couleurs différentes de la liste.'); return; }
    const cols = p.map((n) => findColorIn(espece, n)!);
    if (cols.some((x) => x.parts.length !== 2 || x.gen >= gen) || !cols.some((x) => x.gen === gen - 1)) {
      setErr(`Deux bicolores plus jeunes que G${gen}, dont au moins une de génération ${gen - 1}.`); return;
    }
    if (list.some((q) => memePaire(p, q))) { setErr('Cette recette existe déjà.'); return; }
    setErr(''); setA(''); setB('');
    onChange([...list, p]);
  };
  return (
    <details className="recette">
      <summary>
        <Swatch name={couleur} size={14} /> <b>{couleur}</b> <span className="muted">G{gen} · {list.length} recette{list.length > 1 ? 's' : ''}</span>
        {perso && <span className="badge">modifiée</span>}
      </summary>
      <ul>
        {list.map((p) => (
          <li key={p.join('|')}>
            <Swatch name={p[0]} size={12} /> {p[0]} <span className="muted">+</span> <Swatch name={p[1]} size={12} /> {p[1]}
            {douteuses.some((q) => memePaire(p, q)) && <span className="warn-txt" title="Semble erronée chez DPLN"> · à vérifier en jeu</span>}
            <button className="x" aria-label={`Retirer ${p[0]} + ${p[1]}`} onClick={() => onChange(list.filter((q) => q !== p))}>×</button>
          </li>
        ))}
      </ul>
      <div className="bar" style={{ margin: '4px 0 0' }}>
        <input list={colorListId(espece)} placeholder={`Bicolore G${gen - 1}`} aria-label={`Premier parent de ${couleur}`} value={a} onChange={(e) => setA(e.target.value)} />
        <span>+</span>
        <input list={colorListId(espece)} placeholder={`Bicolore G${gen - 1}`} aria-label={`Second parent de ${couleur}`} value={b} onChange={(e) => setB(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
        <button className="btn small ghost" onClick={ajouter}>Ajouter</button>
        {perso && <button className="btn small ghost" onClick={() => onChange(null)}>Rétablir DPLN</button>}
        {err && <span className="ko">{err}</span>}
      </div>
    </details>
  );
}
