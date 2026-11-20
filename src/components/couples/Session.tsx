import { useState } from 'react';
import { findColorIn, SPECIES_LABEL, type Sex } from '../../domain/colors';
import { marquerATester } from '../../domain/conseils';
import { filesParents } from '../../domain/destinations';
import { naissancesPossibles, type LotPlan } from '../../domain/planGeneration';
import { newMonture } from '../../domain/stock';
import type { Monture } from '../../domain/types';
import { lireAccouplement, type Naissance } from '../../domain/voix';
import { useEtable } from '../../store/EtableContext';
import { colorListId, SexMark, Swatch } from '../ui';
import { BarreVoix, type Retour } from '../Voix';

type Esp = 'muldo' | 'volkorne';
/** Accouplements faits pendant la session, par lot : chaque accouplement = ses bébés (1, ou 2 avec un reproducteur). */
export interface EtatSession { actif: string | null; faits: Record<string, Naissance[][]> }
export const SESSION_VIDE: EtatSession = { actif: null, faits: {} };
const cle = (l: Pick<LotPlan, 'm' | 'f'>) => `${l.m}|${l.f}`;
const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');
const gen = (e: Esp, c: string) => findColorIn(e, c)?.gen ?? 0;

/**
 * Mode session : en jeu, tout est dans le même panier. L'outil tient le compte à ta place : un clic (ou une phrase)
 * par accouplement, avec le bébé obtenu. La lignée de chaque bébé est gardée, puis « Valider » enregistre le lot.
 */
export function Session({ espece, lots, etat, setEtat }: { espece: Esp; lots: LotPlan[]; etat: EtatSession; setEtat: (n: EtatSession) => void }) {
  const { dd, settings, act } = useEtable();
  const [jumeau, setJumeau] = useState(false);
  const [ecoute, setEcoute] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const faits = (l: LotPlan) => etat.faits[cle(l)] ?? [];
  const noter = (l: LotPlan, bebes: Naissance[], commeJumeau: boolean) => {
    const liste = [...faits(l)];
    if (commeJumeau && liste.length) liste[liste.length - 1] = [...liste[liste.length - 1], ...bebes];
    else liste.push(bebes);
    setEtat({ actif: cle(l), faits: { ...etat.faits, [cle(l)]: liste } });
  };
  const annuler = (l: LotPlan) => {
    const liste = faits(l).slice(0, -1);
    setEtat({ ...etat, faits: { ...etat.faits, [cle(l)]: liste } });
  };

  // Enregistre les accouplements notés d'un lot : chaque bébé garde la lignée exacte de son couple
  const valider = (l: LotPlan) => {
    const notes = faits(l);
    const n = notes.length;
    const pick = (c: string, x: Sex) => dd.filter((d) => d.espece === espece && d.etat === 'feconde' && d.sexe === x && findColorIn(espece, d.couleur)?.name === c)
      .sort((a, b) => Number(!!b.reproducteur) - Number(!!a.reproducteur) || a.created - b.created).slice(0, n);
    const pm = pick(l.m, 'M'), pf = pick(l.f, 'F');
    if (pm.length < n || pf.length < n) { setErr({ ...err, [cle(l)]: `Il n'y a que ${Math.min(pm.length, pf.length)} couples possibles en stock pour ${n} notés.` }); return; }
    const kids: Monture[] = notes.flatMap((bebes, i) => bebes.map((b) => newMonture(b.c, b.x, pm[i], pf[i], { espece })));
    const noms = marquerATester(espece, kids, l.m, l.f, dd);
    const files = filesParents([...pm, ...pf], settings.regles);
    const bilan = [...new Set(kids.map((b) => b.couleur))].map((c) => `${kids.filter((b) => b.couleur === c).length} ${c}`).join(', ');
    act('accouplement', `${SPECIES_LABEL[espece]} : ${n} × ${l.m} ♂ × ${l.f} ♀ → ${bilan}${noms.length ? ` · à nommer en jeu : ${noms.join(', ')}` : ''}${files.resume ? ` · parents : ${files.resume}` : ''}`,
      { add: kids, del: [...pm, ...pf], queue: files.queue, extract: files.extract });
    const reste = { ...etat.faits };
    delete reste[cle(l)];
    setEtat({ actif: etat.actif === cle(l) ? null : etat.actif, faits: reste });
    setErr({ ...err, [cle(l)]: '' });
  };

  // Commande vocale : « Doré avec Pourpre donne Doré et Pourpre femelle », « Roux mâle », « jumeau Doré mâle », « annuler »
  const dicter = (phrase: string): Retour => {
    const r = lireAccouplement(espece, phrase);
    const actif = lots.find((l) => cle(l) === etat.actif);
    if (!r) return { ok: false, texte: 'pas compris : dis le bébé puis son sexe (« Doré et Pourpre femelle »), ou le couple (« Doré avec Pourpre »)' };
    if ('commande' in r) {
      if (!actif || !faits(actif).length) return { ok: false, texte: 'rien à annuler' };
      annuler(actif);
      return { ok: true, texte: `dernier accouplement ${actif.m} × ${actif.f} annulé` };
    }
    let lot = actif;
    if (r.lot) {
      lot = lots.find((l) => l.m === r.lot!.m && l.f === r.lot!.f) ?? lots.find((l) => l.m === r.lot!.f && l.f === r.lot!.m);
      if (!lot) return { ok: false, texte: `pas de lot ${r.lot.m} × ${r.lot.f} dans le plan` };
    }
    if (!lot) return { ok: false, texte: 'dis d’abord le couple : « Doré avec Pourpre »' };
    if (!r.bebes.length) { setEtat({ ...etat, actif: cle(lot) }); return { ok: true, texte: `lot actif : ${lot.m} ♂ × ${lot.f} ♀` }; }
    noter(lot, r.bebes, r.jumeau);
    const total = faits(lot).length + (r.jumeau ? 0 : 1);
    return { ok: true, texte: `${lot.m} × ${lot.f} : ${r.bebes.map((b) => `${b.c} ${sym(b.x)}`).join(' + ')}${r.jumeau ? ' (jumeau)' : ''} · ${total}/${lot.n}` };
  };

  // Phrases types avec les couleurs du couple actif (ou du premier couple)
  const lotActif = lots.find((l) => cle(l) === etat.actif);
  const autre = lots.find((l) => l !== lotActif);
  const modeles = lotActif
    ? [`${lotActif.bebe} femelle`, `jumeau ${lotActif.m} mâle`, 'annuler', ...(autre ? [`${autre.m} avec ${autre.f}`] : [])]
    : lots.length ? [`${lots[0].m} avec ${lots[0].f}`, `${lots[0].m} avec ${lots[0].f} donne ${lots[0].bebe} mâle`] : [];

  // Regroupés par générations des parents : en jeu, on filtre une génération ; les couples mixtes passent à la fin
  const groupes = [...new Set(lots.map((l) => `${gen(espece, l.m)}|${gen(espece, l.f)}`))]
    .sort((a, b) => Number(a.split('|')[0] !== a.split('|')[1]) - Number(b.split('|')[0] !== b.split('|')[1]) || a.localeCompare(b));

  return (
    <div className="session">
      <BarreVoix label="Dictée des accouplements" onPhrase={dicter} modeles={modeles} onEcoute={setEcoute} />
      {groupes.map((g) => {
        const [a, b] = g.split('|').map(Number);
        const duGroupe = lots.filter((l) => `${gen(espece, l.m)}|${gen(espece, l.f)}` === g);
        return (
          <div key={g} className="session-groupe">
            <h3 className="session-titre">
              {a === b ? `Génération ${a}` : `Générations ${a} et ${b}`}
              {a !== b && <span className="ko" style={{ fontSize: '.8rem', fontWeight: 400 }}> · aucun filtre du jeu ne les montre ensemble</span>}
            </h3>
            {duGroupe.map((l) => {
              const notes = faits(l);
              const bebes = notes.flat();
              const actif = etat.actif === cle(l);
              return (
                <div key={cle(l)} className={`carte-lot${actif ? ' actif' : ''}`} role="group" aria-label={`Session ${l.m} × ${l.f}`}
                  onClick={() => !actif && setEtat({ ...etat, actif: cle(l) })}>
                  <div className="carte-tete">
                    <span className="parent"><Swatch espece={espece} name={l.m} size={24} /> <SexMark x="M" /> {l.m}</span>
                    <span className="muted">×</span>
                    <span className="parent"><Swatch espece={espece} name={l.f} size={24} /> <SexMark x="F" /> {l.f}</span>
                    <span className="compteur" aria-label="Compteur">{notes.length}/{l.n}</span>
                  </div>
                  {actif && ecoute && (
                    <p className="modeles" aria-label="Phrases pour ce couple" style={{ margin: '4px 0 0' }}>
                      🎤 <q>{l.bebe} femelle</q> · <q>{l.m} mâle</q> · <q>jumeau {l.f} femelle</q> · <q>annuler</q>
                    </p>
                  )}
                  <div className="bebes" role="group" aria-label="Bébé obtenu">
                    {naissancesPossibles(l).flatMap((c) => (['M', 'F'] as Sex[]).map((x) => (
                      <button key={`${c}|${x}`} className="btn small ghost bebe" aria-label={`${c} ${x === 'M' ? 'mâle' : 'femelle'}`}
                        onClick={(e) => { e.stopPropagation(); noter(l, [{ c, x }], jumeau); setJumeau(false); }}>
                        <Swatch espece={espece} name={c} size={16} /> <SexMark x={x} /> {c}
                      </button>
                    )))}
                    <AutreBebe espece={espece} onAjout={(b) => { noter(l, [b], jumeau); setJumeau(false); }} />
                  </div>
                  <div className="bar" style={{ margin: '6px 0 0', alignItems: 'center' }}>
                    <label className="inline" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={jumeau && actif} onChange={(e) => { setEtat({ ...etat, actif: cle(l) }); setJumeau(e.target.checked); }} /> le prochain est un jumeau
                    </label>
                    <span className="muted">
                      {bebes.length ? [...new Set(bebes.map((x) => `${x.c}|${x.x}`))].map((key) => {
                        const [c, x] = key.split('|');
                        return `${bebes.filter((y) => y.c === c && y.x === x).length} ${c} ${sym(x as Sex)}`;
                      }).join(', ') : 'aucun accouplement noté'}
                    </span>
                    <span style={{ flex: 1 }} />
                    {notes.length > 0 && <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); annuler(l); }}>Annuler le dernier</button>}
                    {notes.length > 0 && <button className="btn small" onClick={(e) => { e.stopPropagation(); valider(l); }}>Valider {notes.length} accouplement{notes.length > 1 ? 's' : ''}</button>}
                  </div>
                  {err[cle(l)] && <p className="ko" style={{ margin: '4px 0 0' }}>{err[cle(l)]}</p>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Un bébé d'une autre couleur (un grand-parent) : couleur, puis sexe. */
function AutreBebe({ espece, onAjout }: { espece: Esp; onAjout: (b: Naissance) => void }) {
  const [c, setC] = useState('');
  const col = c.trim() ? findColorIn(espece, c) : null;
  return (
    <span className="autre" onClick={(e) => e.stopPropagation()}>
      <input list={colorListId(espece)} placeholder="Autre couleur" aria-label="Autre couleur de bébé" value={c} onChange={(e) => setC(e.target.value)} style={{ width: '10em' }} />
      {col && (['M', 'F'] as Sex[]).map((x) => (
        <button key={x} className="btn small ghost" aria-label={`${col.name} ${x === 'M' ? 'mâle' : 'femelle'} (autre)`} onClick={() => { onAjout({ c: col.name, x }); setC(''); }}>
          <SexMark x={x} />
        </button>
      ))}
    </span>
  );
}
