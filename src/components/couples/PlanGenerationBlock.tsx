import { useMemo, useState } from 'react';
import { colorsOf, findColorIn, SPECIES_LABEL, type Sex } from '../../domain/colors';
import { conseilsSexe, marquerATester, nomsJeu, verdictOptimakina } from '../../domain/conseils';
import { filesParents } from '../../domain/destinations';
import { ciblesAuto, naissancesPossibles, planGeneration, type LotPlan } from '../../domain/planGeneration';
import { recettes } from '../../domain/recettes';
import { newMonture } from '../../domain/stock';
import type { Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { fmtK } from './format';
import { colorListId, MountTag, SexMark, Swatch } from '../ui';
import { ARetenir } from './ARetenir';

type Esp = 'muldo' | 'volkorne';
const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');
const ROLE: Record<LotPlan['role'], string> = { atteint: 'génération supérieure', prepare: 'prépare', epuise: 'épuise le stock' };

/**
 * Plan d'une session d'accouplements des muldos ou des volkornes : monter en génération en épuisant le stock.
 * Chaque lot se valide seul, en entier ou en partie, avec ses naissances.
 */
export function PlanGenerationBlock({ espece }: { espece: Esp }) {
  const { dd, settings, updateSettings } = useEtable();
  const auto = useMemo(() => ciblesAuto(espece, dd), [espece, dd]);
  const cibles = settings.cibles[espece] ?? auto;
  const rec = useMemo(() => recettes(espece, settings.recettes), [espece, settings.recettes]);
  const plan = useMemo(() => planGeneration(espece, dd, rec, cibles), [espece, dd, rec, cibles]);
  const monos = colorsOf(espece).filter((c) => c.parts.length === 1 && c.gen >= 3);
  const fec = dd.filter((d) => d.espece === espece && d.etat === 'feconde').length;
  const couples = plan.lots.reduce((s, l) => s + l.n, 0);
  const conseils = useMemo(() => conseilsSexe(espece, dd, plan.lots, rec, cibles, settings.chanceBase), [espece, dd, plan, rec, cibles, settings.chanceBase]);

  const setCibles = (list: string[] | null) => {
    const next = { ...settings.cibles };
    if (list) next[espece] = list; else delete next[espece];
    updateSettings({ cibles: next });
  };
  const toggle = (c: string) => setCibles(cibles.includes(c) ? cibles.filter((x) => x !== c) : [...cibles, c]);

  return (
    <>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="bar" style={{ margin: 0, alignItems: 'center' }}>
          <b>Viser</b>
          <span className="cibles" role="group" aria-label="Monocolores visées">
            {monos.map((c) => (
              <button key={c.name} className="cible" aria-pressed={cibles.includes(c.name)} onClick={() => toggle(c.name)} title={`Génération ${c.gen}`}>
                <Swatch name={c.name} size={12} /> {c.name} <span className="muted">G{c.gen}</span>
              </button>
            ))}
          </span>
          {settings.cibles[espece] && <button className="btn small ghost" onClick={() => setCibles(null)}>Automatique ({auto.join(', ')})</button>}
        </div>
        <p className="note" style={{ margin: '6px 0 0' }}>
          Le plan atteint d'abord ce qui est possible tout de suite, puis prépare les bicolores des recettes visées en quantités égales,
          puis épuise le stock. Seules les fécondes s'accouplent ; les fertiles comptent pour l'équilibre.
        </p>
      </div>

      {conseils.length > 0 && (
        <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--gold)' }} role="region" aria-label="Sexes à cibler">
          <h3 style={{ fontSize: '1.05rem', marginBottom: 6 }}>Sexes à cibler (Animakina)</h3>
          {conseils.map((c) => (
            <p key={`${c.lot.m}|${c.lot.f}|${c.sexe}`} style={{ margin: '4px 0' }}>
              <b>Animakina <SexMark x={c.sexe} /></b> sur <b>{c.accouplements}</b> accouplement{c.accouplements > 1 ? 's' : ''} <MountTag c={c.lot.m} x="M" /> × <MountTag c={c.lot.f} x="F" />
              <span className="muted"> : {c.attente.n} <MountTag c={c.attente.c} x={c.attente.x} /> attendent des {c.sexe === 'F' ? 'femelles' : 'mâles'} {c.lot.bebe} pour faire du {c.pour}.</span>
            </p>
          ))}
          <p className="note" style={{ marginBottom: 0 }}>Une seule makina par accouplement : chaque Animakina remplace une Optimakina sur ce couple. Le nombre tient compte de la chance de réussite ({settings.chanceBase} %).</p>
        </div>
      )}

      {!fec ? <p className="panel muted">Aucune {SPECIES_LABEL[espece].toLowerCase().slice(0, -1)} féconde : saisis-les avec l'inventaire de Mon étable.</p> : (
        <div className="panel" role="region" aria-label="Plan de la session">
          <h3 style={{ fontSize: '1.15rem' }}>
            Session : {couples} couple{couples > 1 ? 's' : ''} <span className="muted" style={{ fontWeight: 400 }}>· {couples * 2} fécondes sur {fec}</span>
          </h3>
          {plan.lots.map((l) => <LigneLot key={`${l.m}|${l.f}`} espece={espece} lot={l} />)}
          {!plan.lots.length && <p className="muted">Aucun croisement utile avec les fécondes actuelles.</p>}
          {plan.restes.length > 0 && (
            <p className="note" style={{ marginBottom: 0 }}>
              Reste, faute de partenaire de l'autre sexe ou de couleur complémentaire :{' '}
              {plan.restes.map((r, i) => <span key={`${r.c}|${r.x}`}>{i ? ', ' : ''}<b>{r.n}</b> <MountTag c={r.c} x={r.x} /></span>)}
            </p>
          )}
        </div>
      )}
      <ARetenir espece={espece} rec={rec} />
    </>
  );
}

/** Un lot du plan, et sa validation : combien de couples faits, et quelles naissances. */
function LigneLot({ espece, lot }: { espece: Esp; lot: LotPlan }) {
  const { dd, settings, act } = useEtable();
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(lot.n);
  const [nb, setNb] = useState<Record<string, string>>({});
  const [autre, setAutre] = useState('');
  const [err, setErr] = useState('');
  const [repro, setRepro] = useState<{ c: string; x: Sex }[]>([]);
  const [choixRepro, setChoixRepro] = useState('');
  const couleurs = naissancesPossibles(lot);
  const opti = verdictOptimakina(espece, lot, settings.prix);
  const repros = dd.filter((d) => d.espece === espece && d.etat === 'feconde' && d.reproducteur
    && ((d.sexe === 'M' && findColorIn(espece, d.couleur)?.name === lot.m) || (d.sexe === 'F' && findColorIn(espece, d.couleur)?.name === lot.f)));
  const val = (c: string, x: Sex) => Math.max(0, Math.floor(Number(nb[`${c}|${x}`]) || 0));
  const autreCol = autre.trim() ? findColorIn(espece, autre) : null;
  const total = [...couleurs, ...(autreCol ? [autreCol.name] : [])].reduce((s, c) => s + val(c, 'M') + val(c, 'F'), 0);
  const fait = Math.max(1, Math.min(lot.n, Math.floor(k) || 1));

  const valider = () => {
    if (autre.trim() && !autreCol) { setErr(`« ${autre} » n'est pas une couleur de ${SPECIES_LABEL[espece].toLowerCase()}.`); return; }
    if (total && (total < fait || total > 2 * fait)) { setErr(`${fait} accouplement${fait > 1 ? 's' : ''} donnent entre ${fait} et ${2 * fait} bébés (2 avec un reproducteur).`); return; }
    const pick = (c: string, x: Sex) => dd.filter((d) => d.espece === espece && d.etat === 'feconde' && d.sexe === x && findColorIn(espece, d.couleur)?.name === c)
      .sort((a, b) => Number(!!b.reproducteur) - Number(!!a.reproducteur) || a.created - b.created).slice(0, fait);
    const pm = pick(lot.m, 'M'), pf = pick(lot.f, 'F');
    if (pm.length < fait || pf.length < fait) { setErr('Il n’y a plus assez de fécondes pour ce lot.'); return; }
    // Chaque bébé garde la lignée d'un des couples du lot
    const kids: Monture[] = [];
    for (const c of [...couleurs, ...(autreCol ? [autreCol.name] : [])]) for (const x of ['M', 'F'] as Sex[]) {
      for (let i = 0; i < val(c, x); i++) {
        const j = kids.length % fait;
        kids.push(newMonture(c, x, pm[j], pf[j], { espece }));
      }
    }
    // Reproducteurs notés, puis bébés tombés sous la génération des parents : un nom à leur donner en jeu
    const noms: string[] = [];
    const nommer = (prefixe: 'T' | 'R', list: Monture[], flag: Partial<Monture>) => {
      for (const c of new Set(list.map((b) => b.couleur))) {
        const de = list.filter((b) => b.couleur === c);
        const ns = nomsJeu(prefixe, c, de.length, [...dd, ...kids]);
        de.forEach((b, i) => { Object.assign(b, flag, { nom: b.nom ? `${b.nom} ${ns[i]}` : ns[i] }); noms.push(ns[i]); });
      }
    };
    const reproKids: Monture[] = [];
    for (const r of repro) {
      const b = kids.find((k) => k.couleur === r.c && k.sexe === r.x && !reproKids.includes(k));
      if (b) reproKids.push(b);
    }
    nommer('R', reproKids, { reproducteur: true });
    noms.push(...marquerATester(espece, kids, lot.m, lot.f, dd));
    const files = filesParents([...pm, ...pf], settings.regles);
    const bilan = kids.length ? [...new Set(kids.map((b) => b.couleur))].map((c) => `${kids.filter((b) => b.couleur === c).length} ${c}`).join(', ') : 'naissances non notées';
    act('accouplement', `${SPECIES_LABEL[espece]} : ${fait} × ${lot.m} ♂ × ${lot.f} ♀ → ${bilan}${noms.length ? ` · à nommer en jeu : ${noms.join(', ')}` : ''}${files.resume ? ` · parents : ${files.resume}` : ''}`,
      { add: kids, del: [...pm, ...pf], queue: files.queue, extract: files.extract });
    setOpen(false); setNb({}); setAutre(''); setErr(''); setRepro([]);
  };

  const champ = (c: string, x: Sex) => (
    <label className="inline" key={`${c}|${x}`}>
      <SexMark x={x} />
      <input inputMode="numeric" style={{ width: '3.5em' }} aria-label={`Naissances ${c} ${sym(x)}`} value={nb[`${c}|${x}`] ?? ''}
        onChange={(e) => setNb({ ...nb, [`${c}|${x}`]: e.target.value.replace(/[^0-9]/g, '') })} />
    </label>
  );

  return (
    <div className="planline lot" aria-label={`Lot ${lot.m} × ${lot.f}`} role="group">
      <div>
        <b>{lot.n}×</b> <MountTag c={lot.m} x="M" /> × <MountTag c={lot.f} x="F" /> → <Swatch name={lot.bebe} size={14} /> <b>{lot.bebe}</b>{' '}
        <span className="muted">G{lot.gen}</span>{' '}
        <span className={`role ${lot.role}`}>{lot.role === 'prepare' && lot.pour ? `prépare ${lot.pour}` : ROLE[lot.role]}</span>
        {repros.length > 0 && (
          <div className="opti">★ {repros.map((d) => d.nom ?? d.couleur).join(', ')} : reproducteur{repros.length > 1 ? 's' : ''} dans ce lot, 2 bébés chacun ; l'outil le{repros.length > 1 ? 's' : ''} prend en premier.</div>
        )}
        {opti.seuil > 0 && (
          <div className="opti" title="Une Optimakina ajoute 20 points de chance ; ce seuil ne compte que l'extraction (et les génétons si leur prix est réglé)">
            Optimakina :{' '}
            {opti.prix === null ? <span className="muted">rentable sous {fmtK(opti.seuil)}</span>
              : <span className={opti.rentable ? 'ok' : 'ko'}>{opti.rentable ? 'rentable' : 'pas rentable'} à {fmtK(opti.prix)} (seuil {fmtK(opti.seuil)})</span>}
          </div>
        )}
      </div>
      <div className="planbtns">
        <button className="btn small" aria-expanded={open} onClick={() => { setOpen(!open); setK(lot.n); }}>Faits…</button>
      </div>
      {open && (
        <div className="valider" style={{ flexBasis: '100%' }}>
          <div className="bar" style={{ margin: '4px 0' }}>
            <label className="inline">Accouplements faits
              <input type="number" min={1} max={lot.n} style={{ width: '4.5em' }} aria-label="Accouplements faits" value={k} onChange={(e) => setK(Number(e.target.value))} />
              <span className="muted">sur {lot.n}</span>
            </label>
          </div>
          <div className="naissances">
            {couleurs.map((c) => (
              <span key={c} className="nais"><Swatch name={c} size={12} /> {c} {champ(c, 'M')} {champ(c, 'F')}</span>
            ))}
            <span className="nais">
              <input list={colorListId(espece)} placeholder="Autre couleur" aria-label="Autre couleur" style={{ width: '11em' }} value={autre} onChange={(e) => setAutre(e.target.value)} />
              {autreCol && <>{champ(autreCol.name, 'M')} {champ(autreCol.name, 'F')}</>}
            </span>
          </div>
          {total > 0 && (
            <div className="bar" style={{ margin: '6px 0 0', alignItems: 'center' }}>
              <span className="muted">Reproducteurs :</span>
              {repro.map((r, i) => (
                <span key={i} className="badge">{r.c} {sym(r.x)} <button className="x" aria-label={`Retirer le reproducteur ${r.c} ${sym(r.x)}`} onClick={() => setRepro(repro.filter((_, j) => j !== i))}>×</button></span>
              ))}
              <select aria-label="Bébé reproducteur" value={choixRepro} onChange={(e) => setChoixRepro(e.target.value)}>
                <option value="">Choisir…</option>
                {[...couleurs, ...(autreCol ? [autreCol.name] : [])].flatMap((c) => (['M', 'F'] as Sex[]).filter((x) => val(c, x) > repro.filter((r) => r.c === c && r.x === x).length)
                  .map((x) => <option key={`${c}|${x}`} value={`${c}|${x}`}>{c} {sym(x)}</option>))}
              </select>
              <button className="btn small ghost" disabled={!choixRepro} onClick={() => { const [c, x] = choixRepro.split('|'); setRepro([...repro, { c, x: x as Sex }]); setChoixRepro(''); }}>+ Reproducteur</button>
            </div>
          )}
          <div className="bar" style={{ margin: '6px 0 0' }}>
            <span className="muted">{total ? `${total} bébé${total > 1 ? 's' : ''} noté${total > 1 ? 's' : ''}` : 'Sans naissance notée, seuls les parents sortent.'}</span>
            <button className="btn small" style={{ marginLeft: 'auto' }} onClick={valider}>Valider {fait} accouplement{fait > 1 ? 's' : ''}</button>
            {err && <span className="ko" style={{ flexBasis: '100%' }}>{err}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
