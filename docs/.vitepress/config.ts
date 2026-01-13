import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Parserator",
  description: "Type-safe parser combinators for TypeScript",

  base: "/parserator/",

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/" },
      { text: "Examples", link: "/examples/json-parser" }
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          {
            text: "What is Parserator?",
            link: "/introduction/what-is-parserator"
          },
          { text: "Getting Started", link: "/guide/getting-started" }
        ]
      },
      {
        text: "Guide",
        items: [
          { text: "Basic Concepts", link: "/guide/basic-concepts" },
          { text: "Generator Syntax", link: "/guide/generator-syntax" },
          { text: "Combinators", link: "/guide/parser-combinators" },
          { text: "Error Handling", link: "/guide/error-handling" },
          { text: "Performance", link: "/guide/performance" },
          { text: "Advanced Patterns", link: "/guide/advanced-patterns" }
        ]
      },
      {
        text: "API Reference",
        items: [
          { text: "Overview", link: "/api/" },
          { text: "Parser", link: "/api/parser" },
          { text: "Combinators", link: "/api/combinators" },
          { text: "Optimized Combinators", link: "/api/optimized" },
          { text: "Fast Path", link: "/api/fastpath" },
          { text: "State", link: "/api/state" },
          { text: "Errors", link: "/api/errors" },
          { text: "Error Formatter", link: "/api/error-formatter" },
          { text: "Hints", link: "/api/hints" },
          { text: "Either", link: "/api/either" }
        ]
      },
      {
        text: "Examples",
        items: [
          { text: "JSON Parser", link: "/examples/json-parser" },
          { text: "Expression Parser", link: "/examples/expression-parser" },
          { text: "CSV Parser", link: "/examples/csv-parser" },
          { text: "INI Parser", link: "/examples/ini-parser" },
          { text: "Scheme Parser", link: "/examples/scheme-parser" }
        ]
      }
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/saiashirwad/parserator" }
    ],

    search: {
      provider: "local"
    },

    editLink: {
      pattern: "https://github.com/saiashirwad/parserator/edit/main/docs/:path",
      text: "Edit this page on GitHub"
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Sai"
    }
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark"
    },
    lineNumbers: true
  }
});
