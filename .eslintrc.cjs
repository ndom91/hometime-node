/* eslint-env node */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module"
  },
  plugins: ['@typescript-eslint'],
  env: {
    es2021: true
  },
  rules: {
    "@typescript-eslint/no-unused-vars": "warn",
    "no-unused-vars": "off",
  },
  root: true,
};
