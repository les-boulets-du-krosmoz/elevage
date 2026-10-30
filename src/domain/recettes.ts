import { colorsOf, findColorIn, type Espece } from './colors';

/**
 * Recettes des monocolores de génération impaire (3 et plus) des muldos et des volkornes,
 * relevées sur Dofus pour les Noobs (pages Muldos et Volkornes, mises à jour en 2026).
 * Une bicolore n'a qu'une recette (ses deux monocolores) ; une monocolore peut en avoir plusieurs.
 * Chaque recette est un couple de bicolores plus jeunes, dont une de la génération précédente, dans n'importe quel sens.
 * Les recettes marquées « à vérifier » semblent erronées chez DPLN (doublon dans la série).
 */
type Brut = Record<string, string[]>;

const MULDO: Brut = {
  Roux: ['Doré et Pourpre + Doré et Indigo', 'Doré et Pourpre + Doré et Ebène', 'Doré et Pourpre + Doré et Orchidée',
    'Doré et Orchidée + Doré et Indigo', 'Doré et Orchidée + Doré et Ebène', 'Doré et Ebène + Doré et Indigo'],
  Amande: ['Indigo et Pourpre + Ebène et Orchidée', 'Ebène et Pourpre + Indigo et Orchidée', 'Orchidée et Pourpre + Ebène et Indigo'],
  Ivoire: ['Roux et Doré + Ebène et Amande', 'Roux et Doré + Indigo et Amande', 'Roux et Doré + Orchidée et Amande', 'Roux et Doré + Pourpre et Amande',
    'Roux et Amande + Ebène et Amande', 'Roux et Amande + Pourpre et Amande', 'Roux et Amande + Indigo et Amande', 'Roux et Amande + Orchidée et Amande'],
  Turquoise: ['Doré et Amande + Roux et Ebène', 'Doré et Amande + Roux et Orchidée', 'Doré et Amande + Roux et Pourpre', 'Doré et Amande + Roux et Indigo',
    'Roux et Amande + Roux et Ebène', 'Roux et Amande + Roux et Indigo', 'Roux et Amande + Roux et Orchidée', 'Roux et Amande + Roux et Pourpre'],
  Prune: ['Ebène et Ivoire + Turquoise et Pourpre', 'Indigo et Ivoire + Turquoise et Orchidée', 'Orchidée et Ivoire + Turquoise et Indigo',
    'Pourpre et Ivoire + Turquoise et Ebène'],
  Emeraude: ['Turquoise et Ivoire + Turquoise et Doré', 'Turquoise et Ivoire + Turquoise et Roux', 'Turquoise et Ivoire + Amande et Ivoire',
    'Turquoise et Ivoire + Doré et Ivoire', 'Turquoise et Ivoire + Turquoise et Amande', 'Turquoise et Amande + Roux et Ivoire',
    'Turquoise et Amande + Doré et Ivoire', 'Doré et Ivoire + Turquoise et Roux'],
  Ambre: ['Pourpre et Emeraude + Roux et Emeraude', 'Orchidée et Emeraude + Amande et Emeraude', 'Indigo et Emeraude + Ivoire et Emeraude',
    'Ebène et Emeraude + Turquoise et Emeraude', 'Doré et Emeraude + Prune et Emeraude'],
  Corail: ['Prune et Pourpre + Prune et Roux', 'Prune et Orchidée + Prune et Amande', 'Prune et Indigo + Prune et Ivoire',
    'Prune et Ebène + Prune et Turquoise', 'Prune et Doré + Prune et Emeraude'],
  Azur: ['Pourpre et Emeraude + Prune et Roux', 'Orchidée et Emeraude + Prune et Amande', 'Indigo et Emeraude + Prune et Ivoire',
    'Ebène et Emeraude + Prune et Turquoise', 'Doré et Emeraude + Prune et Ivoire'],
  'Aigue-marine': ['Prune et Pourpre + Roux et Emeraude', 'Prune et Orchidée + Amande et Emeraude', 'Prune et Indigo + Ivoire et Emeraude',
    'Prune et Ebène + Turquoise et Emeraude', 'Prune et Doré + Turquoise et Emeraude'],
};

const VOLKORNE: Brut = {
  Roux: ['Pourpre et Orchidée + Pourpre et Indigo', 'Pourpre et Orchidée + Pourpre et Ebène', 'Pourpre et Ebène + Pourpre et Indigo'],
  Amande: ['Pourpre et Ebène + Orchidée et Ebène', 'Pourpre et Ebène + Indigo et Ebène', 'Indigo et Ebène + Orchidée et Ebène'],
  Ivoire: ['Pourpre et Indigo + Indigo et Ebène', 'Pourpre et Indigo + Orchidée et Indigo', 'Orchidée et Indigo + Indigo et Ebène'],
  Turquoise: ['Pourpre et Orchidée + Orchidée et Ebène', 'Pourpre et Orchidée + Orchidée et Indigo', 'Orchidée et Indigo + Orchidée et Ebène'],
  Prune: ['Amande et Pourpre', 'Amande et Orchidée', 'Amande et Indigo', 'Amande et Ebène', 'Amande et Turquoise', 'Amande et Ivoire',
    'Roux et Pourpre', 'Roux et Orchidée', 'Roux et Indigo', 'Roux et Ebène', 'Roux et Ivoire', 'Roux et Turquoise'].map((x) => `Amande et Roux + ${x}`),
  Emeraude: ['Ivoire et Orchidée', 'Ivoire et Indigo', 'Ivoire et Ebène', 'Ivoire et Pourpre', 'Amande et Ivoire', 'Roux et Ivoire',
    'Roux et Turquoise', 'Turquoise et Orchidée', 'Turquoise et Pourpre', 'Turquoise et Indigo', 'Turquoise et Ebène', 'Amande et Turquoise']
    .map((x) => `Ivoire et Turquoise + ${x}`),
  Doré: ['Prune et Pourpre + Emeraude et Roux', 'Prune et Orchidée + Emeraude et Turquoise', 'Prune et Indigo + Emeraude et Ivoire',
    'Prune et Ebène + Emeraude et Amande', 'Prune et Amande + Emeraude et Ebène', 'Prune et Turquoise + Emeraude et Orchidée',
    'Prune et Roux + Emeraude et Pourpre', 'Prune et Ivoire + Emeraude et Indigo'],
  Jade: ['Doré et Pourpre + Prune et Emeraude', 'Doré et Prune + Doré et Roux'],
  Rubis: ['Doré et Orchidée + Prune et Emeraude', 'Doré et Prune + Doré et Amande'],
  Saphir: ['Doré et Indigo + Prune et Emeraude', 'Doré et Emeraude + Doré et Turquoise'],
  Améthyste: ['Doré et Ebène + Prune et Emeraude', 'Doré et Emeraude + Doré et Ivoire'],
};

/** Recettes jugées douteuses chez DPLN, à vérifier dans l'interface Génétique du jeu. */
export const A_VERIFIER: Partial<Record<Espece, Record<string, string[]>>> = {
  muldo: { Azur: ['Doré et Emeraude + Prune et Ivoire'], 'Aigue-marine': ['Prune et Doré + Turquoise et Emeraude'] },
};

export type Paire = [string, string];
export type RecettesEspece = Record<string, Paire[]>;
/** Recettes modifiées dans les réglages : elles remplacent celles de DPLN, couleur par couleur. */
export type RecettesPerso = Partial<Record<Espece, RecettesEspece>>;

/** Résout « A + B » en noms officiels de l'espèce ; null si une couleur est inconnue. */
export function lirePaire(espece: Espece, txt: string): Paire | null {
  const [a, b] = txt.split('+').map((s) => findColorIn(espece, s.trim()));
  return a && b && a.name !== b.name ? [a.name, b.name] : null;
}

const resoudre = (espece: Espece, brut: Brut): RecettesEspece =>
  Object.fromEntries(Object.entries(brut).map(([c, list]) => [findColorIn(espece, c)?.name ?? c, list.map((t) => lirePaire(espece, t)).filter((p): p is Paire => !!p)]));

/** Recettes de DPLN des monocolores impaires (génération 3 et plus). */
export const RECETTES_DPLN: Partial<Record<Espece, RecettesEspece>> = {
  muldo: resoudre('muldo', MULDO),
  volkorne: resoudre('volkorne', VOLKORNE),
};

/** Nombre de recettes brutes, pour vérifier qu'aucune n'a été perdue à la résolution des noms. */
export const NB_BRUT = { muldo: MULDO, volkorne: VOLKORNE };

/**
 * Toutes les recettes d'une espèce, couleur par couleur : une bicolore donne ses deux monocolores,
 * une monocolore impaire ses couples de bicolores (réglages d'abord, DPLN sinon), une génération 1 rien.
 */
export function recettes(espece: Espece, perso: RecettesPerso = {}): RecettesEspece {
  const out: RecettesEspece = {};
  for (const c of colorsOf(espece)) {
    if (c.parts.length === 2) out[c.name] = [[c.parts[0], c.parts[1]]];
    else if (c.recipe) out[c.name] = [c.recipe];
    else {
      const list = perso[espece]?.[c.name] ?? RECETTES_DPLN[espece]?.[c.name];
      if (list?.length) out[c.name] = list;
    }
  }
  return out;
}

/** Une recette est-elle modifiée par rapport à DPLN ? */
export const estPerso = (perso: RecettesPerso, espece: Espece, couleur: string) => !!perso[espece]?.[couleur];

/** Paires identiques à l'ordre près. */
export const memePaire = (a: Paire, b: Paire) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
