# Étable — gestion d'élevage de dragodindes

Outil web pour organiser l'élevage sur **Dofus 3.5** : stock des trois espèces par inventaire, croisements vers une couleur cible et achats pour les dragodindes, calculateur de sérénité des enclos, historique annulable, et suivi du brisage des volkornes et des muldos.

Les données restent **dans ton navigateur** : pas de compte, pas de serveur.

## Fonctionnalités

- **Trois espèces** : dragodindes, volkornes et muldos (120 couleurs chacun, d'après Dofus pour les Noobs), avec un onglet par espèce dans Mon étable. La planification des croisements reste réservée aux dragodindes pour l'instant.
- **Inventaire** : une grille pour saisir tout un cheptel d'un coup, ou le recompter. On compte un état à la fois, **fécondes** par défaut (ou fertiles) : la grille part de ce que l'outil connaît, on tape les nouveaux totaux du jeu (total, puis le sexe le moins nombreux ; l'autre se calcule seul), et l'outil applique l'écart dans les deux sens, en une action annulable. Les retraits prennent d'abord les montures sans lignée, puis les plus anciennes. Pour les volkornes et les muldos, une colonne « À briser » (sans sexe) alimente la file de la page Brisage.
- **Mon étable** (accueil) : stock par génération, sexe et couleur, avec ajout et retrait rapides (+/−) et groupes de génération repliables. Chaque monture est **féconde** (prête à s'accoupler) ou **fertile** (en élevage), avec un filtre Toutes / Fécondes / Fertiles et un bouton « → féconde ». L'ajout se fait en féconde par défaut. Le bloc « Accouplements possibles » ne compte que les fécondes ; un clic ouvre une barre pour noter le résultat, et le bébé arrive fertile. Les montures ne sont plus suivies dans les enclos ni par zone de sérénité.
- **Enclos** : un calculateur de sérénité, de 1 à 6 enclos (6 par défaut). Un palier global, réglé une fois, vaut pour tous les enclos. Chaque enclos commence avec une simulation ; « + Simulation » en ajoute jusqu'à 10, la croix en retire une (jamais la dernière). Une simulation, c'est la sérénité lue en jeu, deux visages et un compte à rebours en hh:mm:ss : le visage du même côté que la sérénité donne le temps pour y rester au plus près de 0, l'autre le temps pour passer de l'autre côté. Le jeu avançant par pas de 10 s, les heures sont justes à 10 s près. Sous les cartes : vitesse des paliers et calculateur de niveau.
- **Familiers** (page à part, sans lien avec les montures) : les 140 familiers et montiliers avec leur obtention (coordonnées et offrande à apporter, quête ou monnaie), leurs prérequis et leurs bonus au niveau 1 et au niveau 100, avec une recherche par nom, bonus ou ressource et un filtre par type d'obtention. Le simulateur part du niveau actuel, ajoute des croquettes enrichies (500 XP) et des ressources (XP par unité lue dans la fenêtre « Nourrir », quantité, prix), et donne le niveau atteint, les bonus correspondants et ce qu'il faut pour un niveau visé. Il montre l'XP perdue par l'arrondi du jeu lot par lot, la quantité qui l'évite (par multiples de 4 pour une ressource à 1,25) et un bouton pour ajuster. La bibliothèque de ressources intègre la table de Dofus pour les Noobs (1 103 ressources, relevées avant Dofus 3) ; on peut la compléter en collant une table (nom, XP, quantité pour laquelle cette XP est obtenue). L'outil en tire l'XP par unité (XP ÷ quantité), et taper le nom d'une ressource la remplit. Les valeurs approximatives (1 XP pour 2 à 9 unités, avec leur fourchette) et inconnues (« ? » ou 0) sont signalées « à vérifier en jeu » ; celles qui demandent 10 unités ou plus pour 1 XP sont marquées peu rentables et écartées de la vérification. Une valeur relevée en jeu se note comme vérifiée et n'est plus jamais écrasée par une nouvelle table. Le bloc « Mes ressources » réunit la croquette enrichie et les ressources mises en favori (étoile) : valeur à l'unité en kamas (prix d'achat, ou de revente pour une ressource farmée) avec sa date, kamas par point d'XP (fourchette pour une valeur approximative), quantité et coût pour le niveau visé, tri par rentabilité, prix ou gain d'XP, et « Utiliser » pour l'ajouter au simulateur. Ses réglages restent dans le navigateur.
- **Réglages** : ce que deviennent les parents après un accouplement (« Après l'accouplement »), les prix en kamas (ambre, corne, généton, Animakina, Optimakina par espèce et génération) et la chance de base, et les recettes des muldos et des volkornes.
  - **Règles de destination** : chaque parent suit la première règle qui lui correspond (espèce, monocolore ou bicolore, générations) : à briser, à extraire, à cloner, à vendre ou à garder. Par défaut : génération 1 à briser, muldos et volkornes de génération 2 et plus à extraire, dragodindes à vendre. Le jeu corrige l'impossible : une génération 1 ne s'extrait pas, une dragodinde ne se brise pas.
  - **Recettes** : celles de Dofus pour les Noobs (2026) pour chaque monocolore à partir de la génération 3 (6 pour le Muldo Roux, 12 pour le Volkorne Prune…). On peut en retirer ou en ajouter ; « Rétablir DPLN » annule la modification. Deux recettes douteuses de DPLN sont signalées « à vérifier en jeu ».
- **Couples**, en deux blocs qui ne se mélangent plus :
  - **Muldos et volkornes** : le plan de la session, pour monter en génération. On choisit les monocolores visées (automatiquement : de la génération 3 jusqu'à la génération impaire au-dessus de la plus haute monocolore en stock ; le Roux et l'Amande pour des muldos de génération 1). Le plan atteint d'abord les monocolores possibles tout de suite, puis prépare les bicolores des recettes visées en quantités égales (en concentrant sur les recettes déjà entamées), puis épuise le stock ; le reste est listé. Chaque lot se valide seul (« Faits… ») : nombre d'accouplements faits, naissances par couleur et par sexe (ou aucune), et les parents partent selon leurs règles de destination. Chaque lot affiche le verdict de l'Optimakina (rentable sous tel prix, ou verdict si son prix est réglé). Quand une moitié de recette attend des partenaires d'un sexe que l'autre n'a pas, le bloc « Sexes à cibler » propose une Animakina sur un nombre précis d'accouplements. Les bébés tombés sous la génération de leurs parents et les reproducteurs reçoivent un nom à leur donner en jeu (« T-Dor-01 », « R-Rou-01 ») et restent dans « À retenir », avec des pistes de partenaires d'après leur généalogie.
  - **À faire maintenant** : les croisements vers la DD visée avec les seules fécondes, sans achat ; le total par couleur avec la barre de résultat et le journal (potions de sexe et de réussite comprises) ; les **sexes à demander** avec la potion de sexe, et leur coût estimé.
  - **À préparer** : le plan d'achats des dragodindes pour un nombre de **places** réglable, en couples complets, à partir de ce qui reste après « À faire maintenant ». Chaque parent est marqué « étable » ou « à acheter » ; « Acheté » ajoute la monture fertile et fait baisser le total d'achats d'exactement 1.
- **À extraire** (en haut de la page Brisage) : les parents que leurs règles envoient à l'extracteur, par espèce et couleur, avec les ressources attendues (une par génération). « Extraites » vide la file, en une action annulable.
- **Brisage** : file « à briser » remplie par l'inventaire (« Tout briser » pré-remplit la session et la vide), sessions de brisage de volkornes et de muldos (date, niveau, montures, runes obtenues), avec le taux « 1 Ga PA (ou Ga PM) toutes les N montures », le rendement de chaque rune par niveau et des graphes d'évolution.
  - **Runes** : les 105 runes de forgemagie du jeu sont connues (relevées sur l'API dofusdude) ; on en ajoute une à la session en cherchant son nom (« vi », « ré per air »).
  - **Prix et valeur** : un prix par rune (en kamas) donne la valeur de chaque session et sa valeur par monture brisée, en signalant les runes sans prix.
  - **Objectif** : « obtenir N runes » d'un type donne le nombre de montures à briser au rendement mesuré (tous niveaux ou un niveau), avec une fourchette à 95 % et la mention « estimation fragile » sous 5 runes obtenues.
- **Historique** : chaque action (ajout, retrait, achat, accouplement, inventaire, import, effacement) est enregistrée et **annulable**. Au-delà d'environ 2 Mo, les actions les plus anciennes restent lisibles mais ne sont plus annulables, pour ne jamais saturer le cache.
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
  domain/        logique métier, sans React
    colors.ts      couleurs des 3 espèces, croisements des dragodindes, ratios d'arbre
    plan.ts        croisements « maintenant », plan d'achats d'un cycle, génération suivante
    sexPlan.ts     sexes à imposer pour former les couples suivants
    stock.ts       comptage, lignée, choix des parents
    temps.ts       simulation de sérénité par pas de 10 s, calculateur de niveau
    recettes.ts    recettes DPLN des muldos et volkornes, recettes modifiées
    destinations.ts  règles de destination des parents, files à briser et à extraire
    planGeneration.ts  plan d'accouplement par génération des muldos et volkornes
    conseils.ts    Optimakina, sexes à cibler, montures à tester, noms en jeu
    runesData.ts   les 105 runes de forgemagie du jeu
    familiers.ts, familiersData.ts  familiers : obtention, bonus par niveau, table d'XP, simulateur
    ressourcesFamiliers.ts  XP donnée aux familiers par ressource (table DPLN)
    brisage.ts     runes par espèce, rendements et séries pour les graphes
    types.ts
  store/         état de l'application
    transitions.ts actions, annulation, import : fonctions pures, testées seules
    EtableContext  branche les transitions sur React (sauvegarde, notifications)
    storage.ts     cache du navigateur, sauvegarde, historique plafonné
    prefs.ts       préférences d'affichage (filtres, groupes repliés)
  components/
    etable/        Mon étable : ajout, stock, inventaire, zones, génération suivante
    enclos/        Enclos : calculateur de sérénité, vitesse des paliers, calculateur de niveau
    couples/       Couples : « À faire maintenant » et « À préparer »
```

La logique métier (`src/domain`) et les transitions d’état (`src/store/transitions.ts`) sont testées indépendamment de l’interface. Le stockage est isolé dans `src/store/storage.ts`, pour pouvoir le remplacer plus tard sans toucher au reste.

## Limites connues

- Le niveau des réservoirs n'est pas suivi : le palier global est supposé tenu pendant toute la simulation.
- Le brisage ne distingue que l'espèce et le niveau des montures, pas leur couleur.
- La planification des croisements ne couvre que les **dragodindes**. Celle des volkornes et des muldos (plusieurs croisements possibles par couleur, objectif « monter en génération ») est prévue dans un prochain lot.
- Les probabilités de croisement ne sont pas calculées : l'outil planifie selon les recettes, pas selon les chances affichées en jeu.
- Le calcul ne prévoit pas les bébés à venir : on note les résultats, et le plan se recalcule.
