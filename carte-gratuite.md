# Carte et recherche d’adresses gratuites

Smart syst’m Pilot utilise MapLibre GL JS. Le plan de rue repose sur OpenFreeMap et les données OpenStreetMap. En France, la seconde couche propose les orthophotographies IGN BD ORTHO via la Géoplateforme, sans compte ni clé API. Les images aériennes sont à haute résolution (généralement 20 cm) ; leur date de prise de vue et leur couverture varient selon le territoire. Ce sont des photographies aériennes, pas une imagerie satellite récente. La BD ORTHO est diffusée sous Licence Ouverte Etalab 2.0 pour tous usages, y compris professionnels. La Géoplateforme documente l’URL WMTS publique.

Les services publics ne garantissent pas une disponibilité continue. L’application ne télécharge pas les fonds hors connexion.

## Rechercher une adresse

Dans une fiche client ou chantier, saisissez une adresse suffisamment précise, puis cliquez sur **Rechercher l’adresse**. Choisissez un résultat pour compléter l’adresse et les coordonnées GPS. La recherche n’est pas envoyée à chaque frappe : Nominatim impose une utilisation modérée et une limite d’une requête par seconde pour l’application. Les résultats sélectionnés sont mis en cache localement.

## Afficher la carte

Dans **Carte**, choisissez **Afficher la carte**, puis autorisez le chargement. Sélectionnez **Plan de rue** ou **Vue aérienne IGN**. L’imagerie IGN est disponible en France ; la date précise de prise de vue dépend de la zone et peut être consultée dans les informations de l’IGN. Le plan OpenFreeMap peut couvrir d’autres zones, selon la disponibilité de son service public.

Le fournisseur actif reçoit la zone cartographique consultée. Les noms des clients, les noms des chantiers et les détails des fiches restent dans l’application et ne sont pas envoyés avec les marqueurs. L’attribution s’adapte au fond actif : OpenFreeMap / OpenMapTiles / OpenStreetMap ou IGN BD ORTHO.

## Sources et conditions

- [IGN — BD ORTHO, documentation produit](https://geoservices.ign.fr/bdortho)
- [IGN — service WMTS de la Géoplateforme](https://github.com/IGNF/cartes.gouv.fr-documentation/blob/main/content/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/diffusion/wmts.md)
- [Dates de prise de vue actuellement diffusées par l’IGN](https://www.geoportail.gouv.fr/depot/fiches/photographies-aeriennes-RVB/geoportail_dates_des_prises_de_vues_aeriennes-RVB.pdf)
- [Politique d’utilisation du service Nominatim](https://operations.osmfoundation.org/policies/nominatim/)
- [Conditions OpenFreeMap](https://openfreemap.org/tos/)
- [Attribution et licence des données OpenStreetMap](https://www.openstreetmap.org/copyright)
