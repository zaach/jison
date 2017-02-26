TBD

---

See #338:

---

Since a lot has been done and several of these features are tough to 'extract cleanly' to produce 'simple' patches (they won't be simple anyway), the list of differences (features and fixes in the derived repo):

[to be completed]

## Main features

- full Unicode support (okay, astral codepoints are hairy and only partly supported) in lexer and parser

  + lexer can handle XRegExp `\pXXX` unicode regex atoms, e.g. `\p{Alphabetic}`

     + jison auto-expands and re-combines these when used inside regex *set* expressions in macros, e.g.

        ```
        ALPHA                                   [{UNICODE_LETTER}a-zA-Z_]
        ```

        will be reduced to the equivalent of

        ```
        ALPHA                                   [{UNICODE_LETTER}_]
        ```

        hence you don't need to worry your regexes will include duplicate characters in regex `[...]` set expressions.

  + parser rule names can be Unicode identifiers (you're not limited to US ASCII there).

- lexer macros can be used *inside* regex set expressions (in other macros and/or lexer rules); the lexer will barf a hairball (i.e. throw an *informative* error) when the macro cannot be expanded to represent a character set without causing counter-intuitive results), e.g. this is a legal series of lexer macros now:

  ```
  ASCII_LETTER                            [a-zA-z]
  UNICODE_LETTER                          [\p{Alphabetic}{ASCII_LETTER}]
  ALPHA                                   [{UNICODE_LETTER}_]
  DIGIT                                   [\p{Number}]
  WHITESPACE                              [\s\r\n\p{Separator}]
  ALNUM                                   [{ALPHA}{DIGIT}]

  NAME                                    [{ALPHA}](?:[{ALNUM}-]*{ALNUM})?
  ID                                      [{ALPHA}]{ALNUM}*
  ```

- the parser generator produces optimized parse kernels: any feature you do not use in your grammar (e.g. `error` rule driven error recovery or `@elem` location info tracking) is rigorously *stripped* from the generated parser kernel, producing the fastest possible parser engine.

- you can define a custom written lexer in the grammar definition file's `%lex ... /lex` section in case you find the standard lexer is too slow to your liking on otherwise insufficient. (This is done by specifying a no-rules lexer with the custom lexer placed in the lexer trailing action code block.)

- you can `%include` action code chunks from external files, in case you find that the action code blurbs obscure the grammar's / lexer's definition. Use this when you have complicated/extensive action code for rules or a large amount of 'trailing code' ~ code following the `%%` end-of-ruleset marker.

- CLI: `-c 2` -- you now have the choice between *two* different table compression algorithms: 
  + mode 2 creates the smallest tables, 
  + mode 1 is the one available in 'vanilla jison' and 
  + mode 0 is 'no compression what-so-ever'


## Minor 'Selling Points'

- you can produce parsers which do not include a `try ... catch` wrapper for that last bit of **speed** and/or when you want to handle errors in surrounding userland code.

- all errors are thrown using a parser and lexer-specific `Error`-derived class which allows userland code to discern which type of error (and thus: **available extra error information**!) is being processed via a simple/fast `instanceof` check for either of them.

- the jison CLI tool will print additional error information when a grammar parse error occurred (derived off / closely related to #321 and #258)

- the jison CLI tool will print parse table statistics when requested (`-I` commandline switch) so you can quickly see how much table space your grammar is consuming. Handy when you are optimizing your grammar to reduce the number of states per parse for performance reasons.

- includes [a derivative or close relative of] #326, #316, #302, #290, #284 

- fixes #333 (lexer recognizes literal regex parts without quotes whenever possible), #328 (all errors are `Error`-derived instances with a text message and extra info attached), #317 (?not sure?), #313, #301, #299 (with minor additional abilities compared to vanilla jison, e.g. configurable error recovery search depth), #296 (unused grammar rules are reported and *nuked*, i.e. *not included* in the generated output), #282, #276 (and we support JSON5 format besides!), #254, #239 (all parser stacks are available in all grammar rule action code via `yyvstack`, `yysstack`, etc. -- documented in the documented grammar file's top API documenting comment chunk), #233 (EBNF rewriting to BNF now works; see also the wiki), #231, #218 (and `parseError` can now produce a return value for the parser to return to the calling userland code), #210, #175 (kind of..., we now support `%include filepath` statements in stead of any code chunk), #165 (kind of... now jison **does not fetch look-ahead** when the rule *reduce* action doesn't need it; it requires *intimate* understanding of your grammar and the way this LALR grammar engine handles it, but you can once again code 'lexer hacks' from inside parser rules' action code. Shudder or rejoice, depending on your mental make-up ;-) ), #138 (`instanceof` of parser and lexer error class), #121 (indirectly, you can now do this by writing an action code chunk for an initial 'epsilon' rule and get this behaviour that way)

---

---



GerHobbelt added some commits on Sep 19, 2016


```
 @GerHobbelt	fixing comments in a few examples...			a64780b
 @GerHobbelt	remove duplicate code in one of the examples: it's all contained in b…  …			d5b3cf3
 @GerHobbelt	comment tweak in parser core: make it a little more obvious that stac…  …			2fdd8aa
 @GerHobbelt	rebuild lib			9495064
 @GerHobbelt	regenerated engine			0edc55c
 @GerHobbelt	Merge remote-tracking branch 'remotes/jumperchen/next': merged but NO…  …			7e27631
 @GerHobbelt	Merge remote-tracking branch 'remotes/benbenbenbenbenben/master'			46b6dc8
 @GerHobbelt	updated the CLI options set to the current state of affairs. Quite a …  …			ee65998
 @GerHobbelt	refactored the parseArgs code which was done for #332			4516862
 @GerHobbelt	JSLint gotcha fix: variable is already defined.			484da78
 @GerHobbelt	typo fix			8c46030
 @GerHobbelt	fix minor presentation bug in `yydebug_cvt()` when the generated pars…  …			2500386
 @GerHobbelt	refactoring / optimization: added code to encode regex sets in minima…  …			cff4c3f
 @GerHobbelt	removed debug code			b3a6e3d
 @GerHobbelt	`make site`: regenerated library code			0acd35c
 @GerHobbelt	(see also jison-lex repo:) watch for the `%options xregexp` setting w…  …			75d639c
 @GerHobbelt	Updated npm packages & regenerated library			f11d3ef
 @GerHobbelt	regenerated library - after update in jison-lex: As some pcode/escape…  …			2cdcf52
 @GerHobbelt	BUGFIX: CLI wouldn't properly handle the `-c 0` compression mode sett…  …			22ce0fd
 @GerHobbelt	BUGFIX: fix collision in manual aliases and auto-aliases when user as…  …			2119ba7
 @GerHobbelt	BUGFIX/FEATURE: delay fetching look-ahead as long as possible, just l…  …			c10a384
 @GerHobbelt	typo fix in comment and trim trailing WS			fc0fac0
 @GerHobbelt	expanded the parser kernel yydebug reporting to also show the state+a…  …			981e1b0
 @GerHobbelt	BUGFIX: further work done on `findingDefaults()` as it turns out some…  …			39886a4
 @GerHobbelt	added extra examples which also serve as tests for both the `%nonasso…  …			6e8a81f
 @GerHobbelt	regenerated library + bumped build revision			4664f0c
 @GerHobbelt	regenerated library files			d992940
 @GerHobbelt	BUGFIX: `yyerrok` and `yyClearIn` were referencing the WRONG closure:…  …			cd9a94c
 @GerHobbelt	BUGFIX: stop parse kernel from running ad infinitum when an error is …  …			87f036c
 @GerHobbelt	- tweak: clip unused tail from these arrays to improve debug display.  …			8bafcf8
 @GerHobbelt	example: also show error hash object for diagnostic purposes.			01fd333
 @GerHobbelt	TWEAK/MEMLEAK FIX: error hashes are another (*potentially*) cyclic ob…  …			7c1ff07
 @GerHobbelt	fiddling with the error recovery code:  …			5e7bc5d
 @GerHobbelt	fixes:  …			29790be
 @GerHobbelt	regenerated library files; all tests pass, including `make examples` …  …			0ef35d9
 @GerHobbelt	bump revision & regenerate library files			5a61dfa
 @GerHobbelt	fix crash in 'try jison' webpage			3547829
 @GerHobbelt	fix code stripper for the yyerrok and yyclearin features			3d7f569
 @GerHobbelt	- refactoring the 'unused rules' reporting, lading up to reviving the…  …			e798687
 @GerHobbelt	adding extra test cases...			411e8c5
 @GerHobbelt	add a system test for the reporting of the unused grammar rules via e…  …			1e47c83
 @GerHobbelt	minimal tweak in the code stripper: remove one member init line state…  …			ba32118
 @GerHobbelt	regenerate library files			a8b6b04
 @GerHobbelt	parser kernel: one less parameter to pass to performAction on every r…  …			3d416eb
 @GerHobbelt	fix previous commit: also adjust the 'detect empty action function' (…  …			a155424
 @GerHobbelt	regenerate library files			c531ff2
 @GerHobbelt	correct code stripper to also nuke the extra 'infinite loop protectio…  …			c1bf138
 @GerHobbelt	documented the `parser.performAction()` parameters in the comment tha…  …			1179050
 @GerHobbelt	regenerated library			1a5250b
 @GerHobbelt	regenerated library files			1afd6ad
 @GerHobbelt	Merge remote-tracking branch 'remotes/alexlur/master'			1122ccd
 @GerHobbelt	Merge remote-tracking branch 'remotes/pragdave/master'			bfe738a
 @GerHobbelt	another optimization (for *size* this time): when the grammar does NO…  …			d676083
 @GerHobbelt	regenerated library files			c2ce7ee
 @GerHobbelt	regenerated library files			e96799f
 @GerHobbelt	trim trailing WS			20d8eb5
 @GerHobbelt	bump revision & regenerated library files			cbf0bde
 @GerHobbelt	Merge remote-tracking branch 'remotes/CecilLee/master': merged #260, …  …			910f3c2
 @GerHobbelt	update comment to latest state of affairs in the code (deleting defau…  …			7524eb2
 @GerHobbelt	regenerated library files			669ddc5
 @GerHobbelt	JSHint/JSLint/JSCS fixes: variable declaration hoisting + single quot…  …			68ffc5d
 @GerHobbelt	bump build revision & rebuild			be457ff
 @GerHobbelt	fixup unit tests now that the lexer, just like the parser already did…  …			ee06fb3
 @GerHobbelt	1. refactored the code generation a little - in sync with the same re…  …			d8ded6c
 @GerHobbelt	refactor the code generator helpers in sync with the work in the jiso…  …			ed9fc65
 @GerHobbelt	rebuild library files			c158b01
 @GerHobbelt	bumped build revision			fd91cd4
 @GerHobbelt	cleaned examples/ makefile and rebuild lib files.			7a177ff
 @GerHobbelt	fix the makefile for the `parser-to-lexer-communication-test--profili…  …			07a5dbd
 @GerHobbelt	tweak the examples/parser-to-lexer-communication-test.jison example a…  …			58fdbb3
View changesChanges you viewed on Dec 17, 2016
GerHobbelt added some commits on Nov 18, 2016
 @GerHobbelt	compensate for the simplification commit GerHobbelt/ebnf-parser@0eba501… …			963b6c8
 @GerHobbelt	remove superfluous debugging code			9fa5c34
 @GerHobbelt	rebuild library files			73bdf08
 @GerHobbelt	bumped build revision			4afb02e
 @GerHobbelt	rebuild library files			65d6d03
 @GerHobbelt	rebuild library files			64a8655
 @GerHobbelt	preliminary work to handle quoted string edge cases.			ac9f896
 @GerHobbelt	`yytext.length` --> `yyleng`			3f39539
 @GerHobbelt	- unified lexers `bnf.l`, `ebnf.y` and `lex-parser/lex.l`  …			97a3817
 @GerHobbelt	updated npm packages			c631f02
 @GerHobbelt	added test grammar to test if literal quote tokens in grammar rules a…  …			fe6dcb5
 @GerHobbelt	removed superfluous `trace` override: it will already have been set u…  …			480655f
 @GerHobbelt	regenerated library files			c3d0132
 @GerHobbelt	updated README and pointed most links to my fork as it's pretty solid…  …			bca4acc
 @GerHobbelt	bumped revision and rebuilt			d8580ba
 @GerHobbelt	check in tag-and-bump release shell script I often use; it shows the …  …			c9c82ba
 @GerHobbelt	bumped build revision			88d3975
 @GerHobbelt	extend list of fork features in README			9396f66
GerHobbelt added some commits on Dec 15, 2016
 @GerHobbelt	updated npm packages, tagged and bumped build revision and rebuilt			da9a068
 @GerHobbelt	comment and string quotes fixes			256dc6d
 @GerHobbelt	tests: the 'ignored' example grammars should at least be *compiled*. …  …			b50aa3e
 @GerHobbelt	quotes & misc. code cleanup			1c3dd16
 @GerHobbelt	preliminary work: start of refactoring of `buildProductions`			2b2eba9
 @GerHobbelt	add tests			86acb43
 @GerHobbelt	further code restructuring and three ESlint fixes which crept into th…  …			4b484d3
 @GerHobbelt	CI node v4 & v5: SyntaxError: Block-scoped declarations (let, const, …  …			c930e2a
 @GerHobbelt	CI node v4 & v5: SyntaxError: Block-scoped declarations (let, const, …  …			e302804
 @GerHobbelt	cherrypicked ESLint fixes from SHA-1: 4b484d3			4b56c4a
GerHobbelt added some commits on Jan 25
 @GerHobbelt	pick up travis CI mod from @deathcap/jison repo.			098b211
 @GerHobbelt	ditch the PHP/C# ports: I'm not keeping those in sync and nobody else…  …			765afec
 @GerHobbelt	bump build revision			cd226c4
 @GerHobbelt	re-tagged and bumped build revision again after mismanagement of buil…  …			6e88e08
 @GerHobbelt	Merge branch 'master' into remove-unused-rules-completely			98f7311
 @GerHobbelt	next part of the refactoring: `addSymbol()` invocation cleanup. Make …  …			6395109
 @GerHobbelt	rebuild library files			aff6957
 @GerHobbelt	to prevent collisions with ES6 back-quoted JavaScript string template…  …			635836e
 @GerHobbelt	prepwork to pass `%parse-params` from parser to lexer, so that all 'p…  …			67e50bc
 @GerHobbelt	- cleaned up the `pickOneOfTwoCodeAlternatives` logic so that we can …  …			545e31c
 @GerHobbelt	fixed typo + bumped build number			992ae6e
 @GerHobbelt	- lexer `input()` API: don't set `done` as we want the lex()/next() A…  …			c067627
 @GerHobbelt	added a couple of tests to check if the parse generator produces the …  …			0c93165
 @GerHobbelt GerHobbelt referenced this pull request 29 days ago
 Closed
Jison's advanced grouping options not working #340
GerHobbelt added some commits 29 days ago
 @GerHobbelt	update README to point at the pullreq where all edits are listed as w…  …			b57681e
 @GerHobbelt	blasted MarkDown :-((			112bd0c
 @GerHobbelt	And GitHub doesn't support inline CSS in blockquotes...			86d9a9d
 @GerHobbelt	Grrrrrr			ddb02e3
 @GerHobbelt	Revert "blasted MarkDown :-((" - some days, I want to... rrrrrrrrrrrr…  …			4426e41
 @GerHobbelt	patch package.json minimally for the upcoming `npm publish` action.			cd80230
 @GerHobbelt	Ignore the same thing as github/git, but also ignore the generated we…  …			d409444
 @GerHobbelt	fix package name: must be all lowercase.			03c30af
 @GerHobbelt	adjusted tag+versionbump shell build script to ensure the tagged vers…  …			248c2b6
 @GerHobbelt	rebuilt library files			c0000ae
 @GerHobbelt	rebuilt library files			de0367a
 @GerHobbelt	bumped build revision			d8ea58e
 @GerHobbelt	rebuilt library files			065fb6c
 @GerHobbelt	bumped build revision			4c77f2d
 @GerHobbelt	rebuilt library files			4284972
 @GerHobbelt	updated npm packages			29eea89
 @GerHobbelt	bumped build revision			561f180
 @GerHobbelt	rebuilt library files			9322162
 @GerHobbelt	bumped build revision			d869ff4
 @GerHobbelt	rebuilt library files			53712e8
 @GerHobbelt	Merge branch 'master' into booboo			245e0cb
 @GerHobbelt	updated git tag and build and publish script to prevent future booboo…  …			826edba
 @GerHobbelt	npm: use the new name `jison-gho`; bumped build number			e0ac0ea
 @GerHobbelt	add more error checking for the large build+tag+publish script.			c862de0
 @GerHobbelt	fix comment bugs in build/tag/publish shell script			aa11647
 @GerHobbelt	rebuilt library files			10fe1de
 @GerHobbelt	Don't worry about `npm install` failures inside `make` anymore: we ch…  …			627bcbf
 @GerHobbelt	bumped build revision			ddff4ab
 @GerHobbelt	rebuilt library files			6d9835c
 @GerHobbelt	npm dependencies: use `github:` URIs with proper prefix			e7e3c8b
 @GerHobbelt GerHobbelt referenced this pull request 26 days ago
 Open
So we need a new maintainer? Or a team? #297
 @GerHobbelt	add test example for #205 (currently fails)			95f52df
 @GerHobbelt GerHobbelt referenced this pull request 26 days ago
 Open
parser+lexer run-time optimizations: strip kernel features which are unused #341
 @GerHobbelt	First bit of work for #341: lexer run-time optimizations. For that to…  …			22b521a
This was referenced 26 days ago
 Open
[for reference] all work done which is not in original repo zaach/jison-lex#21
 Open
[for reference] all work done which is not in original repo zaach/ebnf-parser#11
 Open
[for reference] all work done which is not in original repo zaach/lex-parser#12
GerHobbelt added some commits 26 days ago
 @GerHobbelt	small update to the READAME: point at the generated website, next to …  …			63353c4
 @GerHobbelt	typo fix			71f9d5c
 @GerHobbelt	The `--no-xxx` CLI options did not work! Fix CLI option set: see also h… …			e2c1544
 @GerHobbelt	add code in example to test #4 fix			fce937c
 @GerHobbelt	Strip out a then-invalid comment when `--no-default-action` is set fo…  …			384ee8a
 @GerHobbelt	Save a lot of jison generator time (compile time = build process time…  …			3d7578e
 @GerHobbelt	augment the jison parser and lexer to collect unknown `%xyz` declarat…  …			87cdbec
GerHobbelt added some commits 26 days ago
 @GerHobbelt	rebuild library files			5d05164
 @GerHobbelt	Parser speed optimization #341: when both `--no-try-catch` and `--no-…  …			15747fc
 @GerHobbelt	clean up Jison options: unify them all, no matter where they come fro…  …			76111c6
 @GerHobbelt	CLI: do NOT accept unknown options! (hence barf a hairball when someo…  …			b905d5f
 @GerHobbelt	`npm install jison` doesn't need any submodules: ignore them!			5c64412
 @GerHobbelt	sync TravisCI and npm package ignore settings			b85f1c6
 @GerHobbelt	fix for NodeJS 4.x and 5.x: no native regex 'u' flag support yet.			2bdaf8e
 @GerHobbelt	update all TravisCI build badges in the README's			38c76bf
 @GerHobbelt	rebuilt library files			760354c
 @GerHobbelt	rebuilt library files			f1f8f48
 @GerHobbelt	bumped build revision			69d5485
 @GerHobbelt	rebuilt library files			a3ea164
 @GerHobbelt	examples/compiled_calc_exec.jison: cosmetic tweak of the custom lexer…  …			5107915
 @GerHobbelt	minor update to the documentation chunk in the generated parsers			6546e10
 @GerHobbelt	rebuild library files after work on lexer			006aa1c
 @GerHobbelt	fixing the correct set of valid inputs for the example grammar for #205			7670e5f
 @GerHobbelt	added second test grammar for #205 with the epsilon rules related by …  …			d6c4ee7
 @GerHobbelt	an add the reported test grammar for #342 for good measure...			95b7326
 @GerHobbelt	fix bug in `-I` CLI parameter info dump block reported at the end of …  …			208bcf2
 @GerHobbelt	- when `devDebug` is set, always print those debug lines, not just wh…  …			93e123d
 @GerHobbelt	fix for #205/#342: when we encounter an unresolvable conflict in LALR…  …			cbc0393
 @GerHobbelt	move lingering debug logging behind the `devDebug` check, report the …  …			1f12e1d
 @GerHobbelt	fix bug in optimization: only kill the *entirety* of `yyvstack` value…  …			447d45d
 @GerHobbelt	parser kernel optimization: remove the call to the `performAction()` …  …			eb740f9
 @GerHobbelt	fix `%options no-default-action` not working in the grammar file: now…  …			25a4eb2
 @GerHobbelt	further kernel optimization work: when the grammar doesn't have any a…  …			00b8d7f
 @GerHobbelt	Adjusted the examples for #205/342 to showcase the latest kernel opti…  …			ee720df
 @GerHobbelt	whn the LALR compiler is executing the fix-it round already, it shoul…  …			8b87a19
 @GerHobbelt	rebuild library files			edf8614
 @GerHobbelt	adding more tests for #205 / #342			6b40e37
 @GerHobbelt	adding test grammar for `$0` indexing -- see #343			a08fc0a
 @GerHobbelt	fix crash when parser encounters unsupported input: the Error message…  …			3e8813b
 @GerHobbelt	augmented the #343 test case; currently still fails (of course)			b8ee6c6
 @GerHobbelt	fix: make sure grammar file `%options module-name=name` can override …  …			b280d7f
 @GerHobbelt	don't show debug message in production compile runs of jison			34088b2
 @GerHobbelt	tiny step towards #343: rename the `performAction()` internal variabl…  …			05cb9fd
 @GerHobbelt	tweak jison to run multiple rounds for when we encounter a VERY unlik…  …			30659fb
 @GerHobbelt	added example grammars to test zaach/jison-lex#19 and the fix thereof…  …			31fdaf6
 @GerHobbelt	added more grammar tests for bison features...			8675c14
 @GerHobbelt	added more grammar tests...			ab70739
 @GerHobbelt	regenerated library files for `$0` to `yysp` transition			cf111d1
 @GerHobbelt	rebuild library files with latest submodules			d7b1e44
 @GerHobbelt	Merge commit '95b7326823edf6f2abadb043b72e7d1708207319' into detective			227c649
 @GerHobbelt	Merge commit '93e123d9f683d66abadf885e893fdd81dbec0b6f' into detective			c1c4c95
 @GerHobbelt	Merge remote-tracking branch 'remotes/GerHobbelt/Branch_1f12e1d6d0509…  …			a9459ae
 @GerHobbelt	parser kernel optimization: remove the call to the `performAction()` …  …			1d4d31c
 @GerHobbelt	fix `%options no-default-action` not working in the grammar file: now…  …			2bddf5c
 @GerHobbelt	whn the LALR compiler is executing the fix-it round already, it shoul…  …			55b1486
 @GerHobbelt	rebuilt lib files			67556c0
 @GerHobbelt	adding more tests for #205 / #342			051dc5d
 @GerHobbelt	adding test grammar for `$0` indexing -- see #343			22c2775
 @GerHobbelt	augmented the #343 test case; currently still fails (of course)			4a64892
 @GerHobbelt	fix: make sure grammar file `%options module-name=name` can override …  …			a00cab2
 @GerHobbelt	don't show debug message in production compile runs of jison			0f10aa3
 @GerHobbelt	tiny step towards #343: rename the `performAction()` internal variabl…  …			ea222ac
 @GerHobbelt	rebuilt lib files			5bfe537
 @GerHobbelt	added example grammars to test zaach/jison-lex#19 and the fix thereof…  …			bcb9a78
 @GerHobbelt	added more grammar tests for bison features...			17f4afa
 @GerHobbelt	added more grammar tests...			c843887
 @GerHobbelt	Adjusted the examples for #205/342 to showcase the latest kernel opti…  …			dd49f0a
 @GerHobbelt	last updates + rebuild			3e2eded
 @GerHobbelt	minor edits			72185ae
 @GerHobbelt	multiple loops in resolve technique			4a89127
 @GerHobbelt	blab			8945b36
 @GerHobbelt	this still passes all tests but gets hairy in the code delete section!			f3c95f3
 @GerHobbelt	use the predefined constants SHIFT/REDUCE/ACCEPT for the states inste…  …			2fc944d
 @GerHobbelt	moved test assertions from jison to the tests/errorlab.js file where …  …			ad88be9
 @GerHobbelt	migrated all tests to mocha+chai (in-browser test mode via tests/inde…  …			b174656
 @GerHobbelt	making sure all tests are run; also fixed several due to mocha/chai A…  …			da17843
 @GerHobbelt	fix bug in the construction of the warning report about rules carryin…  …			a874a17
 @GerHobbelt	fixed up the unit tests...			d719276
 @GerHobbelt	bugfix: to help ensure that LEXER errors throw a LEXER EXCEPTION CLAS…  …			534781e
 @GerHobbelt	give `yyerror` its own API so that we control its behaviour better; `…  …			d2d84b6
 @GerHobbelt	Merge branch 'master' into detective  …			894ed7d
 @GerHobbelt	debugging...			b7cf98b
 @GerHobbelt	tweaked the error-handling examples to accept multiline inputs for te…  …			d483dcf
 @GerHobbelt	fixed bugs related to `yyerror` stripping/inclusion in the generated …  …			15d2d7f
 @GerHobbelt	remove superfluous dev debug line in the tests			a781f88
 @GerHobbelt	cleaner output when testing the example test grammars			1ea042f
 @GerHobbelt	regenerated library files: all tests PASS once again...			face980
 @GerHobbelt	updated the makefiles to include the examples related to #205, #289, #… …			e531cec
 @GerHobbelt	added CLI option to forcibly turn this new conflict resolution featur…  …			cdaa3e2
 @GerHobbelt	nasty bug fix: table compression mode 2 does not work when conflicts …  …			32958a8
 @GerHobbelt	fix bug in error message logic where a grammar rule symbol was printe…  …			e1d80de
 @GerHobbelt	update handlebars example grammar to latest version available on github			cc546d4
 @GerHobbelt	`make examples` now includes compilation of the handlebars and pascal…  …			67e4ede
 @GerHobbelt	regenerated library files			d84bfa3
 @GerHobbelt	rebuilt library files			f51c882
 @GerHobbelt	bumped build revision			4d89079
 @GerHobbelt	updated NPM packages			eaabb1e
 @GerHobbelt	rebuilt library files			1315944
 @GerHobbelt	adding an example Delphi YACC grammar, which has been minimally edite…  …			d89f8c5
 @GerHobbelt	fix #5 : code was using the wrong variable name in the cleanup method…  …			f17ee7b
 @GerHobbelt	rebuilt library files			694c46b
 @GerHobbelt	bumped build revision			2963c00
 @GerHobbelt	rebuilt library files			625859e
 @GerHobbelt	adding basic GitBook config and start files...			18848f9
 @GerHobbelt	point the GitBook config to the new directory structure, intended to …  …			df75293
 @GerHobbelt	Updates README.md  …			bd87932
 @GerHobbelt	remove gitbook json from subdir where it doesn't belong any more (dir…  …			c92e514
```


