# Sprint 3 - Refonte UX/UI Obsidian-like (Electron)

Date de creation: 2026-04-21
Owner: Product Owner

## 1. Objectif du sprint
Aligner l apparence et les interactions de l app sur les standards d un editeur de notes desktop moderne (reference: Obsidian, Apple Notes, Notion):
- Layout sidebar collee au bord + panneau editeur pleine hauteur
- Creation instantanee via bouton "+" (suppression du formulaire dedie)
- Parametres caches derriere une icone engrenage
- Chrome minimal, densite accrue, tokens CSS partages
- Jeu d icones SVG inline (heroicons) sans dependance npm
- Pain points UX valides par l utilisateur tous resolus

Sprint front uniquement: `main.js` et `preload.js` ne bougent pas (ou tres marginalement). Les contrats IPC existants sont reutilises tels quels.

## 2. Perimetre fonctionnel

Inclus dans ce sprint:
- Tokens CSS (`vue/style/tokens.css`): couleurs, espacements, typographie, rayons
- Choix du theme tranche: clair uniquement pour Sprint 3 (voir section 8)
- Module `vue/script/icons.js` exportant les icones SVG inline heroicons
- Refonte `accueil.html`: sidebar (recherche + liste + bouton "+" + engrenage) + panneau detail
- Suppression du `<form id="note-form">`; creation via bouton "+"
- Parametres deplaces dans un drawer/modale ouverte par l engrenage
- Onboarding restyle coherent + astuce sync OneDrive/Dropbox
- Suppression isolee: icone trash en bas du panneau detail, confirmation preservee
- Bouton "Enregistrer" cache visuellement mais conserve en DOM pour preserver les tests
- Indicateur "Enregistre" reformule en heure courte (`Enregistre 15:43`) ou relatif
- Tests jsdom adaptes pour les ids supprimes (`#note-form`, `#note-title`, `#note-content`)
- Recette manuelle Sprint 3 axee sur chaque pain point resolu

Hors perimetre (reporte ou exclu explicitement):
- Theme sombre ou switch clair/sombre (reporte Sprint 5 si demande)
- Sidebar resizable au drag ou collapsible (exclu, largeur fixe ~280px)
- Raccourcis clavier (Ctrl+N, Ctrl+F, Ctrl+S) -> P1 en fin de sprint si temps
- Affichage `.md` externes en lecture seule (S2-T04) -> repris Sprint 4 sur la nouvelle UI
- Modale de migration Adopter/Copier/Annuler (S2-T05) -> repris Sprint 4 sur la nouvelle UI
- Police mono dans l editeur (exclu, sans-serif systeme partout pour rester simple)
- Markdown rendering, images inline, tags, import/export

## 3. Backlog Sprint 3 (tickets <= 0.5 jour)

## J1 - Fondations visuelles
- S3-T01 (P0) Creer `vue/style/tokens.css` (palette, espacements, typographie, rayons)
  - Couche: renderer
  - Acceptance: tokens `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-danger`, `--spacing-xs/sm/md/lg/xl`, `--radius-sm/md`, `--font-size-sm/base`, `--font-family-ui`; fichier importe en tete de `accueil.css`; aucune valeur magique hex ou px restante dans les autres CSS

- S3-T02 (P0) Decision produit theme clair Sprint 3
  - Couche: docs
  - Acceptance: decision documentee dans `docs/sprint-3.md` section 8 (deja presente), palette claire inspiree Obsidian Light appliquee dans `tokens.css`, sombre reporte Sprint 5 note en hors perimetre

- S3-T03 (P0) Module `vue/script/icons.js` avec 8 icones heroicons inline
  - Couche: renderer
  - Acceptance: exports nommes `plusIcon`, `trashIcon`, `cogIcon`, `folderIcon`, `searchIcon`, `checkIcon`, `xIcon`, `documentPlusIcon`; chaines SVG copiees depuis heroicons.com (outline 24); commentaire en tete documente la migration future vers `@heroicons/24`; aucune dependance npm ajoutee

- S3-T04 (P1) Helper `renderIcon(container, svgString)` dans `icons.js`
  - Couche: renderer
  - Acceptance: fonction utilitaire qui set `innerHTML` sur un conteneur controle, documente l exception XSS (contenu statique), evite la duplication dans `notes-ui.js`

## J2 - Nouveau layout sidebar + main
- S3-T05 (P0) Restructurer `accueil.html` en sidebar + panneau principal
  - Couche: renderer
  - Acceptance: deux conteneurs top-level `<aside id="sidebar">` et `<main id="app-main">`, plus aucune marge sur `body`, h2 de chrome supprimes, ids preserves: `#notes-list`, `#notes-search`, `#empty-state`, `#search-empty`, `#note-detail`, `#detail-title`, `#detail-content`, `#detail-save`, `#detail-delete`, `#save-indicator`, `#toast-container`, `#onboarding`, `#onboarding-pick`, `#app-main`

- S3-T06 (P0) Styles sidebar collee au bord (`vue/style/sidebar.css`)
  - Couche: renderer
  - Acceptance: sidebar largeur fixe 280px, pleine hauteur, fond `--color-surface`, separateur droit `--color-border`, recherche en haut, liste scrollable au milieu, barre d actions en bas (+, engrenage); aucun `<style>` inline ni `style=`

- S3-T07 (P0) Styles panneau detail pleine hauteur (`vue/style/detail.css`)
  - Couche: renderer
  - Acceptance: panneau occupe 100% largeur restante, pleine hauteur, padding base `--spacing-lg`, champ titre en font plus grande sans bordure visible, textarea contenu pleine hauteur sans bordure, look editeur proche Obsidian

- S3-T08 (P0) Retirer le `<form id="note-form">` et ses enfants
  - Couche: renderer + tests
  - Acceptance: `#note-form`, `#note-title`, `#note-content` supprimes du DOM; tests jsdom qui referencaient ces ids reecrits ou retires; code JS de gestion du submit supprime de `notes-ui.js`; tous les tests restants verts

## J3 - Creation instantanee via "+"
- S3-T09 (P0) Bouton "+" dans la sidebar cree une note vide instantanee
  - Couche: renderer
  - Acceptance: clic sur le bouton (icone `plusIcon`) appelle `window.notes.create({ title: "", content: "" })`, nouvelle note apparait en tete de liste, selectionnee automatiquement, focus place dans `#detail-title`; aucun formulaire intermediaire

- S3-T10 (P0) Selection d une note remplit `#note-detail`, deselection cache le panneau
  - Couche: renderer
  - Acceptance: comportement existant preserve apres suppression du form; si aucune note selectionnee, panneau detail affiche etat vide "Selectionnez ou creez une note"; si liste vide, onboarding ou empty-state dedie visible

- S3-T11 (P0) Adapter tests jsdom au nouveau flow de creation
  - Couche: tests
  - Acceptance: tests qui simulaient `fillForm + submit` remplaces par `click bouton +`, assertions portent sur la presence immediate de la note en liste et le focus dans `#detail-title`; `tests/notes-ui.test.js` toujours vert, compte de tests documente dans le commit

## J4 - Parametres derriere engrenage + onboarding restyle
- S3-T12 (P0) Drawer/modale Parametres ouverte par icone engrenage
  - Couche: renderer
  - Acceptance: bouton engrenage dans la sidebar (`cogIcon`), clic ouvre un overlay centre ou un drawer lateral droit contenant `#settings-panel`, `#settings-notes-dir`, `#settings-change`, `#settings-open`; fermeture via bouton `xIcon` ou clic hors zone; ids preserves pour les tests; styles dans `vue/style/settings.css`

- S3-T13 (P0) Retirer la carte Parametres toujours visible en haut de page
  - Couche: renderer
  - Acceptance: `#settings-panel` deplace dans le drawer, aucun h2 "Parametres" visible par defaut; tests qui verifiaient la presence initiale du panneau adaptes pour l ouvrir via le bouton engrenage avant assertion

- S3-T14 (P0) Restyle onboarding coherent avec le nouveau theme + astuce sync
  - Couche: renderer
  - Acceptance: `#onboarding` plein ecran centre, typographie coherente tokens, phrase d aide "Astuce: choisir un dossier OneDrive ou Dropbox synchronise vos notes entre machines"; bouton `#onboarding-pick` avec icone `folderIcon`; ids preserves

## J5 - Polish panneau detail
- S3-T15 (P0) Cacher visuellement le bouton "Enregistrer" tout en preservant `#detail-save`
  - Couche: renderer
  - Acceptance: `#detail-save` reste dans le DOM avec classe `.visually-hidden` (position absolute, opacity 0, aria-hidden); l autosave reste l unique mode de sauvegarde visible pour l utilisateur; tests qui cliquent sur `#detail-save` toujours verts

- S3-T16 (P0) Isoler "Supprimer" en coin bas avec icone trash + confirmation
  - Couche: renderer
  - Acceptance: `#detail-delete` reformule en bouton icone (`trashIcon`) positionne en bas a droite du panneau detail, libelle accessible via `aria-label="Supprimer la note"`, confirmation native preservee; couleur `--color-danger` au hover uniquement

- S3-T17 (P0) Reformuler `#save-indicator` en format court
  - Couche: renderer
  - Acceptance: affichage `Enregistre HH:MM` (ex `Enregistre 15:43`) au lieu de `Modifiee : JJ/MM/AAAA HH:MM:SS`; mise a jour en temps reel apres autosave; icone `checkIcon` discret a gauche du texte; couleur `--color-text-muted`

- S3-T18 (P1) Format relatif "il y a X min" si ecart < 60 minutes
  - Couche: renderer
  - Acceptance: si ecart entre maintenant et timestamp < 60 min, afficher "il y a X min" (ou "a l instant" si < 1 min), sinon HH:MM; pure fonction testable; 1 test unitaire Jest sur la fonction de formatage

## J6 - Recette + correctifs + docs
- S3-T19 (P0) Recette manuelle Sprint 3 + correctifs
  - Couche: transverse
  - Acceptance: checklist section 7 validee de bout en bout, chaque pain point 1-9 des notes produit coche, aucun bug visuel bloquant, tests Jest verts

- S3-T20 (P0) Mise a jour README + backlog + kanban
  - Couche: docs
  - Acceptance: README decrit la nouvelle UI et mentionne heroicons inline, `docs/sprint-3-kanban.md` a jour avec colonnes finales, note explicite que S2-T04/T04b/T05 seront repris en Sprint 4

- S3-T21 (P1) Raccourcis clavier Ctrl+N (nouvelle note) et Ctrl+F (focus recherche)
  - Couche: renderer
  - Acceptance: Ctrl+N declenche la meme action que le bouton "+", Ctrl+F place le focus dans `#notes-search`; evenements captures au niveau document, compatibles Windows/Linux/macOS (Cmd sur macOS)

## 4. Dependances
- T01/T02 avant T05/T06/T07 (les styles referencent les tokens)
- T03 avant T05/T09/T12/T14/T16 (les ids et boutons utilisent les icones)
- T05 avant T06/T07 (la structure HTML doit exister avant les styles dedies)
- T08 avant T09/T11 (le form doit etre retire avant de cabler le flow "+")
- T09 avant T11 (tests ciblent le nouveau flow)
- T12 avant T13 (le drawer doit exister pour y deplacer le panneau)
- T15/T16/T17 independants entre eux, groupes par jour par coherence
- T01 a T17 avant T19 (recette)

## 5. Risques et mitigation
- Risque: regression sur les 67 tests Jest existants lies au DOM
  - Mitigation: chaque ticket qui touche au DOM liste explicitement les ids touches dans son acceptance; T08 et T11 portent la charge principale de reecriture; run `npm test` apres chaque jour

- Risque: scope creep typique d une refonte UX ("et pendant qu on y est...")
  - Mitigation: section 2 liste les exclusions explicites (drag-resize, collapsibles, sombre, raccourcis en P1, mono, markdown); toute demande hors liste -> Sprint 4 ou plus

- Risque: divergence entre apparence jsdom (ok) et apparence reelle (ratee)
  - Mitigation: recette manuelle obligatoire en J6 avec capture d ecran comparee a Obsidian sur chaque pain point; T19 bloque le sprint tant que non valide visuellement

- Risque: merge avec Sprint 2 J4/J5 repris en Sprint 4
  - Mitigation: noter dans T20 que l acceptance de S2-T04/T04b/T05 devra etre revisitee sur la nouvelle UI (badge "Externe" dans la sidebar, modale de migration cohérente avec le drawer Parametres); ne pas recreer la carte Parametres du vieux layout

- Risque: icones SVG inline cassent si un fichier `icons.js` mal copie-colle
  - Mitigation: helper `renderIcon` centralise l injection, test de fumee jsdom qui verifie que chaque export est une string non vide commencant par `<svg`

- Risque: perte d accessibilite (boutons icone sans label)
  - Mitigation: tous les boutons icone ont un `aria-label` explicite, verifie dans la recette et dans les acceptances T09/T12/T16

- Risque: decision theme clair jugee insuffisante par l utilisateur
  - Mitigation: tokens CSS concus des le depart pour supporter un theme via `data-theme="dark"` sur `<html>`; Sprint 5 n aura qu a ajouter un deuxieme bloc de tokens

## 6. Definition of Done (Sprint)
- Tous les criteres d acceptance des tickets P0 verifies
- Aucune regression sur le flux CRUD Sprint 1 (creer, editer, autosave, supprimer, rechercher)
- Aucune regression sur le flux Sprint 2 (onboarding, parametres, hot-swap dossier)
- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=false` preserves
- Aucun `<style>` inline ni attribut `style=` ajoute
- Aucune nouvelle dependance npm ajoutee
- Tests Jest ESM verts (`--experimental-vm-modules`)
- Verification manuelle Sprint 3 completee (section 7)
- README et kanban a jour
- Ids DOM listes dans la section "Contraintes" du brief tous preserves (sauf `#note-form`, `#note-title`, `#note-content` explicitement supprimes)

## 7. Checklist de validation manuelle
- Lancer l app sur un dossier existant -> sidebar a gauche collee au bord, panneau detail a droite pleine hauteur, aucun h2 de chrome visible
- Cliquer sur "+" -> nouvelle note creee instantanement, focus dans le champ titre, aucune boite de dialogue ni formulaire intermediaire
- Taper un titre, attendre 700ms -> indicateur affiche `Enregistre HH:MM` ou `a l instant`
- Recharger l app -> nouvelle note toujours presente avec son titre
- Cliquer sur l engrenage -> drawer/modale Parametres s ouvre, chemin courant visible, boutons Changer et Ouvrir fonctionnels
- Fermer le drawer via X ou clic hors zone -> panneau detail retrouve le focus
- Creer une 2e note, selectionner la 1ere -> panneau detail reflete le bon contenu
- Supprimer via l icone trash en bas a droite -> confirmation, note retiree partout
- Vider le dossier de notes -> etat vide affiche sans h2 parasite
- Lancer l app avec `settings.json` absent -> onboarding plein ecran restyle, astuce sync visible, bouton avec icone folder fonctionnel
- Verifier qu aucun bouton "Enregistrer" visible nulle part
- Verifier que chaque pain point 1-9 du brief produit est adresse visuellement
- `npm test` vert

## 8. Questions produit tranchees
- Theme: clair uniquement pour Sprint 3. Sombre reporte Sprint 5 si demande utilisateur. Raison: eviter de doubler le travail CSS, tokens concus pour supporter un switch futur via `data-theme`.
- Sidebar: largeur fixe 280px, non resizable. Raison: MVP simple, pas de JS drag a maintenir.
- Sidebar collapsible: non. Raison: l app est desktop, pas de contrainte mobile, ajoute du JS pour peu de valeur.
- Raccourcis clavier: en P1 (T21), implementes si temps en fin de sprint. Raison: nice-to-have, pas un pain point remonte.
- Police editeur: sans-serif systeme uniforme (pas de mono). Raison: simplicite, cohérence, la police mono peut venir en Sprint 5 avec le markdown rendering.
- Icones: heroicons outline 24 inline SVG, copie manuelle depuis heroicons.com, aucune dependance npm. API du module concue pour remplacement futur par `@heroicons/24`.
