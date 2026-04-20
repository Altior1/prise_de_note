# Sprint 1 - Board Kanban (MVP Electron)

Date: 2026-03-27
Sprint goal: livrer un MVP utilisable avec CRUD, persistance locale, recherche, autosave, et gestion d erreurs basique.

## To Do
- [ ] S1-T01 Initialiser fenetre Electron securisee (main)
- [ ] S1-T02 Exposer API preload minimale (preload)
- [ ] S1-T03 Definir modele Note + validation simple (main)
- [ ] S1-T04 Service stockage JSON local read/write (main)
- [ ] S1-T05 IPC getAll/create (main + preload)
- [ ] S1-T06 IPC update/delete (main + preload)
- [ ] S1-T07 UI liste des notes (renderer)
- [ ] S1-T08 UI detail + edition note (renderer)
- [ ] S1-T09 Creation nouvelle note depuis UI (renderer + preload)
- [ ] S1-T10 Suppression avec confirmation (renderer + preload)
- [ ] S1-T11 Recherche texte titre + contenu (renderer)
- [ ] S1-T12 Autosave avec debounce (renderer + preload + main)
- [ ] S1-T13 Gestion d erreurs UI toast/alerte (renderer)
- [ ] S1-T14 Etat vide + onboarding minimal (renderer)
- [ ] S1-T15 Recette manuelle MVP + correctifs rapides (transverse)

## In Progress
- [ ] Aucun ticket en cours

## Done
- [ ] Aucun ticket termine

## Regles de passage entre colonnes
- To Do -> In Progress: ticket clair, dependances levees, acceptance connue
- In Progress -> Done: acceptance verifiee, test manuel fait, pas de regression evidente

## Capacite/Jour proposee
- J1: S1-T01, S1-T02, S1-T03
- J2: S1-T04, S1-T05, S1-T06
- J3: S1-T07, S1-T08, S1-T09
- J4: S1-T10, S1-T11, S1-T12
- J5: S1-T13, S1-T14, S1-T15

## Dependances critiques
- S1-T01/S1-T02 avant la majorite du renderer
- S1-T04 avant S1-T05/S1-T06
- S1-T05/S1-T06 avant S1-T09/S1-T10/S1-T12
- S1-T07/S1-T08 avant S1-T11
