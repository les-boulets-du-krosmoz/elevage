import { useMemo, useState } from 'react';
import {
  aVerifier, comparer, fourchette, fusionner, lireTable, NIVEAU_MAX, trierFavoris, verifier, type Favori, type TriFavoris, NIVEAU_PALIER, OBTENTION_LABEL, pasSansPerte, perteArrondi, quantitePour, quantiteSansPerte, simuler,
  texteBonus, TOUS_FAMILIERS, valeurBonus, XP_CROQUETTE, xpPour, type Familier, type Obtention, type Repas, type RessourceXp,
} from '../domain/familiers';
import { ConfirmButton } from './ui';
import { TABLE_RESSOURCES } from '../domain/ressourcesFamiliers';
import { readPref, writePref } from '../store/prefs';
import { fmtK } from './couples/format';

/**
 * Page Familiers, à part de l'élevage : obtention et bonus de chaque familier, et simulateur d'expérience.
 * Ses réglages restent dans ce navigateur (clé « familiers »), sans lien avec les montures ni la sauvegarde de l'étable.
 */
interface Etat { nom: string; niveau: number; dansNiveau: number; croquettes: number; repas: Repas[]; vise: number }
const CLE = 'familiers';
const DEFAUT: Etat = { nom: 'Bloalak', niveau: 0, dansNiveau: 0, croquettes: 0, repas: [], vise: NIVEAU_MAX };
const num = (v: number) => Math.round(v).toLocaleString('fr-FR');
const dec = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
const CLE_BIBLIO = 'familiers-ressources';
const CLE_FAVORIS = 'familiers-favoris';
const CROQUETTE = 'Croquette enrichie';
/** Favoris : nom de la ressource → valeur à l'unité et date de saisie. La croquette enrichie y est toujours. */
type Favoris = Record<string, { valeur?: number; le?: number }>;
const jour = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
/** Table intégrée (DPLN) ; les ajouts et vérifications de l'utilisateur passent par-dessus. */
const BASE: RessourceXp[] = lireTable(TABLE_RESSOURCES).ressources;
const plat = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const borne = (n: number) => Math.max(0, Math.min(NIVEAU_MAX, Math.round(n) || 0));

export function FamiliersPage() {
  const [etat, setEtatState] = useState<Etat>(() => ({ ...DEFAUT, ...readPref<Partial<Etat>>(CLE, {}) }));
  const setEtat = (patch: Partial<Etat>) => setEtatState((e) => { const n = { ...e, ...patch }; writePref(CLE, n); return n; });
  const [q, setQ] = useState('');
  const [type, setType] = useState<Obtention | ''>('');
  const familier = TOUS_FAMILIERS.find((f) => f.nom === etat.nom) ?? TOUS_FAMILIERS[0];

  const liste = useMemo(() => {
    const k = plat(q.trim());
    return TOUS_FAMILIERS.filter((f) => (!type || f.type === type)
      && (!k || plat(f.nom).includes(k) || f.bonus.some((b) => plat(b.stat).includes(k)) || plat(f.obtention).includes(k)))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [q, type]);

  return (
    <section>
      <Simulateur familier={familier} etat={etat} setEtat={setEtat} />
      <div className="panel" style={{ marginTop: 16 }} role="region" aria-label="Liste des familiers">
        <div className="bar" style={{ margin: '0 0 8px', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.3rem' }}>Familiers</h2>
          <input placeholder="Nom, bonus ou ressource (ex. Prospection)" aria-label="Chercher un familier" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
          <div className="seg" role="group" aria-label="Obtention">
            <button aria-pressed={!type} onClick={() => setType('')}>Tous</button>
            {(Object.keys(OBTENTION_LABEL) as Obtention[]).map((t) => (
              <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>{OBTENTION_LABEL[t].split(' ')[0]}</button>
            ))}
          </div>
          <span className="muted">{liste.length} familier{liste.length > 1 ? 's' : ''}</span>
        </div>
        <ul className="familiers">
          {liste.map((f) => (
            <li key={f.nom} aria-label={f.nom} className={f.nom === familier.nom ? 'choisi' : undefined}>
              <div className="fam-tete">
                <b>{f.nom}</b> <span className={`badge obt-${f.type}`}>{OBTENTION_LABEL[f.type]}</span>
                <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => { setEtat({ nom: f.nom }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Simuler</button>
              </div>
              <div className="fam-bonus">
                <span><span className="muted">Niv. 1 :</span> {f.bonus.map((b) => (b.palier ? `${b.max} ${b.stat} au niv. ${NIVEAU_PALIER}` : texteBonus(b, 1))).join(', ')}</span>
                <span><span className="muted">Niv. 100 :</span> {f.bonus.map((b) => texteBonus(b, NIVEAU_MAX)).join(', ')}</span>
              </div>
              <div className="fam-obt">
                {f.obtention}{f.prerequis && <span className="muted"> · Prérequis : {f.prerequis}</span>}
              </div>
            </li>
          ))}
        </ul>
        <p className="note" style={{ marginBottom: 0 }}>
          Source : Dofus Portals (tableau à jour avec la 3.0, quelques erreurs possibles). Le familier disparaît de la carte une fois obtenu : une seule fois par personnage.
        </p>
      </div>
    </section>
  );
}

function Simulateur({ familier, etat, setEtat }: { familier: Familier; etat: Etat; setEtat: (p: Partial<Etat>) => void }) {
  // Mes ajouts et mes vérifications, gardés dans ce navigateur ; la bibliothèque affichée y ajoute la table intégrée
  const [local, setLocalState] = useState<RessourceXp[]>(() => readPref<RessourceXp[]>(CLE_BIBLIO, []));
  const setLocal = (b: RessourceXp[]) => { setLocalState(b); writePref(CLE_BIBLIO, b); };
  const biblio = useMemo(() => fusionner(BASE, local), [local]);
  const [favoris, setFavorisState] = useState<Favoris>(() => readPref<Favoris>(CLE_FAVORIS, {}));
  const setFavoris = (f: Favoris) => { setFavorisState(f); writePref(CLE_FAVORIS, f); };
  const estFavori = (nom: string) => Object.prototype.hasOwnProperty.call(favoris, nom);
  const basculerFavori = (nom: string) => {
    const f = { ...favoris };
    if (estFavori(nom)) delete f[nom]; else f[nom] = {};
    setFavoris(f);
  };
  const trouver = (nom: string) => { const k = plat(nom.trim()); return k ? biblio.find((r) => plat(r.nom) === k) : undefined; };
  const repas: Repas[] = [{ nom: 'Croquette enrichie', xp: XP_CROQUETTE, quantite: etat.croquettes }, ...etat.repas];
  const sim = simuler(etat.niveau, repas, etat.dansNiveau);
  const setRepas = (i: number, patch: Partial<Repas>) => setEtat({ repas: etat.repas.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const vise = Math.max(etat.niveau, borne(etat.vise));
  const besoin = xpPour(vise) - xpPour(etat.niveau) - etat.dansNiveau;
  const nombre = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
  const palierEnAttente = familier.bonus.some((b) => b.palier) && sim.arrivee < NIVEAU_PALIER;

  return (
    <div className="panel" role="region" aria-label="Simulateur">
      <div className="bar" style={{ margin: '0 0 8px', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Simulateur</h2>
        <select aria-label="Familier simulé" value={familier.nom} onChange={(e) => setEtat({ nom: e.target.value })}>
          {[...TOUS_FAMILIERS].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((f) => <option key={f.nom} value={f.nom}>{f.nom}</option>)}
        </select>
        <label className="inline">Niveau actuel
          <input type="number" min={0} max={NIVEAU_MAX} style={{ width: '5em' }} aria-label="Niveau actuel" value={etat.niveau} onChange={(e) => setEtat({ niveau: borne(+e.target.value) })} />
        </label>
        <label className="inline">XP déjà dans ce niveau
          <input type="number" min={0} style={{ width: '6em' }} aria-label="XP déjà dans ce niveau" value={etat.dansNiveau || ''} onChange={(e) => setEtat({ dansNiveau: Math.max(0, Math.floor(+e.target.value || 0)) })} />
        </label>
      </div>

      <MesRessources biblio={biblio} favoris={favoris} setFavoris={setFavoris} besoin={Math.max(0, besoin)} vise={vise}
        onUtiliser={(nom, xp, quantite, valeur) => {
          if (nom === CROQUETTE) setEtat({ croquettes: quantite });
          else setEtat({ repas: [...etat.repas, { nom, xp, xpTxt: dec(xp), quantite, prix: valeur }] });
        }} />
      <div className="repas">
        <div className="repas-ligne">
          <span><b>Croquette enrichie</b> <span className="muted">500 XP</span></span>
          <label className="inline">Quantité
            <input type="number" min={0} style={{ width: '6em' }} aria-label="Croquettes enrichies" value={etat.croquettes || ''} onChange={(e) => setEtat({ croquettes: Math.max(0, Math.floor(+e.target.value || 0)) })} />
          </label>
        </div>
        {etat.repas.map((r, i) => (
          <div className="repas-ligne" key={i}>
            <input placeholder="Ressource" list="ressourcesXp" aria-label={`Ressource ${i + 1}`} value={r.nom} onChange={(e) => {
              const t = trouver(e.target.value);
              setRepas(i, t ? { nom: t.nom, xp: t.xp, xpTxt: dec(t.xp), ...(favoris[t.nom]?.valeur && !r.prix ? { prix: favoris[t.nom].valeur } : {}) } : { nom: e.target.value });
            }} />
            {trouver(r.nom) && (
              <button className="etoile" aria-pressed={estFavori(trouver(r.nom)!.nom)} aria-label={`${estFavori(trouver(r.nom)!.nom) ? 'Retirer des' : 'Ajouter aux'} favoris : ${trouver(r.nom)!.nom}`}
                title={estFavori(trouver(r.nom)!.nom) ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => basculerFavori(trouver(r.nom)!.nom)}>
                {estFavori(trouver(r.nom)!.nom) ? '★' : '☆'}
              </button>
            )}
            <label className="inline">XP par unité
              <input inputMode="decimal" style={{ width: '5em' }} aria-label={`XP par unité ${i + 1}`} value={r.xpTxt ?? (r.xp ? dec(r.xp) : '')}
                onChange={(e) => setRepas(i, { xp: nombre(e.target.value), xpTxt: e.target.value })} />
            </label>
            <label className="inline">Quantité
              <input type="number" min={0} style={{ width: '6em' }} aria-label={`Quantité ${i + 1}`} value={r.quantite || ''} onChange={(e) => setRepas(i, { quantite: Math.max(0, Math.floor(+e.target.value || 0)) })} />
            </label>
            <label className="inline">Prix
              <input inputMode="numeric" style={{ width: '6em' }} aria-label={`Prix ${i + 1}`} value={r.prix || ''} onChange={(e) => setRepas(i, { prix: nombre(e.target.value) || undefined })} />
            </label>
            <button className="x" aria-label={`Retirer la ressource ${i + 1}`} onClick={() => setEtat({ repas: etat.repas.filter((_, k) => k !== i) })}>×</button>
            <LignePerte xp={r.xp} quantite={r.quantite} onAjuster={(q) => setRepas(i, { quantite: q })} n={i + 1} />
            <AlerteFiabilite ressource={trouver(r.nom)} xp={r.xp} n={i + 1} onVerifier={() => setLocal(verifier(local, trouver(r.nom)!.nom, r.xp))} />
          </div>
        ))}
        <datalist id="ressourcesXp">{biblio.map((b) => <option key={b.nom} value={b.nom}>{`${dec(b.xp)} XP par unité${b.fiabilite === 'peu-rentable' ? ' · peu rentable' : aVerifier(b) ? ' · à vérifier' : ''}`}</option>)}</datalist>
        <button className="btn small ghost" onClick={() => setEtat({ repas: [...etat.repas, { nom: '', xp: 0, quantite: 0 }] })}>+ Ressource</button>
        <Bibliotheque biblio={biblio} local={local} setLocal={setLocal} />
      </div>
      <p className="note" style={{ margin: '4px 0 10px' }}>
        L'XP par unité se lit dans la fenêtre « Nourrir » du jeu ; elle a souvent des décimales (une Rose des sables vaut environ 1,25). Le jeu arrondit chaque lot à l'inférieur : donne une ressource en un seul lot.
      </p>

      <p style={{ margin: '0 0 6px', fontSize: '1.05rem' }} aria-label="Résultat">
        Niveau <b>{sim.depart}</b> → <b>{sim.arrivee}</b> <span className="muted">(+{num(sim.gagne)} XP{sim.arrivee < NIVEAU_MAX ? `, encore ${num(sim.manque)} XP pour le niveau ${sim.arrivee + 1}` : ''}{sim.cout ? `, coût ${fmtK(sim.cout)}` : ''}{sim.perte > 0 ? `, ${dec(sim.perte)} XP perdue à l'arrondi` : ''})</span>
      </p>
      <div className="scroll">
        <table className="inv" aria-label="Bonus du familier">
          <thead><tr><th>Bonus</th><th className="num">Niv. {sim.depart}</th><th className="num">Niv. {sim.arrivee}</th><th className="num">Niv. 100</th></tr></thead>
          <tbody>
            {familier.bonus.map((b) => (
              <tr key={b.stat}>
                <td>{b.stat}{b.palier && <span className="muted"> (au niveau {NIVEAU_PALIER})</span>}</td>
                <td className="num">{valeurBonus(b, sim.depart)}{b.pct ? ' %' : ''}</td>
                <td className="num"><b>{valeurBonus(b, sim.arrivee)}{b.pct ? ' %' : ''}</b></td>
                <td className="num">{b.max}{b.pct ? ' %' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {palierEnAttente && <p className="note" style={{ margin: '6px 0 0' }}>Le bonus en entier ({familier.bonus.filter((b) => b.palier).map((b) => `${b.max} ${b.stat}`).join(', ')}) n'arrive qu'au niveau {NIVEAU_PALIER} : il faut {num(xpPour(NIVEAU_PALIER) - sim.xpFinal)} XP de plus.</p>}

      <div className="bar" style={{ margin: '12px 0 0', alignItems: 'center' }}>
        <label className="inline">Viser le niveau
          <input type="number" min={0} max={NIVEAU_MAX} style={{ width: '5em' }} aria-label="Niveau visé" value={etat.vise} onChange={(e) => setEtat({ vise: borne(+e.target.value) })} />
        </label>
        <span aria-label="Objectif">
          {besoin <= 0 ? <span className="ok">déjà atteint</span> : (
            <>
              <b>{num(besoin)} XP</b> : {num(Math.ceil(besoin / XP_CROQUETTE))} croquettes enrichies
              {etat.repas.filter((r) => r.xp > 0 && r.nom).map((r) => {
                const k = quantitePour(besoin, r.xp);
                return k === null ? null : <span key={r.nom}>, ou {num(k)} {r.nom}{r.prix ? ` (${fmtK(k * r.prix)})` : ''}</span>;
              })}
            </>
          )}
        </span>
      </div>
      <p className="note" style={{ marginBottom: 0 }}>
        À vérifier en jeu : un familier rend 10 % de ses bonus au niveau 1, puis un pourcentage égal à son niveau ; PA, PM, Portée et Invocations n'arrivent qu'au niveau {NIVEAU_PALIER}.
        Presque la moitié de l'XP jusqu'au niveau 100 se gagne entre les niveaux 91 et 100.
      </p>
    </div>
  );
}

/** Perte d'arrondi d'un lot, et la quantité qui l'évite. */
function LignePerte({ xp, quantite, onAjuster, n }: { xp: number; quantite: number; onAjuster: (q: number) => void; n: number }) {
  if (!(xp > 0) || !(quantite > 0)) return null;
  const perte = perteArrondi(xp, quantite);
  const pas = pasSansPerte(xp);
  const ajuste = quantiteSansPerte(xp, quantite);
  return (
    <span className="perte" aria-label={`Arrondi ${n}`}>
      {perte > 0 ? <span className="ko">{dec(perte)} XP perdue à l'arrondi</span> : <span className="ok">aucune perte</span>}
      {pas > 1 && <span className="muted"> · sans perte par multiples de {pas}</span>}
      {perte > 0 && ajuste > 0 && <button className="btn small ghost" onClick={() => onAjuster(ajuste)}>Ajuster à {num(ajuste)}</button>}
    </span>
  );
}

/** Bibliothèque de ressources : une table collée (nom, XP par unité) pour remplir l'XP en tapant le nom. */
function Bibliotheque({ biblio, local, setLocal }: { biblio: RessourceXp[]; local: RessourceXp[]; setLocal: (b: RessourceXp[]) => void }) {
  const [txt, setTxt] = useState('');
  const [msg, setMsg] = useState('');
  const importer = () => {
    const { ressources, ignorees } = lireTable(txt);
    if (!ressources.length) { setMsg('Aucune ligne lisible : il faut le nom, puis l’XP par unité.'); return; }
    setLocal(fusionner(local, ressources));
    setTxt('');
    const douteuses = ressources.filter(aVerifier).length;
    const faibles = ressources.filter((r) => r.fiabilite === 'peu-rentable').length;
    setMsg(`${ressources.length} ressource${ressources.length > 1 ? 's' : ''} importée${ressources.length > 1 ? 's' : ''}${douteuses ? `, dont ${douteuses} à vérifier en jeu` : ''}${faibles ? `, ${faibles} peu rentable${faibles > 1 ? 's' : ''}` : ''}${ignorees ? `, ${ignorees} ligne${ignorees > 1 ? 's' : ''} ignorée${ignorees > 1 ? 's' : ''}` : ''}.`);
  };
  return (
    <details className="outil biblio">
      <summary>Bibliothèque de ressources <span className="muted" style={{ fontWeight: 400 }}>({biblio.length})</span></summary>
      <p className="note" style={{ marginTop: 6 }}>
        La table de Dofus pour les Noobs est intégrée ({BASE.length} ressources, relevées avant Dofus 3). Pour la compléter ou la corriger,
        colle une table : une ressource par ligne, le nom, l'XP, puis la quantité pour laquelle cette XP est obtenue (1 par défaut).
        Tes valeurs vérifiées en jeu passent toujours avant.
        Ensuite, taper le nom d'une ressource dans le simulateur remplit son XP.
      </p>
      <textarea aria-label="Table de ressources" rows={4} style={{ width: '100%' }} placeholder={'Rose des sables\t1,25\nPeau de Maho Firefoux\t1,59'} value={txt} onChange={(e) => setTxt(e.target.value)} />
      <ListeAVerifier biblio={biblio} />
      <div className="bar" style={{ margin: '6px 0 0' }}>
        <button className="btn small" disabled={!txt.trim()} onClick={importer}>Importer</button>
        {local.some((r) => r.fiabilite !== 'verifiee') && (
          <ConfirmButton confirmLabel="Retirer mes tables importées ? (les valeurs vérifiées restent)"
            onConfirm={() => { setLocal(local.filter((r) => r.fiabilite === 'verifiee')); setMsg(''); }}>Revenir à la table intégrée</ConfirmButton>
        )}
        {msg && <span className="muted">{msg}</span>}
      </div>
    </details>
  );
}

/** Valeur brute de la table : « 1 XP pour 3 ». */
const brut = (r: RessourceXp) => `${dec(r.xpTable ?? r.xp)} XP${r.quantite && r.quantite !== 1 ? ` pour ${num(r.quantite)}` : ''}`;

/** Alerte sur une ressource dont la table ne garantit pas l'XP, et bouton pour noter la valeur relevée en jeu. */
function AlerteFiabilite({ ressource, xp, n, onVerifier }: { ressource?: RessourceXp; xp: number; n: number; onVerifier: () => void }) {
  if (!ressource) return null;
  const label = `Fiabilité ${n}`;
  if (ressource.fiabilite === 'verifiee') {
    return ressource.xp === xp ? <span className="fiab ok" aria-label={label}>✓ XP vérifiée en jeu</span> : (
      <span className="fiab" aria-label={label}>
        <span className="muted">Vérifiée en jeu à {dec(ressource.xp)} XP</span>
        {xp > 0 && <button className="btn small ghost" onClick={onVerifier}>Remplacer par {dec(xp)}</button>}
      </span>
    );
  }
  if (ressource.fiabilite === 'peu-rentable') {
    return <span className="fiab muted" aria-label={label}>Peu rentable : la table donne {brut(ressource)}, soit {dec(ressource.xp)} XP par unité.</span>;
  }
  if (!aVerifier(ressource)) return null;
  const f = fourchette(ressource);
  return (
    <span className="fiab alerte" aria-label={label}>
      <span>
        ⚠ À vérifier en jeu : {ressource.fiabilite === 'inconnue' ? 'XP inconnue dans la table'
          : `valeur approximative, la table donne ${brut(ressource)}${f ? ` (entre ${dec(f[0])} et ${dec(f[1])} par unité)` : ''}`}.
      </span>
      {xp > 0 && <button className="btn small ghost" onClick={onVerifier}>{dec(xp)} XP vérifiée en jeu</button>}
    </span>
  );
}

/** Ressources de la bibliothèque dont l'XP est à vérifier, avec une recherche. */
function ListeAVerifier({ biblio }: { biblio: RessourceXp[] }) {
  const [q, setQ] = useState('');
  const douteuses = biblio.filter(aVerifier);
  if (!biblio.length) return null;
  const k = plat(q.trim());
  const vues = douteuses.filter((r) => !k || plat(r.nom).includes(k));
  const verifiees = biblio.filter((r) => r.fiabilite === 'verifiee').length;
  const peuRentables = biblio.filter((r) => r.fiabilite === 'peu-rentable').length;
  return (
    <details className="averifier" style={{ marginTop: 6 }}>
      <summary>
        À vérifier en jeu : <b>{douteuses.length}</b> sur {biblio.length}
        <span className="muted"> ({douteuses.filter((r) => r.fiabilite === 'approximative').length} approximatives, {douteuses.filter((r) => r.fiabilite === 'inconnue').length} inconnues{verifiees ? `, ${verifiees} déjà vérifiées` : ''}) · {peuRentables} peu rentables écartées</span>
      </summary>
      <input placeholder="Chercher" aria-label="Chercher une ressource à vérifier" value={q} onChange={(e) => setQ(e.target.value)} style={{ margin: '6px 0' }} />
      <ul aria-label="Ressources à vérifier">
        {vues.slice(0, 200).map((r) => (
          <li key={r.nom}>{r.nom} <span className="muted">· {r.fiabilite === 'inconnue' ? 'XP inconnue' : `table : ${brut(r)}`}</span></li>
        ))}
      </ul>
      {vues.length > 200 && <p className="note">… et {vues.length - 200} autres : affine la recherche.</p>}
    </details>
  );
}

/**
 * Mes ressources : les favoris et la croquette enrichie, avec leur valeur à l'unité (prix d'achat, ou de revente
 * pour une ressource farmée), le coût d'un point d'XP et le coût pour le niveau visé. Tri par rentabilité, prix ou gain d'XP.
 */
function MesRessources({ biblio, favoris, setFavoris, besoin, vise, onUtiliser }: {
  biblio: RessourceXp[]; favoris: Favoris; setFavoris: (f: Favoris) => void; besoin: number; vise: number;
  onUtiliser: (nom: string, xp: number, quantite: number, valeur?: number) => void;
}) {
  const [tri, setTriState] = useState<TriFavoris>(() => readPref<TriFavoris>('familiers-tri', 'rentabilite'));
  const setTri = (t: TriFavoris) => { setTriState(t); writePref('familiers-tri', t); };
  const [ajout, setAjout] = useState('');
  const [err, setErr] = useState('');
  const trouver = (nom: string) => { const k = plat(nom.trim()); return k ? biblio.find((r) => plat(r.nom) === k) : undefined; };
  const lignes: (Favori & { fiab?: RessourceXp })[] = [
    { nom: CROQUETTE, xp: XP_CROQUETTE, fiabilite: 'fiable', ...favoris[CROQUETTE] },
    ...Object.keys(favoris).filter((n) => n !== CROQUETTE).flatMap((n) => {
      const r = trouver(n);
      return r ? [{ nom: r.nom, xp: r.xp, fiabilite: r.fiabilite, plage: fourchette(r), fiab: r, ...favoris[n] }] : [];
    }),
  ];
  const tries = trierFavoris(lignes, tri, besoin);
  const setValeur = (nom: string, v: string) => {
    const n = Math.round(Number(v.replace(/\s/g, '').replace(',', '.')));
    setFavoris({ ...favoris, [nom]: n > 0 ? { valeur: n, le: Date.now() } : {} });
  };
  const ajouter = () => {
    const r = trouver(ajout);
    if (!r) { setErr(`« ${ajout} » n'est pas dans la bibliothèque.`); return; }
    setFavoris({ ...favoris, [r.nom]: favoris[r.nom] ?? {} });
    setAjout(''); setErr('');
  };
  return (
    <div className="mesres" role="region" aria-label="Mes ressources">
      <div className="bar" style={{ margin: '0 0 6px', alignItems: 'center' }}>
        <b>Mes ressources</b>
        <span className="seg" role="group" aria-label="Trier par">
          <button aria-pressed={tri === 'rentabilite'} onClick={() => setTri('rentabilite')}>Rentabilité</button>
          <button aria-pressed={tri === 'prix'} onClick={() => setTri('prix')}>Prix</button>
          <button aria-pressed={tri === 'xp'} onClick={() => setTri('xp')}>Gain d'XP</button>
        </span>
        <input list="ressourcesXp" placeholder="Ajouter une ressource" aria-label="Ajouter une ressource aux favoris" value={ajout}
          onChange={(e) => setAjout(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ajouter()} />
        <button className="btn small ghost" disabled={!ajout.trim()} onClick={ajouter}>★ Ajouter</button>
        {err && <span className="ko">{err}</span>}
      </div>
      <div className="scroll">
        <table className="inv" aria-label="Comparaison des ressources">
          <thead><tr>
            <th>Ressource</th><th className="num">XP / unité</th><th className="num">Valeur (kamas)</th><th className="num">Kamas / XP</th>
            <th className="num">Pour le niveau {vise}</th><th />
          </tr></thead>
          <tbody>
            {tries.map((f) => {
              const c = comparer(f, besoin);
              const douteuse = f.fiabilite === 'approximative' || f.fiabilite === 'inconnue';
              return (
                <tr key={f.nom} aria-label={f.nom}>
                  <td>
                    {f.nom !== CROQUETTE && <button className="etoile" aria-pressed="true" aria-label={`Retirer des favoris : ${f.nom}`} onClick={() => { const n = { ...favoris }; delete n[f.nom]; setFavoris(n); }}>★</button>}
                    {f.nom}
                    {douteuse && <span className="ko" title="Valeur à vérifier en jeu"> ⚠</span>}
                    {f.fiabilite === 'peu-rentable' && <span className="muted"> (peu rentable)</span>}
                  </td>
                  <td className="num">{f.xp > 0 ? dec(f.xp) : '?'}</td>
                  <td className="num">
                    <input className="invcell" inputMode="numeric" aria-label={`Valeur ${f.nom}`} value={f.valeur ?? ''} onChange={(e) => setValeur(f.nom, e.target.value)} />
                    {f.le && <div className="muted" style={{ fontSize: '.72rem' }}>du {jour(f.le)}</div>}
                  </td>
                  <td className="num">
                    {c.coutXpMin !== null && c.coutXpMax !== null ? `${dec(c.coutXpMin)} à ${dec(c.coutXpMax)}` : c.coutXp !== null ? dec(c.coutXp) : '—'}
                  </td>
                  <td className="num">
                    {besoin <= 0 ? <span className="ok">atteint</span> : c.quantite !== null ? <>{num(c.quantite)}{c.cout !== null && <div className="muted" style={{ fontSize: '.78rem' }}>{fmtK(c.cout)}</div>}</> : '—'}
                  </td>
                  <td>{c.quantite ? <button className="btn small ghost" onClick={() => onUtiliser(f.nom, f.xp, c.quantite!, f.valeur)}>Utiliser</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ margin: '4px 0 0' }}>
        Valeur à l'unité : le prix d'achat, ou ce que tu pourrais revendre une ressource que tu as farmée (0 la classerait toujours première, à tort).
        « Utiliser » l'ajoute au simulateur avec la quantité pour le niveau visé.
      </p>
    </div>
  );
}
