import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-redeclare': 'error',
      'no-shadow-restricted-names': 'error',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart']
    }
  },
  {
    files: ['scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node, ...globals.browser } }
  }
];
