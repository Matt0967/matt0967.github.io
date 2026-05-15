# Dashboard admin

Le site reste compatible GitHub Pages: il n'y a pas de backend.

## Utilisation

1. Ouvre `admin.html`.
2. Modifie les projets, les compétences ou les langues.
3. Sauvegarde en brouillon local, télécharge `portfolio-data.json`, ou publie directement via l'onglet `Publication`.

## Publication GitHub

L'onglet `Publication` utilise l'API GitHub depuis le navigateur. Il faut un token GitHub personnel avec le droit d'écrire dans le dépôt.

Le fichier `admin.html` n'est pas lié depuis `index.html`, mais il reste public si quelqu'un connaît son URL. La protection réelle est le token GitHub: sans token valide, la page ne peut pas modifier le dépôt.
