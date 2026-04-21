# Agents du projet - Prise de note (Electron)

Ce dossier contient 4 agents specialises pour t aider a construire l application.

Stack cible:
- Electron pour le shell desktop
- Vue pour l interface renderer
- JavaScript pour la logique applicative

## 1) Assistant Codeur Notes App
- Fichier: `assistant-codeur.agent.md`
- A utiliser quand: tu veux implementer une fonctionnalite de bout en bout dans Electron (main/preload/renderer).
- Exemple de demande:
  - "Implemente la creation, edition et suppression de notes."
  - "Ajoute une persistance localStorage avec gestion d erreurs."

## 2) Assistant Qualite Notes App
- Fichier: `assistant-qualite.agent.md`
- A utiliser quand: tu veux une revue qualite Electron, trouver des bugs, ou reduire les regressions.
- Exemple de demande:
  - "Fais une revue qualite de main.js."
  - "Propose un refactor minimal sans changer le comportement."

## 3) Assistant Product Owner Notes App
- Fichier: `assistant-product-owner.agent.md`
- A utiliser quand: tu veux transformer une idee en backlog priorise avec decoupage main/preload/renderer.
- Exemple de demande:
  - "Decoupe cette fonctionnalite en user stories + tickets techniques."
  - "Priorise la roadmap MVP en P0/P1/P2."

## 4) Assistant Commentateur Notes App
- Fichier: `assistant-commentateur.agent.md`
- A utiliser quand: tu veux rendre un code existant comprehensible sans toucher a sa logique (passe apres le codeur).
- Exemple de demande:
  - "Commente les fichiers modifies dans le dernier diff."
  - "Ajoute des headers et des commentaires de contrainte dans main.js et preload.js."

## Workflow recommande
1. Product Owner: clarifier le besoin, prioriser, definir acceptance criteria.
2. Codeur: implementer les tickets priorises.
3. Commentateur: ajouter les commentaires "pourquoi" sur le code livre.
4. Qualite: auditer les risques et proposer les corrections finales.

## Conseils pratiques
- Garde des demandes courtes et concretes.
- Donne le contexte du fichier concerne (ex: main.js ou vue/accueil.html).
- Demande toujours un plan de validation a la fin (test manuel ou commande npm).
