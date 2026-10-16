export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'uygulama/kabuk/www/**',
      'js/paket-*.js',
      'js/vendor/**'
    ]
  },
  {
    files: ['server.js', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        caches: 'readonly',
        self: 'readonly'
      }
    },
    rules: {
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unsafe-finally': 'error',
      'no-unexpected-multiline': 'error',
      'no-unmodified-loop-condition': 'warn',
      'valid-typeof': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      'no-undef': 'off'
    }
  }
];
