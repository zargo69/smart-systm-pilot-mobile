# Contrôle de version des données

Le fichier `supabase-sync-functions.sql` ajoute deux fonctions côté base :
- `ssp_save_record` : crée ou met à jour une fiche uniquement si sa version correspond à celle attendue.
- `ssp_soft_delete_record` : marque une fiche comme supprimée sans effacer immédiatement son historique.

## À faire dans Supabase

1. Ouvrir SQL Editor dans le projet.
2. Créer une nouvelle requête.
3. Copier le contenu de `supabase-sync-functions.sql`.
4. Exécuter et vérifier le message de réussite.

Ces fonctions utilisent les politiques RLS existantes et exigent un utilisateur authentifié membre de l'entreprise. Elles ne remplacent pas encore le code de synchronisation du navigateur.

Ne pas exécuter de migration de données ni supprimer le stockage local à ce stade.
