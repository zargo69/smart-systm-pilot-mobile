# Configurer Google Maps pour Smart syst’m Pilot

La carte et la recherche d’adresses Google nécessitent votre propre projet Google Cloud. Aucune clé n’est fournie avec l’application, et elle n’est pas inscrite dans le dépôt public.

1. Dans Google Cloud, créez ou sélectionnez un projet et activez la facturation.
2. Activez **Maps JavaScript API** et **Places API** pour ce projet.
3. Créez une clé API.
4. Dans les restrictions d’application, choisissez **Sites Web / HTTP referrers** et autorisez `https://zargo69.github.io/*`.
5. Dans les restrictions d’API, autorisez seulement **Maps JavaScript API** et **Places API**.
6. Dans Smart syst’m Pilot, ouvrez **Paramètres**, collez la clé dans **Clé API Google Maps**, puis enregistrez. La page se recharge pour utiliser la nouvelle clé.
7. Ouvrez **Clients** ou **Chantiers**, saisissez une adresse, puis choisissez le résultat Google proposé. Les coordonnées sont enregistrées lors du choix.
8. Ouvrez **Carte** et choisissez **Afficher la carte**.

La clé enregistrée est locale au navigateur, mais une clé utilisée par une page Web est visible par les personnes qui chargent cette page. Les restrictions de domaine et d’API sont donc indispensables. Une utilisation de Maps/Places peut entraîner des frais selon les quotas et tarifs Google en vigueur ; vérifiez-les dans Google Cloud avant d’activer un volume important.

Références officielles : [créer et restreindre une clé Google Maps](https://developers.google.com/maps/documentation/places/web-service/get-api-key), [widget de recherche d’adresses Places](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new), [tarification Google Maps Platform](https://developers.google.com/maps/billing-and-pricing/pricing).
