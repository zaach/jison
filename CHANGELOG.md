0.6.1-??? / 2017-12-23

  * clean up backquotes in the master code chunks' files (used by patch_parser_kernel tool)
  * when you specify the environment variable FULL_CODE_COVERAGE=1, the subsequent make runs will include extensive code coverage analysis runs, next to the regular tests, etc.: a total summary will be available in the jison::/coverage/ directory when all is done.

    Example command:
    ```sh
    $ node_modules/.bin/cross-env FULL_CODE_COVERAGE=1 make examples
    ```
  * further work on moving the stringified code chunks which MAY/WILL be included in any generated parsers/lexers outside lib/jison.js + using the patch_parser_kernel tool to sync lib/jison.js with those external sources (which are also stored in lib/*.js )
    Added diagnostics code to the patch_parser_kernel tool to make sure that none of the regexes fail as such an error would otherwise pass us by silently, causing all kinds of hard-to-find havoc down the line...
  * move stringified code chunks outside jison, like we already did for the parser kernel et al: then use the patch_parser_kernel_in_js utility to patch those master sources back into jison.js.
  * https://github.com/GerHobbelt/jison/issues/32: we also must stringify debug_trace() as it will be included in the generated parser when you produce a 'debug level' parser. (Bug found once we got the debug-mode examples subjected to code coverage analysis: without this fix those runs would crash/fail/b0rkb0rkb0rk.
  * another benefit of coverage analysis: turning ON another couple of unit tests, which had been disabled for quite a while.
  * fix another b0rk in the make test-nyc code coverage run: one more unit test which needs istanbul ignore tweaking a la https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md
  * clean up lingering (and now obstructing!) assert library reference hacks. This is a follow-up on the `rollup` work done previously, particularly commit SHA-1: 2b8bad362f31f749d4d7e827ac8a5ac648253c7c :: [...] Also note that the parser kernel now uses `ASSERT()` instead of `assert()` as the latter **cannot** be replaced, as reported by rollup/NodeJS.
  * `coveralls` b0rks: removed the tool and make targets. Anyway, `istanbul`/`nyc` provide everything we need, so we're good without it.
  * do not include option `testCompileActionCode` in the generated parser's option set.
  * update the internal parser generator's optimization/refactoring hash calculation
  * add `cross-env` as a dev package
  * https://github.com/GerHobbelt/jison/issues/32 : work done on the jison tool (and packages) to ensure that core code components exported into generated parsers and/or lexers WILL NOT carry any undesirable code coverage or other code injection/rewriting/etc. artifacts: the code should be exported to the generated parser/lexer codebase as-is, without running the chance that another outside process (compressor/rewriter) modifies the code in unexpected ways). This should also help to reduce the troubles with https://github.com/GerHobbelt/jison/issues/7 .
    Note: now actionInclude section uses the same code extraction logic as any action code chunk, hence now also supports arrow functions, when you happen to have specified one of those via the API.
  * https://github.com/GerHobbelt/jison/issues/32 : first positive coverage analysis result: had a disabled unit test for jison-lex issue https://github.com/zaach/jison-lex/issues/23 waiting; turned on to (minimally) improve test coverage.
    Also updated Makefile(s) to truly collect all coverage data when running make test-nyc: had seen the nyc commandline help, but the hint about --clean hadn't landed until I read https://gist.github.com/rundef/22545366591d73330a48b8948fa060a7#gistcomment-1856708
  * further work on making jison (and its tests) fit for coverage analysis through istanbul/nyc, using https://github.com/gotwarlost/istanbul/blob/master/ignoring-code-for-coverage.md for tips / guidelines.
  * the example GNUCobol grammars that go with the discussion at https://github.com/GerHobbelt/jison/issues/27
  * - yydebug(): shorten yylloc object dumps
    - updated parser kernel
    - prep for the '%option test-compile-action-code' option: came up with a sensible default value. ** Not Implemented / Supported Yet. **
  * working on making jison tests run under istanbul/nyc coverage analysis: code generation & injection is a tough cookie when it comes to instrumented code coverage analysis as we're running into several crashes. Added checkcode to help speed up the trail&fix cycle: before we compile any code, we check for code coverage artifacts in the submitted code and barf a hairball when we find any. Several finds have been fixed, but only in the dist/ files: these edits must still be migrated to the proper source files!
  * examples/fsyacc-cgrammar.jison: shut up jison about different precedence tokens in single rules where not applicable: same precedence tokens should be listed together in a single %left or %right statement.
    Also add the (NOT YET SUPPORTED) %option test-compile-action-code=none option to instruct jison to IGNORE/SKIP the grammar action code compile test as the action content is written in an unsupported language - users may want to use this when they use non-native JS, e.g. TypeScript, in jison grammar's action code chunks or elsewhere...
  * working on examples set to test code generator feature filters
  * parser kernel: when parseError() produces a return value (i.e. return value is NOT undefined) while executing a parse error recovery, exit the parse process with that value anyway, even when the parse itself would otherwise be recoverable.
    In other words: whn your custom parseError() handler DOES NOT check the hash.recoverable flag AND produces a non-undefined return value, you will always have the parse() call terminate the parse and return said return value to the caller.
    (This change also 'beautifies'/'shortens' the yylloc dump sections in any yydebug() debug lines.)
  * fix: don't let the parser analysis flag parseActionsUseYYMERGELOCATIONINFO slip through into the generated code's options section




0.6.1-214 / 2017-12-20

  * updated test output reference files
  * augmented test cases for camelCase and mkIdentifier helpers lib APIs.
  * fix camelCase helpers API: do not convert 'a-2' to 'a2': numbers, which cannot be capitalized, should not eat their preceding '-' dash.
  * fix https://github.com/GerHobbelt/jison/issues/31: do not just use camelCase but instead filter file/other names through a more strict mkIdentifier() helper API (from jison-helpers-lib)
  * create working example for https://github.com/zaach/jison/issues/362 --> uncovering a bug in jison-gho due to the particular filename of this example: to be fixed.
  * move the deletion of `package-lock.json` and `node_modules/` from the `clean` to the `superclean` make target; documentation in `CONTRIBUTING.md` already uses the latter target as part of the `make superclean prep all` build sequence.
  * properly strip the var `yylineno`; line from the parser kernel when desired.
  * risk-averse coding of the parser kernel: check for !action rather than `action === 0` as `!action` is the 'error occurred in state' marker in the kernel throughout.

0.6.1-213 / 2017-12-19

  * quick fix for TravisCI failing for node 4 & 5: SyntaxError: Block-scoped declarations (let, const, function, class) not yet supported outside strict mode

0.6.1-212 / 2017-12-13

  * update the install instructions, also referencing the monorepo/bundle package: `jison-gho`, which carries *everything*.

0.6.1-211 / 2017-12-13

  * https://github.com/zaach/jison-lex/issues/23: facilitate loading JavaScript grammar specs into JISON API a la JISON-LEX API for testing: in the test code we require() such grammar specs. Also adjust the test code to otherwise facilitate the grammars that come with this issue, which are expected to produce a numeric value rather than a simple boolean TRUE.
  * adding JISON test cases as provided by https://github.com/zaach/jison-lex/issues/23 (with a minor tweak to test/showcase e + e action code expansion with named variables: $e1 + $e2 instead of the more cryptic (old-skool yacc style action code) $1 + $3
  * regenerated library files (https://github.com/zaach/jison-lex/issues/23)
  * fix: https://github.com/zaach/jison-lex/issues/23 -- added basic support for JavaScript Arrow Functions in the lexer spec, both simple functions, e.g. () => 'TOKEN' and "complex/multiline" arrow functions, e.g. () => { statements; return 'TOKEN'; ... }
  * while working on https://github.com/zaach/jison-lex/issues/23: add support for loading JavaScript and JSON/JSON5 lexer specs to be processed by jison / jison-lex: this allows us to load and execute the fail & pass examples mentioned in https://github.com/zaach/jison-lex/issues/23, for starters.
  * adding and updating test cases for "lexer ES6 arrow functions in action code" issue: https://github.com/zaach/jison-lex/issues/23
  * fixing the lexer canIUse() API method and use it (and the new lexer.fastLex() API) in the parser whenever appropriate.
  * accept %option as an alias for %options; ditto for %parse-param vs. %parse-params

0.6.1-209 / 2017-11-11

  * fix: remove remaining yylineno statement(s) when that one is not used according to the internal action+ parse kernel analysis. NOTE: the fact that the error reporting/recovery logic checks the **lexer.yylineno** lexer attribute does not count as that code won't need / touch the internal yylineno variable in any way.
  * jison-lex: lexer kernel: added deriveLocationInfo() API which may be used to reconstruct missing/epsilon location infos. This helps fix crashes observed when reporting some errors that are triggered while parsing epsilon rules, but will also serve other purposes. The important bit here is that it helps prevent crashes inside the lexer's prettyPrintRange() API when no or faulty location info object(s) have been passed as parameters: robuster lexer APIs.
  * examples: replaced the codegen-feature-tester make task with make comparison as it will compare more than just the generated codegen parsers' sources...
  * working on https://github.com/GerHobbelt/jison/issues/29: fix crash in jison when reporting an error on an epsilon rule (which has no location info); add / introduce the lexer::deriveLocationInfo() API to help you & us to construct a more-or-less useful/sane location info object from the context surrounding it when the requested location info itself is not available.
  * lexer kernel: introducing two new APIs and augmenting the pre/post callback set a la jison parser run-time:
    - fastLex(): return next match that has a token. Identical to the lex() API but does not invoke any of the pre_lex() nor any of the post_lex() callbacks.
    - canIUse(): return info about the lexer state that can help a parser or other lexer API user to use the most efficient means available. This API is provided to aid run-time performance for larger systems which employ this lexer.
    - now executes all pre_lex() and post_lex() callbacks provided as
    + member function, i.e. lexer.pre_lex() and lexer.post_lex()
    + member of the 'shared state' yy as passed to the lexer via the setInput() API, i.e. lexer.yy.pre_lex() and lexer.yy.post_lex()
    + member of the lexer options, i.e. lexer.options.pre_lex() and lexer.options.post_lex()
  * tweak: do NOT clean up the error recovery info until the parse is done:
    - DO NOT cleanup the old one before we start the new error info track: the old one will *linger* on the error stack and stay alive until we  invoke the parser's cleanup API!
    - recoveringErrorInfo is also part of the __error_recovery_infos array, hence has been destroyed already: no need to do that *twice*.
  * parser kernel fix: when yyError() internally invokes parseError() it should always have produced an 'expected set of tokens' in the info hash, whether you're running in an error recovery enabled grammar or a simple (non-error-recovering) grammar.
  * work-in-progress: clean up and improve the lexer code generator to deliver a cleaner info set when custom lexers are involved AND not exhibit side effects such as modifying the provided lexer spec when it comes in native format, i.e. doesn't have to be parsed or JSON.parse()d anymore: we should strive for an overall cleaner interface behaviour, even if that makes some internals a tad more hairy.
  * tweak examples to pass the JS validation tests for all action code snippets and other code blocks. We don't want to do them all, so there's https://github.com/GerHobbelt/jison/issues/26
  * use *positive* statements in jison code generator analysis report which is included with every generated parser: this makes those reports easier to understand at a glance.
  * add make comparison and make lexer-comparison tasks to help us compare the full set of examples` output vs. a given reference. This is basically a 'system test' / 'acceptance test' **test level** that co-exists with the unit tests and integration tests in the tests/ directory: those tests are already partly leaning towards a 'system test' level and that is "polluting" the implied simplicity of unit tests...
  * fix checkActionBlock(): fix off-by-one mistake when this one reports about a piece of action code which "does not compile": lexer and parser line tracking yylloc info starts counting at line ONE(1) instead of ZERO(0) hence we do NOT need to compensate when bumping down the action code before parsing/validating it in here.
  * updated NPM packages.
  * add a make profile task to simply only run the profiler tasks in examples/Makefile. Tweak make superclean to ensure that we can bootstrap once you've run make prep by reverting the jison/dist/ directory after 'supercleaning'.
  * https://github.com/GerHobbelt/jison/issues/25: yet another kernel fix: yyErrOk() a.k.a. yyerrok SHOULD NOT reset/cleanup the recoveringErrorInfo object as one may invoke yyerrok while still inside the error recovery phase of the parser, thus *potentially* causing trouble down the lane for subsequent parse states. (This is another edge case that's hard to produce: better-safe-than-sorry coding style applies.)
  * further work on https://github.com/GerHobbelt/jison/issues/25: fix logic mistake introduced in parser kernel in the preceeding commits: action === 0 is the error parse state and that one, when it is discovered during error **recovery** in the inner slow parse loop, is handed back to the outer loop to prevent undue code duplication. Handing back means the outer loop will have to process that state, not exit on it immediately!
  * observed in one of the examples: lingering yyleng = 0; statement after code stripping. Adjusted stripper regexes to fix this.
  * fixup the error-handling-and-yyerrok* examples: remove extra newlines in the console.log() statements in there: console.log() adds a newline automatically, while the original C code printf() does not.
  * further work on https://github.com/GerHobbelt/jison/issues/25: making jison pass all tests once again. Also observed that retval isn't always teated properly when its *potential value* is produced by parseError(): only when parseError() produces a sensible value (i.e. *not* undefined!) should that value be produced by the parser. Otherwise a parse *error* should produce the value false to signal parse/match failure on the given input.
  * work on https://github.com/GerHobbelt/jison/issues/25: inner and outer ("slow" and "fast") parse loops have been cross-compared and adjusted to suit our original intent as described in the issue https://github.com/GerHobbelt/jison/issues/25: see the comments (edited) for the important parts of this work.
  * parser kernel optimization: remove the remaining error recovery conditional code in the SHIFT state as any error handling while going through the parser state machine is done in the *other* parse loop: the parse loop has been duplicated before so we could do this and work towards a quick-as-you-can main parse loop IFF no parse errors occur -- in exchange for a chunk of duplicated-and-then-tweaked code in the parse kernel.
  * fix require() library: we use globby instead of glob!

0.6.1-208 / 2017-10-29

  * fix unit test which broke due to us augmenting the nested-error message in the parser kernel in the previous commit.
  * further work while we make sure both the test cases and the new test grammar don't lock up or fail prematurely during error recovery: it's a hairy balance...  This fixes/tweaks commit SHA-1: bd77c14b00e43bfaa602cd8a289aa8f0ace3bc20 :: fix: adjust the parser kernel error recovery code: the previous change FAILED the examples/error-handling-and-yyerrok-part1..5 recovery test examples. This is further work done on SHA-1: a6b91fddf6c0336b6b2ec154fb04ec1935a23ac9 :: fix infinite loop at run-time for particular erroneous inputs: parser kernel edge case found by @roman-spiridonov ( https://github.com/GerHobbelt/jison/issues/21 ) where an error recovery rule sits just above the $accept rule and the entire input has just been lexed, while an error recovery fails, thus causing a lock-up in the parser kernel where the lexer keeps producing EOF tokens and the locateNearestErrorRecoveryRule() cycles between 'shifting the error token' and '$accept' state phases.
  * fix: adjust the parser kernel error recovery code: the previous change FAILED the examples/error-handling-and-yyerrok-part1..5 recovery test examples. This is further work done on SHA-1: a6b91fddf6c0336b6b2ec154fb04ec1935a23ac9 :: fix infinite loop at run-time for particular erroneous inputs: parser kernel edge case found by @roman-spiridonov ( https://github.com/GerHobbelt/jison/issues/21 ) where an error recovery rule sits just above the $accept rule and the entire input has just been lexed, while an error recovery fails, thus causing a lock-up in the parser kernel where the lexer keeps producing EOF tokens and the locateNearestErrorRecoveryRule() cycles between 'shifting the error token' and '$accept' state phases.
  * use the new (patched) RECAST library which supports ison-style variables (@2, @$, ##TOKEN, etc.) out of the box.
  * lexer: unknown options, etc. should not come as array 0/1 indexed sets, but as key/value-pair objects instead for better code readability if we ever choose to access those bits of the parsed lexer/parser.
  * updated NPM packages
  * cleaned up a few **lexer** tests in the ebnf/bnf parser library test suite.
  * fix markdown mistake in README for lexer
  * cleaned up the lexer test code and adding more tests...
  * fixes/tweaks to the parser generator and kernel:
    - don't make the error 'recoverable' handling in parseError() dependent on the presence of the (debug mode) trace() function API.
    - treat the parseError() code chunk just like the other chunks in lieu of code compression/obfuscation: all kernel chunks should be stringified and are imported from master templates using the patch_parser_kernel_in_js utility.
    - dump the **parser moduleInclude** chunk **after** the lexer so that the lexer instance variable is present and valid by the time the parser's trailing code ('moduleInclude' chunk) is executed. This allows the parser code block to manipulate the lexer with abandon :-)
  * fix infinite loop at run-time for particular erroneous inputs: parser kernel edge case found by @roman-spiridonov ( https://github.com/GerHobbelt/jison/issues/21 ) where an error recovery rule sits just above the $accept rule and the entire input has just been lexed, while an error recovery fails, thus causing a lock-up in the parser kernel where the lexer keeps producing EOF tokens and the locateNearestErrorRecoveryRule() cycles between 'shifting the error token' and '$accept' state phases.

0.6.1-207 / 2017-10-24

  * no need for the TravisCI tweak for git submodules any more: removed from the TravisCI config file
  * added missing examples (as these were thought to be *moved* to /docs/examples/ by a previous git commit)
  * added `npm run website` task to start `live-server` tool and serve the /docs/ website locally for testing/evaluation.
  * `live-server` tool crashed due to missing stream-sink dep; packages updated. *hmmmm, weird*
  * updated version patch utility to ensure that subpackages have up-to-date dependencies pointing at the npm package versions of the other modules which will always be published alongside with them, hence configuring those package.json files dependencies to reference no-yet-existing subpackage releases is fine as everything is published in one fell swoop via make publish from this monorepo every time.
  * removed submodule dirtree

0.6.1-206 / 2017-10-24

  * bumped build revision and rebuilt library files

0.6.*-???

  ???

0.4.*-???

  ???

0.4.18

  * Merge pull request https://github.com/zaach/jison/issues/325 from RubenVerborgh/fix-error-inheritance
    _parseError should be an instance of Error
  * _parseError should be an instance of Error.
    Fixes a regression introduced by https://github.com/zaach/jison/issues/319
    while still providing a fix for https://github.com/zaach/jison/issues/318.
  * Merge pull request https://github.com/zaach/jison/issues/312 from saadq/master
    Add syntax highlighting to README

0.4.17

  * Merge pull request https://github.com/zaach/jison/issues/319 from polybuildr/fix-parse-error
    Fix throwing of parseError
  * Fix throwing of parseError
    The constructor is set to new Error(), instead set it to just
    Error.

0.4.16

  * Merge pull request https://github.com/zaach/jison/issues/314 from DmitrySoshnikov/master
    Added JSONNullLiteral to json.js example
  * Added JSONNullLiteral to json.js example
    The "JSONNullLiteral": [ "NULL" ] was forgotten in "bnf" section, and null didn't parse.
  * Add syntax highlighting to README
  * Merge pull request https://github.com/zaach/jison/issues/305 from rumblesan/strictfix
    Fixing strict mode function decleration error
  * Fixing strict mode function decleration error
  * Merge pull request https://github.com/zaach/jison/issues/266 from Pyro699/error_context
    More details from parsing Error
  * Merge pull request https://github.com/zaach/jison/issues/269 from nolanlawson/contributor-guidelines
    add CONTRIBUTING.md with guidelines
  * Merge pull request https://github.com/zaach/jison/issues/267 from nolanlawson/246
    Fix this.lexer undefined, fixes https://github.com/zaach/jison/issues/246
  * Merge pull request https://github.com/zaach/jison/issues/280 from kemitchell/patch-1
    Add a license property to package.json
  * Merge pull request https://github.com/zaach/jison/issues/278 from y-ich/master
    made moduleName valid
  * Merge pull request https://github.com/zaach/jison/issues/270 from nolanlawson/local-uglify
    Use local uglifyjs
  * Merge pull request https://github.com/zaach/jison/issues/277 from xndcn/fix-for-json
    Fix issue https://github.com/zaach/jison/issues/276, error when input file is JSON format.
  * add a license property to package.json
    Add the SPDX-compliant license identifier for the MIT license, "MIT", as the "license" property in package.json. This makes it possible for programs to determine how jison is licensed, without attempting inference from README.
  * made moduleName valid
  * Fix issue https://github.com/zaach/jison/issues/276, error when input file is JSON format.
  * Use local uglifyjs
    It's safer to use the local in node_modules, so that
    developers don't need to have uglifyjs installed
    globally.
  * add CONTRIBUTING.md with guidelines
    It was a bit confusing for me when I started, because I
    wasn't familiar with Makefiles, so I added some details here.
    I like the CONTRIBUTING.md file, because Github pops up a little
    message when you open a PR on the project, to advise you
    to read it. Let me know if this suits your tastes. :)
  * Fix this.lexer undefined, fixes https://github.com/zaach/jison/issues/246
    It seems that 9e0cc65 introduced a bug in the generated
    code, such that this.lexer is undefined, and so it
    throws a runtime error.
    This fixes the bug, and also adds a test to reproduce the
    error. The test fails before the fix, but succeeds after.
    I ran the tests and confirmed 100% success and no errors.
  * Include the information from hash to better handle client-side reporting when raising a parseError.
  * Merge pull request https://github.com/zaach/jison/issues/256 from phillipalexander/patch-1
    Fix spelling error
  * Fix spelling error
    ignouring --> ignoring
  * Merge pull request https://github.com/zaach/jison/issues/245 from syrnick/master
    Fix global leaks
  * Fix global leaks
  * disable node 0.8 testing

0.4.15

  * prefix generated variables with "$"
  * make the formatting more consistent
  * Merge pull request https://github.com/zaach/jison/issues/235 from RubenVerborgh/even-compacter-table
    Reduce parser file size even more
  * Combine identical actions under one case.
  * Also compact objects with not all identical values.

0.4.14

  * Merge pull request https://github.com/zaach/jison/issues/234 from RubenVerborgh/compact-table
    Significantly decrease parser file size by compacting parser table
  * Use the same variable names for each generation.
  * Replace objects with identical values by function calls.
  * Merge pull request https://github.com/zaach/jison/issues/226 from edi9999/patch-1
    Update calculator.jison
  * Replace frequent number lists by variables.
  * generateModule_ returns common and module code.
  * Update calculator.jison
  * chore(package): update old dependencies
  * feature(bnf): enable option for token stacks in the parser grammar
  * fix token stack support
  * Merge branch 'cdibbs-master' into merge-cdibbs
    Conflicts:
    lib/jison.js
  * fix reentrant parsing
  * upgrade node test versions on travis
  * upgrade jison-lex
  * Merge pull request https://github.com/zaach/jison/issues/208 from thomasmichaelwallace/master
    JSON format support for C# port.
  * make a copy of shared state on each parse
  * create a new instance of the lexer on each parse
  * refactor generation so that in-memory and to-source code paths are the same
  * Remove path from C# class name.
  * Added JSON support to C# port
  * update copyright dates in readme
  * Merge pull request https://github.com/zaach/jison/issues/202 from cjbrowne/master
    AMD module generator should be able to define dependencies
  * clean up cli
  * Merge branch 'cli' of github.com:matthewkastor/jison into matthewkastor-cli
  * wip
  * Use requireJS commonJS sugar instead of dependencies as arguments to define.
  * Removed module name as it was causing more problems than it solved, and although technically allowed, defining a module name explicitly is not recommended by requirejs.
  * Removed dependency on JSON.stringify which I believe was causing the build failure
  * Added ability to name the AMD module as well as adding dependencies.
  * Fixed error in last commit
  * Added ability to specify dependencies of AMD module to AMD module generation function
  * Merge pull request https://github.com/zaach/jison/issues/198 from nelsonjchen/patch-1
    Update docs.html
  * Update docs.html
    Fix URL.
  * Merge pull request https://github.com/zaach/jison/issues/190 from robertleeplummerjr/master
    Adding c#, and updated php
  * reverts ignoring log directory produced by jsdoc
  * removes jsdoc/vsdoc noise
  * adds devDependency jsdoc-toolkit >= 0.0.2
  * vsdoc template for jsdoc-toolkit
    These files make it possible to generate documentation which can be
    consumed by visual studio to provide intellisense code completion. Just
    tell jsdoc-toolkit to use this template when generating docs.
  * about to add vsdoc template
  * jsdoc / vsdoc generated documentation.
  * about to generate docs, ignore logs folder.
  * edit docs, cleanup cli.processGrammars
    options argument properties are documented better. Optional and default
    args specified better. jsonMode arg to cli.processGrammars means
    something.
  * minor edits to documentation
    The comment for main is huge. It didn't look that great when rendered
    into a document so I added a few break tags. Now it's legible in the
    code and generated documents.
  * cli can be called from script
    I keep finding myself reimplementing the cli script and it would be much
    easier if I could simply require it and use it in scripts. The basic
    change is that main accepts an options argument. The rest of the
    changes: add documentation to the source code, expose a method for
    processing grammar files in any combination the cli accepts, and expose
    a method for generating a parser as a string. It's all pretty much the
    same code as was there, just shifted around so I could expose things to
    users and wrapped up so things don't go haywire.
  * Ensure that symbol exists for c#
  * Fixed merge issues
  * Merge remote-tracking branch 'upstream/master'

0.4.13

  * support module include with amd module type - see https://github.com/zaach/jison/issues/188

0.4.12

  * update dependencies
  * support name aliases with ebnf
  * Merge pull request https://github.com/zaach/jison/issues/185 from cdibbs/namedvals
    Named values enhancement (https://github.com/zaach/jison/issues/184).

0.4.11

  * bind generator methods on parser - fixes https://github.com/zaach/jison/issues/188, fixes https://github.com/zaach/jison/issues/189
  * From Value to Text, as it is in Jison js
  * Update test from .jison
  * Merge branch 'master' of https://github.com/robertleeplummerjr/jison
  * Get test working
    Fix a few issues with add and how decimals are handled, also, correct
    some issues with .jison file
  * Enabled named values in the parser (https://github.com/zaach/jison/issues/184). Added modified classy grammar as example.

