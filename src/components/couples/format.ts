import type { Sex } from '../../domain/colors';

/** Prix en kamas, comme Kevin les saisit (« 20 000 kamas »). */
export const fmtK = (k: number) => `${Math.round(k).toLocaleString('fr-FR')} kamas`;
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');
export const sym = (x: Sex) => (x === 'M' ? '♂' : '♀');
