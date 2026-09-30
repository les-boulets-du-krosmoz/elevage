# Étable — gestion d'élevage de dragodindes

Outil web pour organiser l'élevage de dragodindes sur **Dofus 3.5** : suivi du stock, croisements à faire vers une couleur cible, liste d'achats pour remplir l'enclos et historique annulable.

Les données restent **dans ton navigateur** : pas de compte, pas de serveur.

## Fonctionnalités

- **Mon enclos** : stock par génération, sexe et couleur, avec ajout et retrait rapides (+/−) et groupes de génération repliables. Le bloc « Accouplements possibles » liste les croisements faisables vers la génération suivante ; un clic ouvre une barre pour noter le résultat.
- **Couples** : à partir de la DD visée et des places libres de l'enclos, l'outil calcule :
  - les DD de génération 1 **à acheter** (un bouton « Acheté » par ligne fait baisser le compteur) ;
  - les **croisements à faire**, répartis selon le ratio de l'arbre de la cible ;
  - le **total des croisements**, avec le journal des accouplements notés.
- **Historique** : chaque action (ajout, retrait, achat, accouplement, import, effacement) est enregistrée et **annulable**.
- **Données** : export et import d'une sauvegarde JSON (fusion ou remplacement).
- Lignée : chaque bébé garde ses parents et grands-parents. Les parents les mieux placés pour la cible sont consommés en priorité.

## Données et sauvegarde

Tout est stocké dans le `localStorage` du navigateur, propre à chaque appareil et à chaque navigateur.

- Vider le cache du navigateur **efface tes données** : exporte régulièrement.
- Pour passer d'un appareil à un autre : **Données → Exporter**, puis **Importer** sur l'autre appareil.
- Si le site est ouvert dans deux onglets, un bandeau prévient et les onglets restent synchronisés.

## Développement

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm run dev        # serveur de développement
npm test           # tests (algorithme de plan, import/export, parcours de l'interface)
npm run build      # build de production dans dist/
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` teste, construit et publie le site sur **GitHub Pages** à chaque push sur `main`.

À faire une seule fois dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.

## Structure

```
src/
  domain/      logique métier, sans React
    colors.ts    les 66 couleurs, recettes, ratios d'arbre
    plan.ts      calcul des achats et croisements d'un cycle d'enclos
    stock.ts     comptage, lignée, choix des parents
    types.ts
  store/       état de l'application et stockage (localStorage)
  components/  pages et composants d'interface
```

La logique métier est isolée dans `src/domain` et testée indépendamment de l'interface. Le stockage est isolé dans `src/store/storage.ts`, pour pouvoir le remplacer plus tard sans toucher au reste.

## Limites connues

- Seules les **dragodindes** sont gérées. Muldos et volkornes ont leurs propres couleurs et recettes : leur ajout demandera de revoir l'algorithme d'achat (10 bicolores de génération 2 chez les muldos contre 3 ici).
- Les probabilités de croisement ne sont pas calculées : l'outil planifie selon les recettes, pas selon les chances affichées en jeu.
- Le calcul ne prévoit pas les bébés à venir : on note les résultats, et le plan se recalcule.
