# Portail pilote ELIMU

La documentation maître se trouve dans `../MANUEL_COMPLET_SYSTEME.md` dans le projet source.

Ce dossier est la version statique à envoyer dans le dépôt GitHub du portail pilote.

## Publication GitHub Pages

1. Envoyer le contenu de ce dossier à la racine de la branche `main`.
2. Dans **Settings → Pages**, choisir **Deploy from a branch**, branche `main`, dossier `/ (root)`, puis enregistrer.
3. Ouvrir l'adresse Pages du dépôt. La page d'accueil est `index.html`.

## Configuration

L'URL Apps Script par défaut se trouve dans `config.js`. Le numéro du service client se saisit dans **Configuration** et est enregistré dans les propriétés du pilote Apps Script. Le logiciel ELIMU le reçoit lors du contrôle de licence et l'affiche dans sa propre page de contact.

Le portail pilote sert à gérer les installations et les licences. Il ne contient pas les données locales des établissements ni le logiciel ELIMU.

Le registre est relu à l'ouverture, avec le bouton **Actualiser** et automatiquement toutes les 30 secondes lorsque la page est visible et en ligne. Une notification visuelle est affichée lorsqu'une installation passe ou reste dans l'état `EN_ATTENTE` ou `DESACTIVE`; elle est dédupliquée tant que la situation ne change pas.

## Installation sur téléphone

Le portail est une PWA mobile-first. Depuis Chrome ou Edge sur Android, ouvrir l'adresse Pages puis appuyer sur **Installer** ou choisir **Installer l'application** dans le menu du navigateur. Sur iPhone/iPad, ouvrir le menu **Partager**, puis **Sur l'écran d'accueil**. Après installation, ELIMU Control s'ouvre comme une application autonome et son interface s'adapte à l'écran du téléphone. Les appels Apps Script restent en ligne : le mode hors connexion conserve seulement l'interface du portail, sans inventer de données de licences.

## Tester avant publication

Depuis la racine du projet :

```powershell
py -m http.server 5503 --directory "GITHUB_PORTAL_PILOTE"
```

Ouvrir `http://127.0.0.1:5503/`. Vérifier l’URL Apps Script pilote dans **Configuration**, puis vérifier les listes, la recherche, la modification du statut et la révocation. Le logo provient de `assets/elimu-logo.png`.
