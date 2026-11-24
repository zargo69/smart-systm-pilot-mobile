# Connexion et préparation Supabase — SMART SYST'M PILOT

- `supabase-config.js` contient le Project URL et la publishable key, destinée au navigateur.
- `supabase-client.js` initialise Supabase JS v2.
- `auth-supabase.js` gère la connexion et la récupération du mot de passe.
- `company-storage.js` sépare les données locales par entreprise.
- `supabase-sync.js` contient l'adaptateur de synchronisation versionnée.

## Protection des comptes et données
Ne jamais ajouter une clé `sb_secret_*` ou `service_role` au dépôt ou au navigateur. Les tables doivent être protégées par RLS. Les données métier ne doivent pas être utilisées en production tant que la migration SQL, les tests RLS multi-entreprises, la reprise hors ligne et le stockage des pièces jointes ne sont pas validés.

Le stockage local historique `ssp-data` est conservé. Lors de la première connexion, il est attribué au premier espace entreprise qui l'ouvre et copié dans sa clé locale dédiée. Il n'est pas supprimé. Les comptes suivants obtiennent un espace local distinct.

Le rattachement entreprise déjà vérifié est mis en cache par identifiant utilisateur afin de permettre l'ouverture de l'espace local hors ligne après une première connexion en ligne. Ce cache n'accorde aucun accès serveur et ne remplace pas l'authentification.

## Mise en service de l’espace partagé
La synchronisation reste désactivée dans supabase-config.js tant que les étapes ci-dessous ne sont pas terminées.

1. Vérifier la copie de sauvegarde des données du responsable.
2. Appliquer supabase-migrations/003_company_admin_access.sql dans Supabase après les migrations métier déjà présentes.
3. Déployer la fonction supabase/functions/ssp-company-admin/index.ts. Elle utilise uniquement les secrets serveur Supabase; aucune clé secrète ne doit être ajoutée au dépôt.
4. Contrôler les droits avec deux comptes de la même entreprise : l’équipe lit et modifie les dossiers, seul le responsable change les réglages et les accès.
5. Activer ensuite syncEnabled dans supabase-config.js et publier la version de l’application.

La première synchronisation du responsable importe ses dossiers locaux. Au premier accès d’un membre, ses données locales sont sauvegardées séparément dans le navigateur et ne sont jamais ajoutées silencieusement à l’entreprise. Les collisions bloquent la synchronisation plutôt que d’écraser des données.

## Limites connues
- Le stockage des fichiers clients dans un bucket privé et les URL signées restent à implémenter.
- La reprise hors ligne locale est possible après une première connexion en ligne, mais la résolution complète des modifications concurrentes hors ligne n'est pas encore certifiée.
- Les documents de devis/factures restent des brouillons : pas de numérotation serveur, de conformité comptable ou d'envoi certifié.
- Les réglages de l’entreprise sont synchronisés avec les dossiers lorsque la mise en service est complète.
- Les tests automatisés du dépôt ne remplacent pas les tests réels Supabase avec deux entreprises et deux appareils.

Ne pas saisir de dossiers clients réels tant que ces contrôles ne sont pas terminés.
