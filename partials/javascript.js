'use strict';

const espree = require('espree');

module.exports = {
   languageOptions: {
      parser: espree,
   },
   rules: {
      '@typescript-eslint/no-var-requires': 'off',
   },
};
