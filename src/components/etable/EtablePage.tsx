import { useState } from 'react';
import { SPECIES_LABEL, type Espece } from '../../domain/colors';
import { useEtable } from '../../store/EtableContext';
import { readPref, writePref } from '../../store/prefs';
import { queueTotal } from '../../store/storage';
import { MateDialog, type MateRequest } from '../MateDialog';
import { AddForm } from './AddForm';
import { InventaireGrid } from './InventaireGrid';
import { NextGen } from './NextGen';
import { StockTable, type Filtre } from './StockTable';

const FILTER_KEY = 'etable-filtre';
const SPECIES_KEY = 'etable-espece';

export function EtablePage() {
  const [mate, setMate] = useState<MateRequest | null>(null);
  const [filtre, setFiltreState] = useState<Filtre>(() => readPref<Filtre>(FILTER_KEY, 'toutes'));
  const setFiltre = (f: Filtre) => { setFiltreState(f); writePref(FILTER_KEY, f); };
  const [espece, setEspeceState] = useState<Espece>(() => readPref<Espece>(SPECIES_KEY, 'dragodinde'));
  const setEspece = (e: Espece) => { setEspeceState(e); writePref(SPECIES_KEY, e); };
  const [inventaire, setInventaire] = useState(false);
  const { dd, queue } = useEtable();
  const count = (e: Espece) => dd.filter((d) => d.espece === e).length;
  return (
    <section>
      <div className="bar">
        <div className="seg" role="group" aria-label="Espèce">
          {(['dragodinde', 'volkorne', 'muldo'] as Espece[]).map((e) => (
            <button key={e} aria-pressed={espece === e} onClick={() => setEspece(e)}>{SPECIES_LABEL[e]} ({count(e)})</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button className={inventaire ? 'btn' : 'btn ghost'} aria-pressed={inventaire} onClick={() => setInventaire(!inventaire)}>
          {inventaire ? 'Fermer l’inventaire' : 'Inventaire'}
        </button>
      </div>
      {(espece === 'volkorne' || espece === 'muldo') && queueTotal(queue, espece) > 0 && !inventaire && (
        <p className="note" style={{ margin: '0 0 10px' }}>À briser : <b>{queueTotal(queue, espece)}</b> (hors stock, voir la page Brisage).</p>
      )}
      {inventaire ? <InventaireGrid espece={espece} onDone={() => setInventaire(false)} /> : <>
      <AddForm espece={espece} onManual={() => setMate({ m: '', f: '', child: '', babyPre: '', journal: false })} />
      <div className="bar">
        <div className="seg" role="group" aria-label="Filtre">
          {([['toutes', 'Toutes'], ['feconde', 'Fécondes'], ['fertile', 'Fertiles']] as [Filtre, string][]).map(([f, l]) => (
            <button key={f} aria-pressed={filtre === f} onClick={() => setFiltre(f)}>{l}</button>
          ))}
        </div>
        <span className="note" style={{ margin: 0 }}>
          {filtre === 'feconde' ? 'Seules les fécondes peuvent s’accoupler.' : 'Fertile : en élevage. Féconde : prête à s’accoupler.'}
        </span>
      </div>
      <StockTable filtre={filtre} espece={espece} />
      {espece === 'dragodinde'
        ? <NextGen onOther={(b) => setMate({ ...b, babyPre: '', journal: true })} />
        : <p className="panel note" style={{ marginTop: 16 }}>Le plan d'accouplement des {SPECIES_LABEL[espece].toLowerCase()} (monter en génération) est dans la page Couples. Ici : le stock et l'inventaire.</p>}
      </>}
      <MateDialog req={mate} onClose={() => setMate(null)} />
    </section>
  );
}
