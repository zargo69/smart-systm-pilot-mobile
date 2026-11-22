# Connexion Supabase — préparation

Ces fichiers préparent la connexion du navigateur au projet Supabase.

- `supabase-config.js` contient uniquement le Project URL et la publishable key.
- `supabase-client.js` initialise le client Supabase JS v2 si la bibliothèque est chargée.

## État

Cette intégration est volontairement **non activée** dans l'application à ce stade :
- aucun script n'est encore ajouté à `index.html`;
- l'authentification locale existante reste inchangée;
- les données continuent d'être enregistrées dans le navigateur;
- aucune migration ni synchronisation automatique n'est lancée.

## Sécurité

Ne jamais ajouter une clé `sb_secret_*` ou `service_role` au dépôt ou au navigateur.
Les tables doivent rester protégées par RLS. Avant l'activation, les politiques devront être revues et testées, puis l'authentification, l'isolation par entreprise, la migration et la synchronisation hors ligne devront être implémentées.
