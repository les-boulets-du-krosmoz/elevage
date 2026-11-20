import { useEffect, useRef, useState, type ReactNode } from 'react';
import { colorsOf, findColorIn, swatchBackground, type Espece, type Sex } from '../domain/colors';
import { iconeMonture, MONTURES_OFFICIELLES } from '../domain/montures';

const ICONES: Record<Espece, Map<string, number>> = Object.fromEntries(
  Object.entries(MONTURES_OFFICIELLES).map(([e, list]) => [e, new Map(list)]),
) as Record<Espece, Map<string, number>>;
/** Numéro de l'icône du jeu d'une monture, ou null. */
export const iconeDe = (espece: Espece, name: string) => {
  const c = findColorIn(espece, name);
  return (c && ICONES[espece].get(c.name)) || null;
};

/**
 * Pastille de couleur : pleine pour une monocolore, moitié-moitié pour une bicolore.
 * Avec l'espèce, elle affiche l'image de la monture telle qu'en jeu (et revient à la pastille si l'image ne charge pas).
 */
export function Swatch({ name, size, espece }: { name: string; size?: number; espece?: Espece }) {
  const [echec, setEchec] = useState(false);
  const icone = espece && !echec ? iconeDe(espece, name) : null;
  if (icone) {
    const px = Math.round((size ?? 14) * 1.8);
    return <img className="mi" src={iconeMonture(icone)} width={px} height={px} alt="" title={name} loading="lazy" onError={() => setEchec(true)} />;
  }
  const bg = swatchBackground(name);
  const style = { ...(size ? { width: size, height: size } : {}), background: bg ?? 'repeating-linear-gradient(45deg,#999 0 3px,#ccc 3px 6px)' };
  return <span className="sw" style={style} title={name || 'inconnue'} />;
}

/**
 * Symbole du sexe dessiné en SVG : trait épais et couleur franche (bleu ♂, rose ♀),
 * plus lisible que les caractères ♂ ♀ des polices, souvent fins et gris.
 */
export function SexMark({ x, size = '1.1em' }: { x: Sex; size?: string }) {
  return (
    <svg className={`sexicon sex-${x}`} viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={x === 'M' ? 'mâle' : 'femelle'}>
      {x === 'M' ? (
        <>
          <circle cx="10" cy="14" r="6" />
          <path d="M14.5 9.5 L20 4 M14.5 4 H20 V9.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="9" r="6" />
          <path d="M12 15 V22 M8.5 18.5 H15.5" />
        </>
      )}
    </svg>
  );
}

/** Couleur + sexe, format utilisé partout : image (ou pastille), ♂/♀, nom. */
export const MountTag = ({ c, x, size = 14, espece }: { c: string; x: Sex; size?: number; espece?: Espece }) => (
  <><Swatch name={c} size={size} espece={espece} /> <SexMark x={x} /> {c}</>
);

/** Identifiant de la liste d'autocomplétion des couleurs d'une espèce. */
export const colorListId = (e: Espece) => (e === 'dragodinde' ? 'colorList' : `colorList-${e}`);

/** Listes des couleurs des trois espèces pour l'autocomplétion des champs. */
export const ColorDatalist = () => (
  <>
    {(['dragodinde', 'volkorne', 'muldo'] as Espece[]).map((e) => (
      <datalist key={e} id={colorListId(e)}>
        {colorsOf(e).map((c) => <option key={c.name} value={c.name}>G{c.gen}</option>)}
      </datalist>
    ))}
  </>
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
