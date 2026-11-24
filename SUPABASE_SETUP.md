# Connexion Supabase — préparation

Ces fichiers préparent la connexion du navigateur au projet Supabase.

- `supabase-config.js` contient uniquement le Project URL et la publishable key.
- `supabase-client.js` initialise le client Supabase JS v2 si la bibliothèque est chargée.

## État

L'authentification Supabase est chargée par `index.html` sur cette branche. La connexion et la récupération du mot de passe sont gérées par `auth-supabase.js`. En revanche, les données métier continuent d'être enregistrées dans le navigateur : aucune synchronisation distante ni migration automatique n'est encore activée.

## Sécurité

Ne jamais ajouter une clé `sb_secret_*` ou `service_role` au dépôt ou au navigateur.
Les tables doivent rester protégées par RLS. Avant l'activation, les politiques devront être revues et testées, puis l'authentification, l'isolation par entreprise, la migration et la synchronisation hors ligne devront être implémentées.
