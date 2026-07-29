# Espree Dependency Evaluation

## Executive summary

The `n/no-sync` migration in `@silvermine/eslint-config` exposed a parser-configuration
problem. JavaScript files inherit `@typescript-eslint/parser` from the global
`typescript-eslint` flat configuration, but files such as `eslint.config.js` do not provide
the TypeScript project information that `n/no-sync` expects when it encounters a synchronous
call.

The cleanest technical fix is to configure JavaScript files to use Espree, ESLint's own
JavaScript parser. However, Espree is a new direct dependency for the Field Apps projects,
so it requires approval under the team's new-software-dependency policy before it is merged.

Disabling `n/no-sync` for JavaScript files avoids the exception, but it is not behaviorally
equivalent. It removes synchronous-call lint coverage from all JavaScript files and makes
existing `eslint-disable no-sync` comments in DPS unused. The existing
`reportUnusedDisableDirectives` setting would make that especially problematic.

## How the problem came about

Before the Node-rule migration, the shared base configuration used ESLint's core `no-sync`
rule. That rule did not require TypeScript parser services.

Commit `3d103e2`, included in upstream commit `5963c81`, migrated deprecated Node rules to
`eslint-plugin-n` in preparation for ESLint 9. Among the migrated rules was:

```js
'n/no-sync': 'error',
```

The rule remained in the shared base configuration. The package also applies
`typescript-eslint`'s recommended flat configuration globally. That global configuration
sets `@typescript-eslint/parser`, including for JavaScript files. The JavaScript-specific
configuration did not reset the parser.

DPS's `eslint.config.js` contains this synchronous call while calculating configuration
patterns:

```js
fs.lstatSync(match).isSymbolicLink();
```

When `n/no-sync` visits that call, `eslint-plugin-n@17.24.0` sees TypeScript parser services
without a configured TypeScript program and throws:

```text
You have used a rule which requires type information, but don't have parserOptions set to
generate type information for this file.

Rule: "n/no-sync"
```

This is why Renovate MR !6992 fails in `test:standards`. The failure is unrelated to
`eslint-plugin-vue` and unrelated to `vue/no-unused-refs`.

## Option 1: Configure JavaScript files to use Espree

The JavaScript partial explicitly supplies Espree as its parser:

```js
languageOptions: {
   parser: espree,
},
```

This restores the normal JavaScript parser for `*.js` and `*.cjs` files. `n/no-sync` then
continues to report synchronous calls normally instead of requesting unavailable TypeScript
parser services. TypeScript files continue to use `@typescript-eslint/parser` and their
configured TypeScript projects.

Advantages:

   * Preserves the existing `n/no-sync` protection for JavaScript files.
   * Preserves the ESLint 9-oriented Node-rule migration.
   * Corrects the parser boundary instead of weakening a lint rule.
   * Uses the parser maintained by the ESLint project.
   * Has a regression test proving that a synchronous JavaScript call produces a normal lint
     finding without a fatal parser exception.

Disadvantage:

   * Espree becomes a new direct dependency and must be approved before merging.

## Option 2: Disable `n/no-sync` for JavaScript files

The alternative would be to disable the rule in the JavaScript override:

```js
{
   files: [ '**/*.js', '**/*.cjs' ],
   rules: {
      'n/no-sync': 'off',
   },
},
```

This would avoid the parser-services exception, but it would remove synchronous-call
protection from every JavaScript file.

DPS demonstrates why this is not equivalent. `lib/serverless-plugins/boilerplate.js`
contains intentional synchronous calls and existing `no-sync` suppression comments:

```js
/* eslint-disable no-sync */
systemDescriptor = yaml.load(fs.readFileSync(systemDescriptorPath).toString()),
rootSettings = yaml.load(fs.readFileSync(rootSettingsPath).toString()),
envGroupSettings = yaml.load(fs.readFileSync(envGroupSettingsPath).toString()),
/* eslint-enable no-sync */
```

It also has an inline suppression for `fs.existsSync()`.

The migrated rule is named `n/no-sync`, while these existing comments still name the
removed core rule `no-sync`. A local lint run already reports the comments on lines 161 and
411 as unused with the migrated configuration. Disabling `n/no-sync` would not make those
comments valid again; it would leave the intentional synchronous calls completely unchecked.

With `n/no-sync` disabled for JavaScript files:

1. All JavaScript files would lose `n/no-sync` coverage, including future code.
2. The existing suppression comments would remain stale and unused until they are removed or
   updated.
3. The configuration would silently depend on whether a file is JavaScript or TypeScript,
   rather than preserving the same Node rule across both languages.

Option 2 could be made to pass by removing the stale suppression comments and accepting that
JavaScript files are no longer checked, but that would be a functional reduction and is not
recommended.

## Other alternatives considered

### Restore core `no-sync` for JavaScript files

This could preserve behavior under ESLint 8, but core `no-sync` was deprecated and removed
in ESLint 9. It would undermine the purpose of the upstream Node-rule migration and require
version-specific configuration.

### Patch or wrap `eslint-plugin-n`

A wrapper could avoid requesting parser services for the simple string-ignore case, but that
would duplicate third-party rule behavior and create additional maintenance responsibility.
It is more complex than configuring JavaScript files with their intended parser.

## Espree version evaluation

The current change uses `espree@9.6.1`, not the latest `espree@11.2.0`.

### Why 9.6.1 was selected

`@silvermine/eslint-config` currently develops and tests against Node `20.12.2` and ESLint
`8.57.0`. Espree 9.6.1 supports:

```text
Node ^12.22.0 || ^14.17.0 || >=16.0.0
```

Espree 9.6.1 is also the version selected by ESLint 8.57.0, so it matches the package's
current ESLint generation and Node support range.

### Why not 11.2.0

Espree 11.2.0 requires:

```text
Node ^20.19.0 || ^22.13.0 || >=24
```

That is incompatible with `@silvermine/eslint-config`'s current `.nvmrc` value of `20.12.2`.
Although the current DPS repository uses Node `24.14.1`, the dependency belongs to the
reusable eslint-config package, whose own supported development environment is still Node
20.12.2. Selecting 11.2.0 would require a separate Node-version upgrade and compatibility
review for eslint-config.

Espree 11.2.0 also moves to newer dependency major lines, including
`eslint-visitor-keys@5`, while Espree 9.6.1 uses `eslint-visitor-keys@3`, matching the
ESLint 8 dependency family currently used by this package.

### License and dependency information

Both versions declare the following license:

```text
BSD-2-Clause
```

The license is the BSD 2-Clause License, with copyright held by the Open JS Foundation.
BSD-2-Clause is in the team's list of approved licenses for NPM dependencies.

Espree 9.6.1 runtime dependencies, as resolved in the current lockfile, and their licenses:

   * `espree@9.6.1` - BSD-2-Clause
   * `acorn@8.14.0` - MIT
   * `acorn-jsx@5.3.2` - MIT
   * `eslint-visitor-keys@3.4.3` - Apache-2.0

All of these licenses appear on the approved list. No additional transitive dependencies are
introduced by `espree@9.6.1` beyond those three packages.

Espree 11.2.0 runtime dependencies would be:

   * `acorn ^8.16.0` - MIT
   * `acorn-jsx ^5.3.2` - MIT
   * `eslint-visitor-keys ^5.0.1` - Apache-2.0

The supplied deps.dev links are:

   * [espree 9.6.1 on deps.dev](https://deps.dev/npm/espree/9.6.1)
   * [espree 11.2.0 on deps.dev](https://deps.dev/npm/espree/11.2.0)

The deps.dev pages require client-side rendering in this environment, so their page contents
could not be extracted directly. The npm registry metadata confirms the versions, licenses,
engine ranges, dependency lists, and package integrity metadata.

## DPS integration test

The fix was pushed and installed in DPS using a combined test branch containing:

   * The Espree parser fix at commit `d688f86`.
   * The `eslint-plugin-vue@9.33.0` update required by the `vue/no-unused-refs` work.

The focused Vue lint passed with zero violations, including the four components that use
`useTemplateRef()`.

The focused JavaScript lint no longer crashes on parser services. It instead reports normal
`n/no-sync` findings for synchronous calls, which confirms that Espree fixes the original
failure mode.

The full DPS lint currently reports many additional violations because DPS still overrides
the old core rule names such as `no-process-env` and `global-require`, while the migrated
configuration exposes `n/no-process-env` and `n/global-require`. Existing suppression comments
also still name the old rules. Those downstream rule-name and suppression updates are a
separate integration task; they are not evidence that the Espree parser fix failed.

## Recommendation

Use Option 1 with `espree@9.6.1`, subject to dependency approval.

It is the smallest change that preserves the intended lint behavior, supports the current
Node and ESLint versions, and avoids the parser-services failure. Do not switch to Espree
11.2.0 unless the eslint-config package first upgrades its Node support from 20.12.2 to a
compatible version.

## Draft dependency approval email

**Subject:** New dependency request: espree 9.6.1 for @silvermine/eslint-config

Hi [Team Lead],

I would like approval to add `espree@9.6.1` as a direct dependency of
`@silvermine/eslint-config`.

The package would be used by:

   * `@silvermine/eslint-config` in the `eslint-config-silvermine` repository.
   * DPS indirectly through its `@silvermine/eslint-config` development dependency.

The reason for the dependency is to configure JavaScript files with ESLint's standard
JavaScript parser. The upstream migration of deprecated Node rules to `eslint-plugin-n`
causes `n/no-sync` to request TypeScript parser services when it encounters synchronous calls
in JavaScript configuration files. JavaScript files currently inherit the TypeScript parser
from the global `typescript-eslint` configuration, but do not have TypeScript project
information. Configuring JavaScript files with Espree prevents the fatal parser-services
error while preserving `n/no-sync` enforcement.

Disabling `n/no-sync` for JavaScript files was considered, but would remove synchronous-call
lint coverage and make existing `eslint-disable no-sync` comments in DPS unused. Restoring
the deprecated core `no-sync` rule would not preserve ESLint 9 compatibility.

The requested version is `9.6.1` because it supports the eslint-config repository's current
Node `20.12.2` environment and matches the ESLint 8 dependency family used by the package.
Espree `11.2.0` requires Node `20.19.0` or newer and cannot be used without first upgrading
the eslint-config package's Node support.

Package information:

   * Package: [espree on npm](https://www.npmjs.com/package/espree/v/9.6.1)
   * Version: `9.6.1`
   * License: BSD-2-Clause
   * deps.dev: [espree 9.6.1](https://deps.dev/npm/espree/9.6.1)
   * Runtime dependencies: `acorn`, `acorn-jsx`, and `eslint-visitor-keys`

All `espree@9.6.1` dependencies and their transitive dependencies use licenses on the
approved list. Please let me know if any additional information is needed.

Thanks,
[Your Name]
