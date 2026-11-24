# Connexion et préparation Supabase — SMART SYST'M PILOT

- `supabase-config.js` contient le Project URL et la publishable key, destinée au navigateur.
- `supabase-client.js` initialise Supabase JS v2.
- `auth-supabase.js` gère la connexion et la récupération du mot de passe.
- `company-storage.js` sépare les données locales par entreprise.
- `supabase-sync.js` contient l'adaptateur de synchronisation versionnée.
- Pour contrôler la configuration distante sans navigateur, suivre [le diagnostic CLI en lecture seule](SUPABASE_CLI_DIAGNOSTICS.md).

## Protection des comptes et données
Ne jamais ajouter une clé `sb_secret_*` ou `service_role` au dépôt ou au navigateur. Les tables doivent être protégées par RLS. Les données métier ne doivent pas être utilisées en production tant que la migration SQL, les tests RLS multi-entreprises, la reprise hors ligne et le stockage des pièces jointes ne sont pas validés.

Le stockage local historique `ssp-data` est conservé. Lors de la première connexion, il est attribué au premier espace entreprise qui l'ouvre et copié dans sa clé locale dédiée. Il n'est pas supprimé. Les comptes suivants obtiennent un espace local distinct.

Le rattachement entreprise déjà vérifié est mis en cache par identifiant utilisateur afin de permettre l'ouverture de l'espace local hors ligne après une première connexion en ligne. Ce cache n'accorde aucun accès serveur et ne remplace pas l'authentification.

## Mise en service de la base
Exécuter `supabase-migrations/001_business_records.sql` dans le SQL Editor Supabase. Vérifier la table, les fonctions et les policies. La synchronisation distante reste désactivée par défaut (`syncEnabled: false`) tant que les essais multi-comptes et de conflits ne sont pas validés.

## Limites connues
- Le stockage des fichiers clients dans un bucket privé et les URL signées restent à implémenter.
- La reprise hors ligne locale est possible après une première connexion en ligne, mais la résolution complète des modifications concurrentes hors ligne n'est pas encore certifiée.
- Les documents de devis/factures restent des brouillons : pas de numérotation serveur, de conformité comptable ou d'envoi certifié.
- Les paramètres entreprise et les fichiers binaires ne sont pas encore synchronisés.
- Les tests automatisés du dépôt ne remplacent pas les tests réels Supabase avec deux entreprises et deux appareils.

Ne pas saisir de dossiers clients réels tant que ces contrôles ne sont pas terminés.
