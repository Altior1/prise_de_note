# Sprint 2 - Dossier de notes personnalisable (Electron)

Date de creation: 2026-04-21
Owner: Product Owner

## 1. Objectif du sprint
Permettre a l utilisateur de choisir le dossier de stockage de ses notes (OneDrive, Dropbox, dossier local maitrise, etc.) au lieu du dossier cache `%APPDATA%\prise-de-note\notes`:
- Lecture et ecriture d un `settings.json` versionne
- Onboarding bloquant au 1er lancement ou si `notesDir` est null
- UI Parametres pour changer de dossier sans redemarrer l app
- Tolerance aux fichiers `.md` invalides dans le dossier
- Affichage des `.md` externes en lecture seule avec option d adoption
- Modale de migration Adopter/Copier/Annuler quand l ancien dossier contient des notes

## 2. Perimetre fonctionnel
Inclus dans ce sprint:
- Module `lib/settings.js` (readSettings / writeSettings) avec schema `{ schemaVersion: 1, notesDir }`
- Chargement settings au boot du main + holder de storage hot-swappable
- IPC namespace `settings:*` (getNotesDir, pickNotesDir, setNotesDir, openNotesDir)
- Event main->renderer `notes-dir-changed` pour re-list
- Ecran onboarding bloquant tant que `notesDir` est absent
- UI Parametres dans `accueil.html` (chemin courant, Changer, Ouvrir)
- Tolerance `.md` invalides: skip + toast cumule au chargement
- Affichage des `.md` externes en lecture seule + bouton Adopter (copie + id frais)
- Modale de migration (Adopter par defaut / Copier sans ecrasement / Annuler)
- Tests unitaires Jest ESM sur `lib/settings.js` et modifs `lib/notes-storage.js`
- Recette manuelle Sprint 2

Hors perimetre (sprint suivant ou plus tard):
- Vue "correction" listant les fichiers `.md` en erreur (style VSCode merge-conflict) — idee future notee ici
- Option "Deplacer" dans la modale de migration
- Single-instance lock (deux instances ouvertes simultanement)
- Gestion des collisions d id entre machines
- Sync cloud active (on delegue au client OneDrive/Dropbox installe)
- Theming avance, tags, import/export

## 3. Backlog Sprint 2 (tickets <= 0.5 jour)

## J1
- S2-T01 (P0) Module `lib/settings.js` readSettings/writeSettings + schema
  - Couche: main
  - Acceptance: schema `{ schemaVersion: 1, notesDir: string | null }` respecte, readSettings renvoie defauts si fichier absent, writeSettings ecrit atomiquement (`.tmp` + rename), corruption declenche `console.warn` + defauts en memoire sans ecraser le fichier

- S2-T01b (P0) Tests unitaires `lib/settings.js`
  - Couche: tests
  - Acceptance: couverture fichier absent / fichier valide / fichier corrompu / ecriture atomique, execution via `--experimental-vm-modules`

- S2-T01c (P0) Tolerance `.md` invalides dans `notes-storage.list()`
  - Couche: main
  - Acceptance: chaque `parseNote` wrappe en try/catch, retour de `list()` expose `{ notes, invalidFiles }`, aucun throw global si un fichier est casse

- S2-T01d (P0) Tests unitaires tolerance `.md` invalides
  - Couche: tests
  - Acceptance: dossier avec 2 fichiers valides + 1 YAML casse renvoie 2 notes et 1 entree `invalidFiles`

## J2
- S2-T02 (P0) Cablage main: boot settings + holder storage + preload
  - Couche: main + preload
  - Acceptance: lecture `settings.json` au `app.whenReady`, holder `{ current: storage }` initialise si `notesDir` non null, `window.settings` expose via preload avec canaux whiteliste, `contextIsolation=true` et `sandbox=false` preserves

- S2-T02b (P0) Canaux IPC `settings:getNotesDir` et `settings:openNotesDir`
  - Couche: main + preload
  - Acceptance: getNotesDir renvoie la valeur courante (string ou null), openNotesDir utilise `shell.openPath` et ne throw pas si chemin invalide (retourne erreur propre)

## J3
- S2-T03 (P0) Ecran onboarding bloquant si `notesDir` absent
  - Couche: renderer
  - Acceptance: au boot, si getNotesDir renvoie null, UI principale masquee, onboarding affiche bouton "Choisir un dossier", aucune action notes possible tant que non resolu

- S2-T03b (P0) UI Parametres dans `accueil.html`
  - Couche: renderer
  - Acceptance: section Parametres affiche chemin courant, bouton "Changer...", bouton "Ouvrir le dossier", styles dans `vue/style/accueil.css` (aucun `<style>` inline ni `style=`)

- S2-T03c (P0) IPC `settings:pickNotesDir` + `settings:setNotesDir` + hot-swap
  - Couche: main + preload + renderer
  - Acceptance: pickNotesDir ouvre `dialog.showOpenDialog`, setNotesDir valide le dossier (`fs.access W_OK`), swap le holder, persiste via writeSettings, emet `notes-dir-changed`, renderer ferme la note en cours et re-list

- S2-T03d (P0) Test jsdom onboarding + UI Parametres
  - Couche: tests
  - Acceptance: test dans `tests/notes-ui.test.js` (ou fichier dedie) verifie affichage onboarding quand notesDir null et masquage apres selection

## J4
- S2-T04 (P0) Affichage `.md` externes en lecture seule
  - Couche: main + renderer
  - Acceptance: `list()` marque les notes sans `id` ou avec `id` hors format app comme `external: true`, UI affiche badge "Externe" et desactive l edition

- S2-T04b (P0) Bouton "Adopter dans mes notes"
  - Couche: main + renderer + preload
  - Acceptance: clic cree une copie dans le meme dossier avec id frais genere par l app, fichier source non modifie, liste rafraichie

- S2-T05 (P0) Modale de migration Adopter/Copier/Annuler
  - Couche: main + renderer
  - Acceptance: si ancien dossier contient au moins 1 `.md` au changement, modale propose Adopter (defaut) / Copier / Annuler, Copier ne doit jamais ecraser un fichier existant (suffixe ou skip + toast), Annuler restaure l ancien `notesDir`

## J5
- S2-T06 (P0) Recette manuelle Sprint 2 + correctifs
  - Couche: transverse
  - Acceptance: checklist de la section 7 validee de bout en bout, aucun bug bloquant restant

- S2-T07 (P1) Bouton "Ouvrir le dossier" cable
  - Couche: renderer + preload
  - Acceptance: clic declenche `settings:openNotesDir`, ouvre l explorateur sur le dossier courant, toast si erreur

- S2-T08 (P0) Mise a jour README + backlog + kanban
  - Couche: docs
  - Acceptance: README mentionne la feature, `docs/sprint-2-kanban.md` a jour avec colonnes finales, idee future "vue correction" notee

## 4. Dependances
- T01/T01b avant T02 (le main lit les settings au boot)
- T01c/T01d avant T04 (la tolerance `.md` invalides alimente aussi la detection des externes)
- T02/T02b avant T03/T03b/T03c (UI a besoin de l API `window.settings`)
- T03c avant T05 (la modale se declenche sur un changement de dossier)
- T04 avant T04b (detection externe avant adoption)
- T01 a T05 avant T06 (recette)

## 5. Risques et mitigation
- Risque: conflit entre ecriture atomique `.tmp`+rename et clients de sync (OneDrive/Dropbox) qui verrouillent les fichiers
  - Mitigation: retry court sur `EPERM`/`EBUSY` au rename, documenter la limite dans le README

- Risque: dossier reseau deconnecte, IPC qui timeout
  - Mitigation: timeout cote renderer, toast d erreur explicite, l utilisateur peut choisir un autre dossier

- Risque: dossier choisi sans droit d ecriture
  - Mitigation: validation `fs.access W_OK` dans `settings:setNotesDir`, rejet explicite avec message

- Risque: corruption de `settings.json`
  - Mitigation: `console.warn` + defauts en memoire, fichier corrompu jamais ecrase tant que l utilisateur ne declenche pas writeSettings

- Risque: collision d id entre machines via dossier synchronise
  - Mitigation: hors scope, a reevaluer si remonte en support

- Risque: deux instances de l app ouvertes en parallele sur le meme dossier
  - Mitigation: hors scope, a noter dans la section risques produit long terme

- Risque: regression sur le flux CRUD existant
  - Mitigation: recette manuelle Sprint 2 reprend les checks Sprint 1

## 6. Definition of Done (Sprint)
- Tous les criteres d acceptance des tickets P0 sont verifies
- Pas de regression sur le flux CRUD Sprint 1 (creer, editer, autosave, supprimer, rechercher)
- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=false` preserves
- Aucun `<style>` inline ni attribut `style=` ajoute
- Aucune nouvelle dependance npm ajoutee (sauf justification documentee)
- Tests Jest ESM verts (`--experimental-vm-modules`)
- Verification manuelle completee
- README et kanban mis a jour

## 7. Checklist de validation manuelle
- Premier lancement: `settings.json` absent -> onboarding bloquant, choix d un dossier vide -> app fonctionnelle
- Relancer l app -> dossier choisi conserve, liste des notes chargee
- Corrompre `settings.json` manuellement -> `console.warn` visible, onboarding bloquant, fichier non ecrase tant que l utilisateur n a pas change le dossier
- Supprimer manuellement `notesDir` dans `settings.json` (mettre null) -> onboarding bloquant au prochain lancement
- Creer une note, changer de dossier en mode Adopter -> nouvelle liste chargee, ancienne note plus visible
- Changer de dossier en mode Copier, ancien dossier contient 3 notes -> 3 notes copiees dans le nouveau dossier, aucune ecrasee
- Mettre un `.md` externe (frontmatter sans id) dans le dossier -> apparait en lecture seule avec badge, edition desactivee
- Cliquer "Adopter dans mes notes" sur un externe -> copie creee avec id frais, fichier source intact
- Mettre un `.md` avec YAML casse -> skip, toast cumule "1 fichier n a pas pu etre lu"
- Choisir un dossier sans droit d ecriture -> rejet explicite, dossier non change
- Bouton "Ouvrir le dossier" -> explorateur ouvre le bon chemin
- Verifier persistance apres redemarrage sur un dossier OneDrive/Dropbox
