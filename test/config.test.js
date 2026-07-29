'use strict';

const assert = require('assert/strict'),
      eslintPackage = require('eslint'),
      { test } = require('node:test'),
      { FlatESLint } = require('eslint/use-at-your-own-risk'),
      config = require('../index');

test('JavaScript files with synchronous calls do not crash linting', async () => {
   const eslint = new FlatESLint({
      overrideConfigFile: true,
      overrideConfig: config,
   });

   const [ result ] = await eslint.lintText(
      'const fs = require(\'fs\');\nfs.lstatSync(\'path\');\n',
      { filePath: 'eslint.config.js' }
   );

   const noSyncRule = Number.parseInt(eslintPackage.Linter.version, 10) >= 9 ? 'n/no-sync' : 'no-sync';

   const hasNoSyncMessage = result.messages.some((message) => { return message.ruleId === noSyncRule; });

   assert.equal(result.fatalErrorCount, 0);
   assert.equal(hasNoSyncMessage, true);
});
