import { useMemo, useState } from 'react';
import { findColor, SPECIES_LABEL, type Color, type Espece } from '../../domain/colors';
import { planNow, withoutUsed } from '../../domain/plan';
import type { Monture } from '../../domain/types';
import { useEtable } from '../../store/EtableContext';
import { readPref, writePref } from '../../store/prefs';
import { NowBlock } from './NowBlock';
import { PlanGenerationBlock } from './PlanGenerationBlock';
import { PrepareBlock } from './PrepareBlock';

const SPECIES_KEY = 'couples-espece';

/**
 * Page Couples. Dragodindes : la DD visée, puis « À faire maintenant » et « À préparer ».
 * Muldos et volkornes : le plan de la session, pour monter en génération.
 */
export function CouplesPage() {
  const [espece, setEspeceState] = useState<Espece>(() => readPref<Espece>(SPECIES_KEY, 'dragodinde'));
  const setEspece = (e: Espece) => { setEspeceState(e); writePref(SPECIES_KEY, e); };
  return (
    <section>
      <div className="bar">
        <div className="seg" role="group" aria-label="Espèce">
          {(['dragodinde', 'volkorne', 'muldo'] as Espece[]).map((e) => (
            <button key={e} aria-pressed={espece === e} onClick={() => setEspece(e)}>{SPECIES_LABEL[e]}</button>
          ))}
        </div>
      </div>
      {espece === 'dragodinde' ? <CouplesDragodindes /> : <PlanGenerationBlock key={espece} espece={espece} />}
    </section>
  );
}

function CouplesDragodindes() {
  const { dd, settings, updateSettings } = useEtable();
  const [targetInput, setTargetInput] = useState(settings.target);
  const T = findColor(targetInput);
  const setTarget = (v: string) => {
    setTargetInput(v);
    const c = findColor(v);
    if (c) updateSettings({ target: c.name });
  };

  return (
    <>
      <div className="panel" style={{ marginBottom: 6 }}>
        <div className="bar" style={{ margin: 0 }}>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>DD visée
            <input list="colorList" value={targetInput} style={{ minWidth: 220 }} onChange={(e) => setTarget(e.target.value)} onFocus={(e) => e.target.select()} />
          </label>
        </div>
      </div>
      {!T ? <p className="muted">Choisis la DD visée.</p>
        : !T.recipe ? <p className="muted">{T.name} est une génération 1 : elle s'achète ou se capture, pas de croisement.</p>
          : <Blocks T={T} dd={dd.filter((d) => d.espece === 'dragodinde')} />}
    </>
  );
}

function Blocks({ T, dd }: { T: Color; dd: Monture[] }) {
  const now = useMemo(() => planNow(dd, T.name), [dd, T]);
  const rest = useMemo(() => withoutUsed(dd, now), [dd, now]);
  return (
    <>
      <NowBlock T={T} dd={dd} now={now} />
      <PrepareBlock T={T} rest={rest} />
    </>
  );
}
