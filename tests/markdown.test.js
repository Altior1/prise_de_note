/**
 * @jest-environment node
 * @file tests/markdown.test.js
 * Tests unitaires pour vue/script/markdown.js.
 * Vérifie le rendu markdown vers HTML et le stripping des vecteurs XSS
 * (scripts inline, handlers d'attribut type onerror). Assertion explicite
 * que les liens portent target="_blank" et rel="noopener noreferrer".
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import MarkdownIt from "markdown-it";
import createDOMPurify from "dompurify";
import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "@jest/globals";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("markdown.js (renderMarkdown)", () => {
  let dom;
  let window;
  let scriptContent;

  beforeAll(() => {
    scriptContent = fs.readFileSync(
      path.resolve(__dirname, "../vue/script/markdown.js"),
      "utf-8",
    );
  });

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      runScripts: "dangerously",
    });
    window = dom.window;

    // L'IIFE markdown.js lit ces globales au chargement. markdownit est une
    // factory utilisable directement (pas besoin d'instance ici), DOMPurify
    // doit être instancié avec la window jsdom car la lib côté Node est un
    // wrapper qui a besoin d'un DOM. On crée une instance neuve par test pour
    // éviter que le hook afterSanitizeAttributes soit posé plusieurs fois.
    window.markdownit = MarkdownIt;
    window.DOMPurify = createDOMPurify(window);

    const scriptEl = window.document.createElement("script");
    scriptEl.textContent = scriptContent;
    window.document.body.appendChild(scriptEl);
  });

  afterEach(() => {
    window.close();
  });

  function render(source) {
    return window.AppMarkdown.renderMarkdown(source);
  }

  // Parse la sortie HTML dans un DOM pour pouvoir inspecter les attributs
  // réels des éléments générés, ce qu'une regex ne peut pas faire de manière
  // fiable (ex: alt="a&quot; onerror=&quot;b" contient la sous-chaîne onerror
  // mais pas l'attribut onerror).
  function parseToDom(html) {
    const container = window.document.createElement("div");
    container.innerHTML = html;
    return container;
  }

  function findAllElements(root) {
    return Array.from(root.querySelectorAll("*"));
  }

  test("expose window.AppMarkdown.renderMarkdown après chargement", () => {
    expect(typeof window.AppMarkdown).toBe("object");
    expect(typeof window.AppMarkdown.renderMarkdown).toBe("function");
  });

  test("rendu d'un titre H1", () => {
    const html = render("# Titre principal");
    expect(html).toMatch(/<h1[^>]*>Titre principal<\/h1>/);
  });

  test("rendu d'une liste non ordonnée (ul)", () => {
    const html = render("- pomme\n- poire\n- banane");
    expect(html).toMatch(/<ul[^>]*>/);
    expect(html).toMatch(/<li[^>]*>pomme<\/li>/);
    expect(html).toMatch(/<li[^>]*>poire<\/li>/);
    expect(html).toMatch(/<li[^>]*>banane<\/li>/);
  });

  test("rendu d'une liste ordonnée (ol)", () => {
    const html = render("1. un\n2. deux\n3. trois");
    expect(html).toMatch(/<ol[^>]*>/);
    expect(html).toMatch(/<li[^>]*>un<\/li>/);
    expect(html).toMatch(/<li[^>]*>deux<\/li>/);
  });

  test("rendu d'un code inline", () => {
    const html = render("Voici du `code inline` dans du texte.");
    expect(html).toMatch(/<code[^>]*>code inline<\/code>/);
  });

  test("rendu d'un bloc de code (code fence)", () => {
    const source = "```\nconst x = 42;\n```";
    const html = render(source);
    expect(html).toMatch(/<pre[^>]*>[\s\S]*<code[^>]*>[\s\S]*<\/code>[\s\S]*<\/pre>/);
    expect(html).toContain("const x = 42;");
  });

  test("rendu d'une citation (blockquote)", () => {
    const html = render("> une citation importante");
    expect(html).toMatch(/<blockquote[^>]*>[\s\S]*une citation importante[\s\S]*<\/blockquote>/);
  });

  test("rendu d'un lien markdown vers une URL externe", () => {
    const html = render("[Anthropic](https://www.anthropic.com)");
    expect(html).toMatch(/<a[^>]*href="https:\/\/www\.anthropic\.com"[^>]*>Anthropic<\/a>/);
  });

  test("les liens générés ont target=\"_blank\" et rel=\"noopener noreferrer\"", () => {
    const html = render("[lien](https://exemple.fr)");
    expect(html).toMatch(/<a[^>]*target="_blank"[^>]*>/);
    expect(html).toMatch(/<a[^>]*rel="noopener noreferrer"[^>]*>/);
  });

  test("XSS inline : un <script> littéral est retiré de la sortie", () => {
    const html = render("<script>alert(1)</script>");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("alert(1)</script>");
  });

  test("XSS attribut : <img onerror=...> dans la source n'introduit pas d'attribut onerror actif", () => {
    // Avec html:false, markdown-it échappe le HTML brut en entités — aucune
    // balise <img> active ne ressort dans la sortie. On parse la sortie dans
    // un DOM pour vérifier qu'aucun élément ne porte un attribut d'événement.
    const html = render('<img src=x onerror="alert(1)">');
    const root = parseToDom(html);
    // Aucune balise <img> (ni aucune autre) ne doit porter d'attribut onerror.
    for (const el of findAllElements(root)) {
      expect(el.hasAttribute("onerror")).toBe(false);
      // Et aucun attribut commençant par "on" (handlers d'événement).
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
      }
    }
  });

  test("XSS attribut via syntaxe image markdown : aucun handler n'est injecté dans <img>", () => {
    // Tentative d'échapper du alt text pour injecter un attribut.
    const html = render('![alt" onerror="alert(1)](image.png)');
    const root = parseToDom(html);
    for (const el of findAllElements(root)) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
      }
    }
  });

  test("une balise <img> valide dans la sortie n'a aucun attribut on*", () => {
    const html = render('![photo](https://exemple.fr/p.jpg "une photo")');
    const root = parseToDom(html);
    for (const el of findAllElements(root)) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
      }
    }
  });

  test("lien javascript: est neutralisé (pas d'URL javascript dans href)", () => {
    const html = render("[clic](javascript:alert(1))");
    // DOMPurify retire l'attribut href javascript: ou la balise <a> entière.
    expect(html).not.toMatch(/href="javascript:/i);
  });

  test("renderMarkdown retourne une chaîne vide pour une entrée non-string", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
    expect(render(42)).toBe("");
  });

  test("rendu combiné titre + paragraphe + code inline", () => {
    const html = render("# Section\n\nUn paragraphe avec `du code` dedans.");
    expect(html).toMatch(/<h1[^>]*>Section<\/h1>/);
    expect(html).toMatch(/<p[^>]*>[\s\S]*<code[^>]*>du code<\/code>[\s\S]*<\/p>/);
  });
});
