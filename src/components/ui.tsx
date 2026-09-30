import { useEffect, useRef, useState, type ReactNode } from 'react';
import { COLORS, findColor, sexSymbol, swatchBackground, type Sex } from '../domain/colors';

/** Pastille de couleur : pleine pour une monocolore, moitié-moitié pour une bicolore. */
export function Swatch({ name, size }: { name: string; size?: number }) {
  const bg = swatchBackground(name);
  const style = { ...(size ? { width: size, height: size } : {}), background: bg ?? 'repeating-linear-gradient(45deg,#999 0 3px,#ccc 3px 6px)' };
  return <span className="sw" style={style} title={findColor(name)?.name ?? 'inconnue'} />;
}

export const SexMark = ({ x }: { x: Sex }) => <span className={`sex-${x}`}>{sexSymbol(x)}</span>;

/** Couleur + sexe, format utilisé partout : pastille, ♂/♀, nom. */
export const DDTag = ({ c, x, size = 14 }: { c: string; x: Sex; size?: number }) => (
  <><Swatch name={c} size={size} /> <SexMark x={x} /> {c}</>
);

/** Liste des 66 couleurs pour l'autocomplétion des champs. */
export const ColorDatalist = () => (
  <datalist id="colorList">
    {COLORS.map((c) => <option key={c.name} value={c.name}>G{c.gen}</option>)}
  </datalist>
);

/** Bouton à confirmer par un second clic dans les 3 secondes. */
export function ConfirmButton({ children, confirmLabel = 'Confirmer ?', onConfirm, className = 'btn ghost small' }:
  { children: ReactNode; confirmLabel?: string; onConfirm: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      className={`${className}${armed ? ' danger' : ''}`}
      onClick={() => {
        if (armed) { window.clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
