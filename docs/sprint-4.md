# Sprint 4 - Notes externes et migration (Electron)

Date de creation: 2026-04-21
Owner: Product Owner (a affiner au demarrage)

## 1. Objectif du sprint
Reprendre les tickets S2-J4/J5 reportes pour les construire sur la nouvelle UI Obsidian-like livree au Sprint 3:
- Affichage des fichiers `.md` externes (frontmatter sans id ou id hors format app) en lecture seule
- Bouton "Adopter dans mes notes" qui cree une copie avec id frais sans modifier le fichier source
- Modale de migration Adopter/Copier/Annuler au changement de dossier

## 2. Perimetre fonctionnel
Inclus:
- Badge "Externe" sur les notes en lecture seule dans la sidebar
- Blocage edition des notes externes (textarea readonly, bouton supprimer retire)
- Bouton "Adopter" qui copie la note externe dans le dossier avec id genere
- Modale presentee au changement de dossier si l ancien contient au moins un `.md`
- Copie sans ecrasement (suffixe ou skip + rapport)

Hors perimetre (reporte ou exclu):
- Option "Deplacer" dans la modale (reste exclu)
- Edition des `.md` externes avec ajout d id silencieux (explicitement refuse, cf. decision produit)
- Vue "correction" style VSCode merge-conflict pour fichiers invalides

## 3. Tickets a rediger
Le PO redigera le backlog detaille au demarrage du sprint. Pistes:
- S4-T01 Marquage des notes externes dans list() (shape `{ notes, invalidFiles }` etendue avec `external: true`)
- S4-T02 Affichage badge "Externe" dans la sidebar + desactivation edition cote renderer
- S4-T03 Bouton Adopter (cote renderer + IPC + logique de copie cote main)
- S4-T04 Modale Adopter/Copier/Annuler (renderer)
- S4-T05 Copie sans ecrasement (main, logique de suffixage)
- S4-T06 Tests jsdom des nouveaux comportements
- S4-T07 Recette manuelle

## 4. Prerequis
- Sprint 3 T18 valide (recette manuelle de la nouvelle UI OK)
- Backlog Sprint 3 T19 a jour (kanban Sprint 3 clos)

## 5. Risques identifies
- L UX du badge "Externe" dans la sidebar (visibilite sans bruiter la liste)
- Concurrence avec clients de sync (OneDrive) sur la copie "adopter"
- Collision de noms de fichiers lors de la copie

## 6. Definition of Done (a preciser par le PO)
- Tous les P0 livres et testes
- Aucune regression sur le flux CRUD Sprint 1 / dossier configurable Sprint 2 / UI Sprint 3
- Recette manuelle complete
