import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Parserator',
  description: 'An elegant parser combinators library for TypeScript',

  base: '/parserator/',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' }
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is Parserator?', link: '/introduction/what-is-parserator' },
          { text: 'Getting Started', link: '/guide/getting-started' }
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Basic Concepts', link: '/guide/basic-concepts' },
          { text: 'Parser Combinators', link: '/guide/parser-combinators' },
          { text: 'Error Handling', link: '/guide/error-handling' },
          { text: 'Advanced Patterns', link: '/guide/advanced-patterns' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Core Parsers', link: '/api/core-parsers' },
          { text: 'Combinators', link: '/api/combinators' },
          { text: 'Utilities', link: '/api/utilities' },
          { text: 'Types', link: '/api/types' }
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'JSON Parser', link: '/examples/json-parser' },
          { text: 'Expression Parser', link: '/examples/expression-parser' },
          { text: 'CSV Parser', link: '/examples/csv-parser' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/saiashirwad/parserator' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/saiashirwad/parserator/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Sai'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
})
