import type { JournalEntry } from '../../domain/types';
import { SexMark, Swatch } from '../ui';

/** Pastille d'un accouplement noté : parents, résultat, makinas utilisées. */
export function JournalChip({ r }: { r: JournalEntry }) {
  return (
    <span className={`chip${r.rc === r.child ? '' : ' miss'}`} title={`${r.m} × ${r.f}`}>
      <Swatch espece="dragodinde" name={r.m} size={11} />×<Swatch espece="dragodinde" name={r.f} size={11} /> → <Swatch espece="dragodinde" name={r.rc} size={13} /> {r.rc} <SexMark x={r.rs} />
      {r.rc2 && r.rs2 && <> + <Swatch espece="dragodinde" name={r.rc2} size={13} /> {r.rc2} <SexMark x={r.rs2} /></>}
      {r.sexItem && <span className="itm" title="Animakina utilisée (sexe choisi)">⚥</span>}
      {r.chanceItem && <span className="itm" title="Optimakina utilisée (+20 %)">☘</span>}
    </span>
  );
}
