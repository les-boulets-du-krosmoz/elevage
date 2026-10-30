import { useState } from 'react';
import { findColorIn, SPECIES_LABEL, type Espece, type Sex } from '../../domain/colors';
import { newMonture } from '../../domain/stock';
import type { Etat } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { colorListId } from '../ui';

const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');

/** Ajout rapide : couleur, sexe, quantité et état (féconde par défaut). */
export function AddForm({ espece, onManual }: { espece: Espece; onManual: () => void }) {
  const { act } = useEtable();
  const [c, setC] = useState('');
  const [x, setX] = useState<Sex>('M');
  const [q, setQ] = useState(1);
  const [etat, setEtat] = useState<Etat>('feconde');
  const [err, setErr] = useState('');
  const add = () => {
    const col = findColorIn(espece, c);
    if (!col) { setErr(`Choisis une couleur de ${SPECIES_LABEL[espece].toLowerCase()} dans la liste`); return; }
    const n = Math.max(1, Math.min(250, q || 1));
    setErr('');
    act('ajout', `${n} ${col.name} ${sym(x)} ${etat === 'feconde' ? 'féconde' : 'fertile'}${n > 1 ? 's' : ''}`,
      { add: Array.from({ length: n }, () => newMonture(col.name, x, undefined, undefined, { etat, espece })) });
  };
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="bar" style={{ margin: 0 }}>
        <input list={colorListId(espece)} placeholder="Couleur" aria-label="Couleur" style={{ minWidth: 200 }} value={c}
          onChange={(e) => setC(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <select aria-label="Sexe" value={x} onChange={(e) => setX(e.target.value as Sex)}>
          <option value="M">♂ Mâle</option><option value="F">♀ Femelle</option>
        </select>
        <input type="number" min={1} value={q} style={{ width: 70 }} aria-label="Quantité" onChange={(e) => setQ(+e.target.value)} />
        <div className="seg" role="group" aria-label="État">
          <button aria-pressed={etat === 'feconde'} onClick={() => setEtat('feconde')}>Féconde</button>
          <button aria-pressed={etat === 'fertile'} onClick={() => setEtat('fertile')}>Fertile</button>
        </div>
        <button className="btn" onClick={add}>Ajouter</button>
        {err && <span className="ko">{err}</span>}
        <span style={{ flex: 1 }} />
        {espece === 'dragodinde' && <button className="btn ghost" onClick={onManual}>Noter un accouplement (formulaire)</button>}
      </div>
    </div>
  );
}
