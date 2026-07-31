'use strict';

const assert = require('assert/strict'),
      { test } = require('node:test'),
      { FlatESLint } = require('eslint/use-at-your-own-risk'),
      config = require('../index'),
      node = require('../partials/node');

test('JavaScript files with synchronous calls do not crash linting', async () => {
   const eslint = new FlatESLint({
      overrideConfigFile: true,
      overrideConfig: [
         ...config,
         node,
      ],
   });

   const [ result ] = await eslint.lintText(
      'const fs = require(\'fs\');\n\nfs.lstatSync(\'path\');\n',
      { filePath: 'eslint.config.js' }
   );

   const noSyncMessages = result.messages.filter((message) => {
      return message.ruleId === 'n/no-sync';
   });

   assert.equal(result.fatalErrorCount, 0);
   assert.equal(result.errorCount, 1);
   assert.equal(result.warningCount, 0);
   assert.equal(result.messages.length, 1);
   assert.equal(noSyncMessages.length, 1);
   assert.equal(noSyncMessages[0].message, 'Unexpected sync method: \'lstatSync\'.');
});
