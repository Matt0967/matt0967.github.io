# Dashboard admin

Le site reste compatible GitHub Pages: il n'y a pas de backend.

## Utilisation

1. Ouvre `admin.html`.
2. Modifie les projets, les statuts, les compétences avec niveaux, les centres d'intérêt, les formations ou les langues.
3. Dans `Contact`, colle l'URL publique de ton formulaire Notion.
4. Dans `Publication`, vérifie l'aperçu avant publication si besoin.
5. Sauvegarde en brouillon local, télécharge `portfolio-data.json`, ou publie directement via l'onglet `Publication`.

## Verrouillage du dashboard

Au premier lancement, `admin.html` demande de créer un mot de passe local. Le mot de passe n'est pas écrit dans le dépôt: le navigateur garde seulement un hash PBKDF2 salé dans `localStorage`, puis l'accès est mémorisé pour l'onglet avec `sessionStorage`.

Limite importante: GitHub Pages reste un hébergement statique. Quelqu'un qui connaît l'URL peut télécharger le HTML, le CSS et le JS. Ce verrouillage bloque l'interface normale dans ton navigateur, mais ne remplace pas un vrai backend avec authentification serveur. La protection réelle contre la modification du portfolio reste le token GitHub, qui ne doit jamais être commité.

## Stats

L'onglet `Stats` lit la GitHub Traffic API avec ton token GitHub. Il affiche les vues et visiteurs uniques disponibles côté GitHub, les clones, les sources de trafic, les pages populaires et une heatmap sur la fenêtre fournie par GitHub.

Limites GitHub: les données de trafic sont limitées aux 14 derniers jours et ne donnent pas une carte géographique temps réel des visiteurs du site. Pour de vraies statistiques web détaillées, il faudrait ajouter un service d'analytics externe compatible avec un site statique.

L'onglet permet aussi de configurer un analytics public optionnel: Plausible, Umami ou GoatCounter. Ne mets jamais de token secret dans ces champs: uniquement un domaine public, un site ID public ou une URL de script publique.

## CV PDF

Le bouton PDF du portfolio utilise l'impression navigateur si aucune URL de PDF n'est renseignée. Dans la fenêtre d'impression, choisis `Enregistrer en PDF`. Si tu préfères un fichier PDF fixe, ajoute son URL dans l'onglet `Publication`.

## Mini terminal et easter eggs

Le lien `Terminal` de la navigation ouvre un terminal côté navigateur dans un nouvel onglet plein écran. Les commandes utiles sont visibles via `help`; certains déclencheurs ouvrent une page cachée full screen dans un nouvel onglet. Tout reste statique et compatible GitHub Pages.

## Contact Notion

Le formulaire de contact utilise une URL de formulaire Notion public. Ne mets pas de token Notion dans le site: avec GitHub Pages, il serait exposé côté navigateur.

Dans Notion, crée un formulaire relié à la base où tu veux recevoir tes demandes, puis règle le partage sur `Anyone on the web with link`. Copie l'URL du formulaire dans l'onglet `Contact` du dashboard.

## Publication GitHub

L'onglet `Publication` utilise l'API GitHub depuis le navigateur. Il faut un token GitHub personnel avec le droit d'écrire dans le dépôt.

Le fichier `admin.html` n'est pas lié depuis `index.html`, mais il reste public si quelqu'un connaît son URL. La protection réelle est le token GitHub: sans token valide, la page ne peut pas modifier le dépôt.
