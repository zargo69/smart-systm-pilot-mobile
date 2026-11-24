# Synchronisation métier Supabase — procédure de mise en service

## État actuel
Le client de synchronisation versionné est présent dans `supabase-sync.js`. Il utilise les RPC `ssp_save_record` et `ssp_soft_delete_record`, compare les versions et refuse les collisions d'identifiants dont les contenus diffèrent. La synchronisation est volontairement désactivée dans `supabase-config.js` (`syncEnabled: false`) tant que la migration SQL et les tests RLS ne sont pas exécutés. Ne pas activer ce drapeau avant validation.

## Migration
1. Ouvrir le projet Supabase, puis SQL Editor.
2. Ouvrir le fichier `supabase-migrations/001_business_records.sql` dans GitHub.
3. Copier l'intégralité du SQL et l'exécuter dans SQL Editor.
4. Vérifier que l'exécution se termine sans erreur. Le script vérifie la présence de la table, de RLS et des deux fonctions RPC.
5. Dans Table Editor, confirmer que `ssp_app_records` a RLS activé et que les policies sont présentes.

La migration est idempotente dans un schéma conforme et ne supprime aucune donnée. Si une table existante possède une structure différente, arrêter et inspecter le schéma avant de poursuivre.

## Activation contrôlée
Après migration, il faut encore tester avec deux comptes appartenant à deux entreprises différentes :
- lecture et écriture dans sa propre entreprise ;
- impossibilité de lire ou écrire dans l'entreprise voisine ;
- import initial depuis un stockage local vide et non vide ;
- collision d'identifiants avec payload différent : elle doit bloquer sans écrasement ;
- modification concurrente : elle doit remonter un conflit ;
- suppression logique et restauration contrôlée ;
- reprise après perte réseau et redémarrage.

Quand ces tests sont tous réussis, changer `syncEnabled` en `true` dans `supabase-config.js`, puis vérifier le déploiement preview. Ne pas activer sur la production avant validation.

## Limites connues
- Les pièces jointes binaires ne sont pas encore migrées vers un bucket privé Supabase.
- Les paramètres d'entreprise ne sont pas encore synchronisés.
- La file de reprise est déclenchée par les sauvegardes locales et l'événement réseau ; ce n'est pas encore une file transactionnelle durable IndexedDB.
- Les suppressions sont envoyées avec contrôle de version, mais le traitement des conflits doit être vérifié en conditions réelles.
- Les tests du dépôt ne peuvent pas remplacer les tests réels RLS et multi-comptes.

Ne pas saisir de dossiers clients réels tant que cette procédure n'est pas terminée.
