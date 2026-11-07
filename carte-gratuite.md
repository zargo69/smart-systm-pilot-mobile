# Carte et recherche d’adresses gratuites

Smart syst’m Pilot utilise Leaflet pour afficher les tuiles OpenStreetMap et Nominatim pour chercher une adresse. Aucun compte Google, clé API ou paiement n’est demandé.

## Utiliser la recherche

Dans une fiche client ou chantier, saisissez une adresse suffisamment précise, puis cliquez sur **Rechercher l’adresse**. Choisissez l’un des résultats pour remplir l’adresse, la ville, le code postal si disponible et les coordonnées GPS. Enregistrez la fiche pour garder les informations dans le stockage local du navigateur.

La recherche est déclenchée par une action explicite : l’autocomplétion à chaque frappe n’est pas autorisée par le service public Nominatim. Les résultats sélectionnés sont mis en cache localement. Les demandes envoyées par cette application doivent rester très modérées et ne jamais dépasser une requête par seconde pour l’ensemble du site. Une recherche envoie le texte de l’adresse au service configuré. Dans **Paramètres → Réglage avancé du service de recherche d’adresse**, l’adresse HTTPS du fournisseur peut être remplacée par celle d’un service compatible Nominatim, sans modifier le code.

## Utiliser la carte

Dans **Carte**, choisissez **Afficher la carte** puis confirmez. Seules les tuiles visibles sont chargées ; OpenStreetMap reçoit la zone affichée. Les noms, clients et détails des fiches ne sont pas transmis avec les marqueurs.

Les services publics sont gratuits et financés par la communauté, avec une capacité limitée, sans engagement de disponibilité. Ils peuvent limiter ou bloquer un usage excessif. Il n’y a pas de téléchargement hors connexion ni de préchargement de zones. Si l’application est utilisée par beaucoup de personnes ou pour un usage intensif, il faudra choisir un fournisseur de géocodage/cartes avec des conditions adaptées, qui peut être payant, ou héberger le service soi-même.

Consultez les [conditions d’utilisation Nominatim](https://operations.osmfoundation.org/policies/nominatim/), la [politique des tuiles OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/) et les [informations de licence OpenStreetMap](https://www.openstreetmap.org/copyright).
