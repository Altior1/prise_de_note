// Rendu Markdown sécurisé pour l'affichage des notes.
//
// Pipeline en deux barrières :
//   1. markdown-it avec html:false — interdit tout HTML inline dans la source,
//      empêche un <script> écrit littéralement dans une note de ressortir.
//   2. DOMPurify — purge ce qui aurait pu passer (entités, cas tordus,
//      attributs dangereux type onerror/onload, hrefs javascript:).
//
// Contexte Electron : preload ESM, sandbox:false. Un bug de sanitization dans
// le renderer peut escalader vers l'exécution de code côté Node via les API
// exposées par le preload (window.notes, window.settings). Les deux barrières
// ne sont pas redondantes : html:false seul laisse passer certains cas
// (markdown-it échappe le HTML brut en texte, mais un lien `[x](javascript:…)`
// est du markdown valide — seul DOMPurify le neutralise).
//
// Liste blanche ALLOWED_TAGS : uniquement ce que markdown-it peut produire à
// partir de markdown vanilla. Pas d'iframe/script/style/form/object/embed.
// Si un ticket active une extension markdown-it (émojis custom, footnotes,
// etc.), penser à vérifier que les tags générés sont dans cette liste.
//
// Convention d'export : IIFE qui pose window.AppMarkdown.renderMarkdown, même
// pattern que vue/script/icons.js. Les tests Jest consomment ce fichier via
// fs.readFileSync + injection dans un jsdom où markdownit et DOMPurify sont
// préalablement posés sur window (cf. notes-ui.test.js pour le pattern).

(function () {
  if (!window.markdownit || !window.DOMPurify) {
    console.error(
      "markdown.js : window.markdownit ou window.DOMPurify manquant — vérifier l'ordre des <script> dans accueil.html",
    );
    return;
  }

  const md = window.markdownit({
    html: false,
    linkify: true,
    breaks: false,
  });

  const ALLOWED_TAGS = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "strong",
    "em",
    "del",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ];

  const ALLOWED_ATTR = ["href", "src", "alt", "title", "target", "rel"];

  // Forcer target="_blank" et rel="noopener noreferrer" sur tous les liens
  // produits. noopener évite que window.opener soit accessible depuis la page
  // ouverte (attaque tabnabbing), noreferrer masque le Referer. target=_blank
  // garde l'app ouverte — ouvrir un lien dans la même window du renderer
  // Electron perdrait le contexte de l'éditeur.
  window.DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });

  function renderMarkdown(source) {
    if (typeof source !== "string") return "";
    const rawHtml = md.render(source);
    return window.DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
    });
  }

  window.AppMarkdown = { renderMarkdown };
})();
