# Sprint 3 - Board Kanban (Refonte UX/UI Obsidian-like)

Date: 2026-04-21
Sprint goal: aligner l UI sur un editeur de notes desktop moderne (sidebar collee au bord, creation instantanee via +, parametres caches derriere engrenage, chrome minimal, icones SVG inline). Sprint front uniquement.

## To Do
- [ ] S3-T18 Format relatif il y a X min si ecart < 60 min (renderer)

## In Progress
- [ ] Aucun ticket en cours

## Done
- [x] S3-T01 Creer vue/style/tokens.css palette espacements typographie (renderer)
- [x] S3-T02 Decision produit theme clair Sprint 3 (docs)
- [x] S3-T03 Module vue/script/icons.js avec 8 icones heroicons inline (renderer)
- [x] S3-T04 Helper renderIcon dans icons.js (renderer)
- [x] S3-T05 Restructurer accueil.html en sidebar + panneau principal (renderer)
- [x] S3-T06 Styles sidebar collee au bord vue/style/sidebar.css (renderer)
- [x] S3-T07 Styles panneau detail pleine hauteur vue/style/detail.css (renderer)
- [x] S3-T08 Retirer le note-form et ses enfants (renderer + tests)
- [x] S3-T09 Bouton + dans la sidebar cree une note vide instantanee (renderer)
- [x] S3-T10 Selection remplit detail deselection cache panneau (renderer)
- [x] S3-T11 Adapter tests jsdom au nouveau flow de creation (tests)
- [x] S3-T12 Drawer Parametres ouverte par icone engrenage (renderer)
- [x] S3-T13 Retirer la carte Parametres toujours visible (renderer)
- [x] S3-T14 Restyle onboarding coherent + astuce sync (renderer)
- [x] S3-T15 Cacher visuellement detail-save en preservant le DOM (renderer)
- [x] S3-T16 Isoler Supprimer en coin bas avec icone trash (renderer)
- [x] S3-T17 Reformuler save-indicator en format court HH:MM (renderer)
- [x] S3-T19 Recette manuelle Sprint 3 + correctifs (transverse)
- [x] S3-T20 Mise a jour README + backlog + kanban (docs)
- [x] S3-T21 Raccourcis clavier Ctrl+N et Ctrl+F (renderer)

## Regles de passage entre colonnes
- To Do -> In Progress: ticket clair, dependances levees, acceptance connue, ids DOM touches listes
- In Progress -> Done: acceptance verifiee, tests Jest verts, test manuel fait, pas de regression evidente

## Capacite/Jour proposee
- J1: S3-T01, S3-T02, S3-T03, S3-T04
- J2: S3-T05, S3-T06, S3-T07, S3-T08
- J3: S3-T09, S3-T10, S3-T11
- J4: S3-T12, S3-T13, S3-T14
- J5: S3-T15, S3-T16, S3-T17, S3-T18
- J6: S3-T19, S3-T20, S3-T21

## Dependances critiques
- S3-T01/S3-T02 avant S3-T05/S3-T06/S3-T07
- S3-T03 avant S3-T05/S3-T09/S3-T12/S3-T14/S3-T16
- S3-T05 avant S3-T06/S3-T07
- S3-T08 avant S3-T09/S3-T11
- S3-T09 avant S3-T11
- S3-T12 avant S3-T13
- S3-T01 a S3-T17 avant S3-T19

## Priorites
- P0: S3-T01, S3-T02, S3-T03, S3-T05, S3-T06, S3-T07, S3-T08, S3-T09, S3-T10, S3-T11, S3-T12, S3-T13, S3-T14, S3-T15, S3-T16, S3-T17, S3-T19, S3-T20
- P1: S3-T04, S3-T18, S3-T21

## Notes de scope
- Sprint front uniquement: main.js et preload.js ne bougent pas.
- Reporte au Sprint 4: S2-T04 (externes lecture seule), S2-T04b (adopter), S2-T05 (modale migration). Leurs acceptances seront revisitees pour coller a la nouvelle UI.
- Exclus: theme sombre (Sprint 5 si demande), sidebar resizable/collapsible, mono editeur, markdown rendering.

## Notes de cloture
- 69 tests Jest verts (`npm test`).
- S3-T18 (format relatif "il y a X min") reste en To Do : livrable differe faute de valeur immediate, reevaluable au Sprint 5.
- Raccourcis Ctrl+N / Ctrl+F livres avec tests jsdom dedies.
