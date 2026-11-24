# Synchronisation métier Supabase — procédure de mise en service

## État actuel
Le client de synchronisation versionné est présent dans supabase-sync.js. Il compare les versions et bloque les collisions au lieu d’écraser les dossiers. Les dossiers et les réglages partagés sont accessibles aux membres de la même entreprise. Les changements de réglages et la gestion des membres sont réservés au responsable, avec vérification côté base et côté serveur.

La synchronisation reste désactivée dans supabase-config.js (syncEnabled: false). Cette procédure doit être validée avant toute activation ou publication.

## Mise en service
1. Faire une copie des données du responsable.
2. Appliquer les migrations 001_business_records.sql, 002_private_company_files.sql puis 003_company_admin_access.sql dans cet ordre.
3. Déployer la fonction Edge supabase/functions/ssp-company-admin/index.ts. La clé de service reste dans les secrets Supabase; ne jamais la copier dans le navigateur ou le dépôt.
4. Vérifier avec deux comptes de la même entreprise que les dossiers sont visibles et modifiables par les deux, que seul le responsable peut modifier les réglages, inviter ou retirer un membre.
5. Vérifier qu’un membre d’une autre entreprise ne peut ni lire ni modifier les dossiers.
6. Après ces vérifications, activer syncEnabled dans supabase-config.js et publier la version validée.

La première synchronisation du responsable importe ses dossiers présents sur son appareil. À la première connexion d’un membre, les données locales anciennes sont gardées dans une copie locale séparée; elles ne sont pas mélangées automatiquement aux données de l’entreprise. Les invitations envoient un e-mail uniquement lorsque le responsable clique sur « Inviter un membre ».

La version ne doit pas être utilisée pour des dossiers clients réels avant la vérification des droits avec plusieurs comptes et la validation de la sauvegarde initiale.

## Limites connues
- Les nouveaux fichiers joints peuvent être transférés vers le bucket privé `ssp-company-files` ; l'affichage et la récupération par URL signée doivent encore être intégrés et testés dans toutes les vues document.
- Les paramètres d'entreprise ne sont pas encore synchronisés.
- La file de reprise est déclenchée par les sauvegardes locales et l'événement réseau ; ce n'est pas encore une file transactionnelle durable IndexedDB.
- Les suppressions sont envoyées avec contrôle de version, mais le traitement des conflits doit être vérifié en conditions réelles.
- Les tests du dépôt ne peuvent pas remplacer les tests réels RLS et multi-comptes.

Ne pas saisir de dossiers clients réels tant que cette procédure n'est pas terminée.
