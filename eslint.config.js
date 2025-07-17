import js from '@eslint/js'
import importPlugin from 'eslint-plugin-import'

export default [
  { ignores: ['node_modules/**', 'dist/**', 'docs/**'] },
  js.configs.recommended,

  // 🟦 Shared config (applies to all JS files)
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      camelcase: 'off',
      'object-shorthand': 'off',
      'prefer-promise-reject-errors': 'off',
      'space-before-function-paren': 'off',
      'import/no-unused-modules': ['warn', { unusedExports: true }],
      'no-unused-vars': 'warn'
    }
  },

  // 🟥 self-specific config
  {
    files: ['eslint.config.js'],
    rules: {
      'import/no-unused-modules': 'off'
    }
  },

  // 🟩 Node-specific config
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly'
      }
    }
  },

  // 🟨 Browser-specific config
  {
    files: ['public/js/*.js'],
    languageOptions: {
      globals: {
        alert: 'readonly',
        confirm: 'readonly',
        console: 'readonly',
        document: 'readonly',
        event: 'readonly',
        Event: 'readonly',
        fetch: 'readonly',
        FileReader: 'readonly',
        getComputedStyle: 'readonly',
        history: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
        WebSocket: 'readonly',
        window: 'readonly'
      }
    }
  }
]
