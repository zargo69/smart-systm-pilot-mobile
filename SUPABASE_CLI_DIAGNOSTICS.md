# Diagnostic Supabase en lecture seule

Ce diagnostic fournit un contrôle reproductible sans utiliser le navigateur Cloud. Il interroge uniquement les métadonnées du schéma : présence de la table métier, activation de RLS, fonctions RPC, bucket privé et politiques Storage. Il ne lit aucun dossier, compte ou fichier utilisateur.

## Prérequis

1. Installer la Supabase CLI depuis le [guide officiel d’installation](https://supabase.com/docs/guides/cli/getting-started).
2. Dans le Terminal, lancer `supabase login` et saisir le Personal Access Token directement dans l’invite du CLI. Ne le collez ni dans une conversation, ni dans le dépôt, ni dans un fichier `.env`. La CLI le conserve dans le stockage natif du système quand il est disponible.
3. Depuis la copie locale de cette branche, lancer :

```sh
sh scripts/supabase-diagnose-readonly.sh
```

Pour un autre projet, définir uniquement sa référence publique avant l’appel :

```sh
SUPABASE_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx sh scripts/supabase-diagnose-readonly.sh
```

La valeur par défaut vise le projet SMART SYST’M PILOT. Le script refuse les références qui ne ressemblent pas à une référence de projet Supabase de 20 caractères.

## Garanties et limites

Le script appelle `supabase db query` avec `--read-only` et cible explicitement la référence du projet. La CLI et l’API Supabase rejettent les requêtes qui ne sont pas en lecture seule. Le fichier SQL ne contient qu’une requête `SELECT` sur les catalogues PostgreSQL et les métadonnées du bucket; il n’interroge pas les lignes métier.

Le résultat indique `OK` ou `À vérifier` pour chaque contrôle. Un contrôle manquant ne déclenche aucune réparation. En particulier, ce diagnostic n’exécute pas les migrations, n’active pas la synchronisation, ne modifie aucun paramètre, compte ou utilisateur, n’envoie aucun e-mail et ne déploie rien.

Le Personal Access Token donne accès aux API de gestion autorisées pour le compte. Choisissez les droits les plus limités disponibles et conservez le token uniquement dans le stockage protégé de la CLI. Ne fournissez jamais de clé `sb_secret_*`, `service_role` ou mot de passe de base à l’application, au script, au dépôt ou à Codex.

Pour consulter l’option de lecture seule de `supabase db query`, voir la [référence officielle de la CLI](https://supabase.com/docs/reference/cli/supabase-db-remote#supabase-db-query).
