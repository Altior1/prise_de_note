# Sprint 2 - Board Kanban (Dossier de notes personnalisable)

Date: 2026-04-21
Sprint goal: permettre a l utilisateur de choisir son dossier de notes (OneDrive, Dropbox, local), avec onboarding bloquant, hot-swap, tolerance aux fichiers invalides et gestion des `.md` externes.

## To Do
- [ ] S2-T01 Module lib/settings.js readSettings/writeSettings + schema (main)
- [ ] S2-T01b Tests unitaires lib/settings.js (tests)
- [ ] S2-T01c Tolerance .md invalides dans notes-storage.list (main)
- [ ] S2-T01d Tests unitaires tolerance .md invalides (tests)
- [ ] S2-T02 Cablage main: boot settings + holder storage + preload (main + preload)
- [ ] S2-T02b Canaux IPC settings:getNotesDir et settings:openNotesDir (main + preload)
- [ ] S2-T03 Ecran onboarding bloquant si notesDir absent (renderer)
- [ ] S2-T03b UI Parametres dans accueil.html (renderer)
- [ ] S2-T03c IPC settings:pickNotesDir + setNotesDir + hot-swap (main + preload + renderer)
- [ ] S2-T03d Test jsdom onboarding + UI Parametres (tests)
- [ ] S2-T04 Affichage .md externes en lecture seule (main + renderer)
- [ ] S2-T04b Bouton Adopter dans mes notes (main + renderer + preload)
- [ ] S2-T05 Modale de migration Adopter/Copier/Annuler (main + renderer)
- [ ] S2-T06 Recette manuelle Sprint 2 + correctifs (transverse)
- [ ] S2-T07 Bouton Ouvrir le dossier cable (renderer + preload)
- [ ] S2-T08 Mise a jour README + backlog + kanban (docs)

## In Progress
- [ ] Aucun ticket en cours

## Done
- [ ] Aucun ticket termine

## Regles de passage entre colonnes
- To Do -> In Progress: ticket clair, dependances levees, acceptance connue
- In Progress -> Done: acceptance verifiee, test manuel fait, pas de regression evidente

## Capacite/Jour proposee
- J1: S2-T01, S2-T01b, S2-T01c, S2-T01d
- J2: S2-T02, S2-T02b
- J3: S2-T03, S2-T03b, S2-T03c, S2-T03d
- J4: S2-T04, S2-T04b, S2-T05
- J5: S2-T06, S2-T07, S2-T08

## Dependances critiques
- S2-T01/S2-T01b avant S2-T02
- S2-T01c/S2-T01d avant S2-T04
- S2-T02/S2-T02b avant S2-T03/S2-T03b/S2-T03c
- S2-T03c avant S2-T05
- S2-T04 avant S2-T04b
- S2-T01 a S2-T05 avant S2-T06

## Priorites
- P0: S2-T01, S2-T01b, S2-T01c, S2-T01d, S2-T02, S2-T02b, S2-T03, S2-T03b, S2-T03c, S2-T03d, S2-T04, S2-T04b, S2-T05, S2-T06, S2-T08
- P1: S2-T07
