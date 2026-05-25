# Dashboard admin

Le site reste compatible GitHub Pages: il n'y a pas de backend.

## Utilisation

1. Ouvre `admin.html`.
2. Modifie les projets, les compétences, les centres d'intérêt, les formations ou les langues.
3. Dans `Contact`, colle l'URL publique de ton formulaire Notion.
4. Sauvegarde en brouillon local, télécharge `portfolio-data.json`, ou publie directement via l'onglet `Publication`.

## Contact Notion

Le formulaire de contact utilise une URL de formulaire Notion public. Ne mets pas de token Notion dans le site: avec GitHub Pages, il serait exposé côté navigateur.

Dans Notion, crée un formulaire relié à la base où tu veux recevoir tes demandes, puis règle le partage sur `Anyone on the web with link`. Copie l'URL du formulaire dans l'onglet `Contact` du dashboard.

## Publication GitHub

L'onglet `Publication` utilise l'API GitHub depuis le navigateur. Il faut un token GitHub personnel avec le droit d'écrire dans le dépôt.

Le fichier `admin.html` n'est pas lié depuis `index.html`, mais il reste public si quelqu'un connaît son URL. La protection réelle est le token GitHub: sans token valide, la page ne peut pas modifier le dépôt.
