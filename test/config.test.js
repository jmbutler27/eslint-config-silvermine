'use strict';

const assert = require('assert/strict'),
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

   const noSyncMessages = result.messages.filter((message) => {
      return message.ruleId === 'n/no-sync';
   });

   assert.equal(result.fatalErrorCount, 0);
   assert.equal(noSyncMessages.length, 1);
});
