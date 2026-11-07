# Carte et recherche d’adresses gratuites

Smart syst’m Pilot utilise MapLibre GL JS pour afficher les cartes vectorielles publiques d’OpenFreeMap, et Nominatim pour chercher une adresse. Aucun compte, clé API ou paiement n’est demandé. OpenFreeMap annonce un usage commercial autorisé et une instance publique sans limite publiée, mais le service est fourni sans garantie de disponibilité ; ses conditions peuvent changer.

## Utiliser la recherche

Dans une fiche client ou chantier, saisissez une adresse suffisamment précise, puis cliquez sur **Rechercher l’adresse**. Choisissez l’un des résultats pour remplir l’adresse, la ville, le code postal si disponible et les coordonnées GPS. Enregistrez la fiche pour garder les informations dans le stockage local du navigateur.

La recherche est déclenchée par une action explicite : l’autocomplétion à chaque frappe n’est pas autorisée par le service public Nominatim. Les résultats sélectionnés sont mis en cache localement. Les demandes envoyées par cette application doivent rester très modérées et ne jamais dépasser une requête par seconde pour l’ensemble du site. Une recherche envoie le texte de l’adresse au service configuré. Dans **Paramètres → Réglage avancé du service de recherche d’adresse**, l’adresse HTTPS du fournisseur peut être remplacée par celle d’un service compatible Nominatim, sans modifier le code.

## Utiliser la carte

Dans **Carte**, choisissez **Afficher la carte** puis confirmez. La carte est rendue par MapLibre à partir des données vectorielles d’OpenFreeMap. Le fournisseur reçoit la zone affichée ; les noms, clients et détails des fiches ne sont pas transmis avec les marqueurs. L’attribution affiche OpenFreeMap, OpenMapTiles et OpenStreetMap.

Les fournisseurs publics sont gratuits, sans engagement de disponibilité ; OpenFreeMap indique que son instance peut être interrompue à tout moment. Nominatim interdit l’autocomplétion et impose une limite absolue d’une demande par seconde pour l’application. Si le volume devient important, configurez dans **Paramètres → Réglage avancé** un fournisseur Nominatim-compatible qui autorise cet usage. Il n’y a pas de téléchargement hors connexion ni de préchargement de zones.

Consultez les [conditions d’utilisation Nominatim](https://operations.osmfoundation.org/policies/nominatim/), les [conditions d’OpenFreeMap](https://openfreemap.org/tos/), son [guide d’intégration](https://openfreemap.org/quick_start/) et les [informations de licence OpenStreetMap](https://www.openstreetmap.org/copyright).
