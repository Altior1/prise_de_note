# Sprint 1 - MVP Application de Prise de Note (Electron)

Date de creation: 2026-03-27
Owner: Product Owner

## 1. Objectif du sprint
Livrer un MVP desktop utilisable avec:
- CRUD de notes (creer, lire, modifier, supprimer)
- Persistance locale fiable
- Recherche texte simple
- Autosave
- Gestion d erreurs basique

## 2. Perimetre fonctionnel
Inclus dans ce sprint:
- Architecture Electron (main, preload, renderer)
- Ecran liste + detail des notes
- Actions CRUD
- Recherche (titre + contenu)
- Confirmation suppression
- Etat vide + messages d erreur

Hors perimetre (sprint suivant):
- Tags
- Import/Export
- Theming avance
- Sync cloud

## 3. Backlog Sprint 1 (tickets <= 0.5 jour)

## J1
- S1-T01 (P0) Initialiser fenetre Electron securisee
  - Couche: main
  - Acceptance: contextIsolation=true, nodeIntegration=false, preload charge

- S1-T02 (P0) Exposer API preload minimale
  - Couche: preload
  - Acceptance: API notes whitelistee uniquement

- S1-T03 (P0) Definir modele Note + validation simple
  - Couche: main
  - Acceptance: donnees invalides rejetees avec message

## J2
- S1-T04 (P0) Service stockage JSON local (read/write)
  - Couche: main
  - Acceptance: les notes sont conservees apres redemarrage

- S1-T05 (P0) IPC getAll/create
  - Couche: main + preload
  - Acceptance: getAll/create renvoient un resultat coherent

- S1-T06 (P0) IPC update/delete
  - Couche: main + preload
  - Acceptance: update/delete persistent correctement

## J3
- S1-T07 (P0) UI liste des notes
  - Couche: renderer
  - Acceptance: affichage titre + date de maj

- S1-T08 (P0) UI detail + edition note
  - Couche: renderer
  - Acceptance: note selectionnee editable

- S1-T09 (P0) Creation nouvelle note depuis UI
  - Couche: renderer + preload
  - Acceptance: nouvelle note creee et selectionnee

## J4
- S1-T10 (P0) Suppression avec confirmation
  - Couche: renderer + preload
  - Acceptance: suppression confirmee retire la note partout

- S1-T11 (P0) Recherche texte (titre + contenu)
  - Couche: renderer
  - Acceptance: filtrage en temps reel

- S1-T12 (P0) Autosave avec debounce
  - Couche: renderer + preload + main
  - Acceptance: sauvegarde auto apres 700ms d inactivite

## J5
- S1-T13 (P0) Gestion d erreurs UI (toast/alerte)
  - Couche: renderer
  - Acceptance: message clair si erreur IPC/stockage

- S1-T14 (P0) Etat vide + onboarding minimal
  - Couche: renderer
  - Acceptance: si 0 note, UI guide la creation

- S1-T15 (P0) Recette manuelle MVP + correctifs rapides
  - Couche: transverse
  - Acceptance: aucun bug bloquant restant

## 4. Dependances
- T01/T02 avant la majorite du renderer
- T04 avant T05/T06
- T05/T06 avant T09/T10/T12
- T07/T08 avant T11

## 5. Risques et mitigation
- Risque: corruption du JSON local
  - Mitigation: ecriture atomique + backup temporaire

- Risque: IPC trop permissif
  - Mitigation: canaux limites + payload valide

- Risque: regression UI sur autosave
  - Mitigation: tests manuels cibles sur edition rapide

## 6. Definition of Done (Sprint)
- Tous les criteres d acceptance des tickets P0 sont verifies
- Pas de regression evidente sur le flux principal
- Verification manuelle completee
- Notes de version minimales ajoutees

## 7. Checklist de validation manuelle
- Creer une note
- Modifier la note
- Fermer/reouvrir l app et verifier la persistance
- Rechercher un mot present et absent
- Supprimer une note avec confirmation
- Verifier l etat vide quand il n y a plus de note
- Verifier affichage d erreur si operation echoue
