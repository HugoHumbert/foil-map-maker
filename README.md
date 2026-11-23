# Foil Map Maker

Petit outil web pour créer des maps de **foil partiel** pour les cartes TCG imprimées sur [TCG Printery](https://tcgprintery.com/).

Format attendu par l'imprimeur : une image noir et blanc, **blanc = foil**, **noir = pas de foil**, idéalement en **1630 × 2220 px** (carte 63 × 88 mm + 3 mm de fond perdu).

## Utilisation

**En ligne : https://hugohumbert.github.io/foil-map-maker/**

Ou ouvre `index.html` dans un navigateur (Chrome, Edge, Firefox). Rien à installer, tout tourne en local : les images ne quittent jamais ton ordinateur.

1. **Charger une illustration** : bouton, glisser-déposer ou Ctrl+V.
2. **Régler la génération auto** : source (luminosité, saturation, similarité à une couleur, alpha), seuils min/max, inversion, flou, lissage, épaissir/amincir, nettoyage des petites taches et trous.
3. **Zones** (`Z`) : entoure une partie de l'image pour lui donner ses propres réglages.
4. **Retoucher** : pinceau (`B`), lasso (`L`), remplissage (`G`), baguette magique (`W`) en blanc, noir ou *Auto* (gomme qui revient au calcul). Les retouches sont conservées quand on change les réglages.
5. **Exporter** en PNG noir et blanc pur : taille d'origine, 1630 × 2220 ou personnalisée (avec option pour exporter l'illustration à la même taille).

Les raccourcis sont listés dans le panneau de gauche.
