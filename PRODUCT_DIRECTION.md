# SMART SYST’M PILOT — Orientation produit

## Objectif

Construire pour l’entreprise SMART SYST’M un logiciel de gestion du bâtiment complet, professionnel et agréable à utiliser, adapté aux métiers de l’électricité, de la GTB et de la GTC. La simplicité concerne les parcours et la présentation, jamais la suppression de fonctions métier utiles.

Le périmètre initial est une seule entreprise avec plusieurs comptes d’équipe. Le responsable gère les accès et réglages ; l’équipe travaille sur les dossiers selon ses droits.

## Principes d’expérience

- Navigation cohérente, recherche globale, filtres et vues utiles.
- Actions fréquentes visibles et accessibles en peu d’étapes.
- Formulaires qui s’adaptent au contexte, préremplissent les données connues et signalent clairement les erreurs.
- Écrans lisibles sur ordinateur, tablette et téléphone, y compris sur chantier.
- Accessibilité, contrastes suffisants, commandes clavier et états vides explicites.
- Notifications utiles, aide contextuelle et raccourcis pour les tâches répétées.
- Identité visuelle bleu nuit et turquoise, qualité premium homogène. La refonte visuelle complète est différée jusqu’à la validation des parcours fonctionnels.

## Fonctions métier et liens entre modules

Conserver et compléter les modules spécialisés : clients et prospects, devis et bibliothèque de prix, chantiers, planning, achats et matériel, dépenses, factures et paiements, documents, rapports, finances et paramètres.

Les parcours doivent éviter les doubles saisies :

- Un client choisi dans un devis fournit automatiquement ses coordonnées.
- Un devis accepté peut devenir un chantier sans ressaisie.
- Un chantier regroupe planning, dépenses, achats et documents.
- Une facture reprend les informations du devis et du chantier associés.
- Les relances peuvent être planifiées et suivies.
- Les indicateurs financiers proviennent des données enregistrées, avec leur période et leur source clairement visibles.

## Méthode obligatoire pour chaque module

1. Décrire les tâches réelles et le parcours utilisateur.
2. Lister les écrans, états vides, erreurs et permissions.
3. Réduire les étapes inutiles et définir les préremplissages.
4. Vérifier les liens avec les autres modules et la synchronisation multi-compte.
5. Développer sans retirer de fonctions métier utiles.
6. Vérifier les parcours sur ordinateur et smartphone, y compris les cas d’erreur.

## Ordre de travail indicatif

1. Fiabilité du socle : connexion, accès par rôle, stockage local et synchronisation partagée.
2. Clients, prospects et recherche globale.
3. Devis, bibliothèque de prix et conversion en chantier.
4. Chantiers, planning, dépenses, achats et documents associés.
5. Facturation, paiements et relances.
6. Finances, rapports, tableaux de bord, paramètres et finition responsive.

L’ordre pourra s’adapter après l’audit de l’état réel de chaque module.

## Publication

La reprise du déploiement Netlify est mise en attente jusqu’au rechargement des crédits. Ne pas changer d’hébergeur pour contourner cette étape sans décision explicite. Tant que la synchronisation n’a pas été vérifiée en ligne entre plusieurs comptes, l’interface ne doit pas présenter les données comme partagées.
