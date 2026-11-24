# Synchronisation métier Supabase — procédure de mise en service

## État actuel
Le client de synchronisation versionné est présent dans supabase-sync.js. Il compare les versions et bloque les collisions au lieu d’écraser les dossiers. La configuration de la branche feature/supabase-integration active la synchronisation (syncEnabled: true).

L’audit précédent a confirmé l’application de la migration 003 et le déploiement de la fonction Edge. Cela ne remplace pas la vérification bout en bout des migrations, des droits RLS et du partage entre deux comptes. Cette vérification reste à faire avant l’utilisation avec de vrais dossiers. La version publique peut être en retard sur la branche tant que Netlify ne publie pas les changements.

## Mise en service
1. Faire une copie des données du responsable.
2. Appliquer les migrations 001_business_records.sql, 002_private_company_files.sql puis 003_company_admin_access.sql dans cet ordre.
3. Configurer dans Supabase l’URL de retour des invitations et l’autoriser dans les redirections Auth, puis déployer la fonction Edge supabase/functions/ssp-company-admin/index.ts. La clé de service reste dans les secrets Supabase; ne jamais la copier dans le navigateur ou le dépôt.
4. Vérifier avec deux comptes de la même entreprise que les dossiers sont visibles et modifiables par les deux, que seul le responsable peut modifier les réglages, inviter ou retirer un membre.
5. Vérifier qu’un compte non invité ne peut ni lire ni modifier les dossiers.
6. Après ces vérifications, publier la branche validée et confirmer que la version publique reflète bien le code contrôlé. L’activation de syncEnabled est déjà faite dans cette branche.

Le responsable crée le seul espace entreprise lors de sa première connexion; les autres comptes doivent être invités avant leur première connexion. La première synchronisation du responsable importe ses dossiers présents sur son appareil. À la première connexion d’un membre, les données locales anciennes sont gardées dans une copie locale séparée; elles ne sont pas mélangées automatiquement aux données de l’entreprise. Les invitations envoient un e-mail uniquement lorsque le responsable clique sur « Inviter un membre ».

La version ne doit pas être utilisée pour des dossiers clients réels avant la vérification des droits avec plusieurs comptes et la validation de la sauvegarde initiale.

## Limites connues
- Les nouveaux fichiers joints peuvent être transférés vers le bucket privé `ssp-company-files` ; l'affichage et la récupération par URL signée doivent encore être intégrés et testés dans toutes les vues document.
- Les réglages de l’entreprise sont représentés comme un enregistrement partagé ; vérifier leur édition par le responsable et leur lecture par un membre pendant la validation multi-comptes.
- Les changements hors ligne restent dans le stockage local du navigateur. La reprise initialise maintenant la synchronisation au retour du réseau ; une file transactionnelle durable IndexedDB reste à étudier.
- Les suppressions sont envoyées avec contrôle de version, mais le traitement des conflits doit être vérifié en conditions réelles.
- Les tests du dépôt ne peuvent pas remplacer les tests réels RLS et multi-comptes.

Ne pas saisir de dossiers clients réels tant que cette procédure n'est pas terminée.
