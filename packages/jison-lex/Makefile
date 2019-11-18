

ROLLUP = ../../node_modules/.bin/rollup
BABEL = ../../node_modules/.bin/babel
MOCHA = ../../node_modules/.bin/mocha
NYC = ../../node_modules/.bin/nyc      --clean=false --temp-directory ../../.nyc_output

ifndef FULL_CODE_COVERAGE
	LEX = node ./dist/cli-cjs-es5.js -o ./output/$@/
else
	LEX = $(NYC) --reporter=lcov -- node ./dist/cli-cjs-es5.js -o ./output/$@/
endif


all: build test examples

prep:

npm-install:
	npm install

npm-update:
	ncu -a --packageFile=package.json
	-rm -f package-lock.json

build:
	node __patch_version_in_js.js
	node __patch_lexer_kernel_in_js.js
	-mkdir -p dist
	$(ROLLUP) -c
	$(BABEL) dist/regexp-lexer-cjs.js -o dist/regexp-lexer-cjs-es5.js
	$(BABEL) dist/regexp-lexer-umd.js -o dist/regexp-lexer-umd-es5.js
	$(ROLLUP) -c rollup.config-cli.js
	$(BABEL) dist/cli-cjs.js -o dist/cli-cjs-es5.js
	$(BABEL) dist/cli-umd.js -o dist/cli-umd-es5.js
	node __patch_nodebang_in_js.js

test:
	$(MOCHA) --timeout 18000 --check-leaks --globals assert tests/

test-nyc:
	-rm -rf ./coverage/
	$(NYC) --reporter=lcov --reporter=html --reporter=text --exclude 'tests/specs/003-issue-*.js'  -- $(MOCHA) --timeout 18000 --check-leaks --globals assert tests/


examples:                                           \
		example-include                             \
		example-lex                                 \
		examples_basic2_lex                         \
		examples_basic_lex                          \
		examples_c99                                \
		examples_ccalc_lex                          \
		examples_classy                             \
		examples_codegen_feature_tester_base        \
		examples_comments                           \
		examples_compiled_calc_parse                \
		examples_faking                             \
		examples_floop                              \
		examples_handlebars                         \
		examples_issue_url_lexing                   \
		examples_issue_x1                           \
		examples_issue_x2                           \
		examples_lex_grammar                        \
		examples_lexer_comm_debug                   \
		examples_pascal                             \
		examples_regex                              \
		examples_xregexp                            \
		examples_semwhitespace                      \
		examples_tikiwikiparser                     \
		examples_unicode2                           \
		examples_unicode                            \
		examples_with_custom_lexer                  \
		examples_with_includes

example-lex:
	$(LEX) examples/lex.l -o examples/output/ -x

example-include:
	$(LEX) examples/with-includes.test.lex -o examples/output/ -x

examples_basic2_lex:
	$(LEX) examples/basic2_lex.jison -o examples/output/ -x

examples_basic_lex:
	$(LEX) examples/basic_lex.jison -o examples/output/ -x

examples_c99:
	$(LEX) examples/c99.l -o examples/output/ -x

examples_ccalc_lex:
	$(LEX) examples/ccalc-lex.l -o examples/output/ -x

examples_classy:
	$(LEX) examples/classy.jisonlex -o examples/output/ -x

examples_codegen_feature_tester_base:
	$(LEX) examples/codegen-feature-tester-base.jison -o examples/output/ -x

examples_comments:
	$(LEX) examples/comments.jison -o examples/output/ -x

examples_compiled_calc_parse:
	$(LEX) examples/compiled_calc_parse.jison -o examples/output/ -x

examples_faking:
	$(LEX) examples/faking-multiple-start-rules-alt.jison -o examples/output/ -x

examples_floop:
	$(LEX) examples/floop.l -o examples/output/ -x

examples_handlebars:
	$(LEX) examples/handlebars.jison.l -o examples/output/ -x

examples_issue_x1:
	$(LEX) examples/issue-19-jison_lex-fixed.jison -o examples/output/ -x

examples_issue_x2:
	$(LEX) examples/issue-19-jison_lex.jison -o examples/output/ -x

examples_issue_url_lexing:
	$(LEX) examples/issue-357-url-lexing.jison -o examples/output/ -x

examples_lex_grammar:
	$(LEX) examples/lex_grammar.jisonlex -o examples/output/ -x

examples_lexer_comm_debug:
	$(LEX) examples/parser-to-lexer-communication-test-w-debug.jison -o examples/output/ -x

examples_pascal:
	$(LEX) examples/pascal.l -o examples/output/ -x

examples_regex:
	$(LEX) examples/regex.jison -o examples/output/ -x

examples_xregexp:
	$(LEX) examples/xregexp.jison -o examples/output/ -x

examples_semwhitespace:
	$(LEX) examples/semwhitespace_lex.jison -o examples/output/ -x

examples_tikiwikiparser:
	$(LEX) examples/tikiwikiparser.jison -o examples/output/ -x

examples_unicode:
	$(LEX) examples/unicode.jison -o examples/output/ -x

examples_unicode2:
	$(LEX) examples/unicode2.jison -o examples/output/ -x

examples_with_includes:
	$(LEX) examples/with-includes.jison -o examples/output/ -x

examples_with_custom_lexer:
	$(LEX) examples/with_custom_lexer.jison -o examples/output/ -x



comparison:                                                                 \
		clean_comparison                                                    \
		examples                                                            \
		examples/reference-output/README.md
	# only run a DIFF once we have generated all outputs:
	# that way we get to see all diffs at once and probably have a
	# faster turn-around cycle when we go and fix any diffs observed
	# here.
	#-diff -C 1 -r -t --tabsize=4 -a -I ' generated by ' -B -E -Z -w examples/reference-output/ examples/output/    > ./comparison.diff-report.patch
	diff -q -r -t --tabsize=4 -a -I ' generated by ' -B -E -Z -w -X examples/comparison-diff-filter-extensions.txt examples/reference-output/ examples/output/



# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	cd ../../ && node __patch_version_in_js.js

git-tag:

publish:
	npm run pub






clean_comparison:
	-rm -rf examples/output/

clean: clean_comparison
	-rm -rf dist/
	-rm -rf examples/output/

superclean: clean
	-rm -rf node_modules/
	-rm -f package-lock.json
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test examples clean_comparison clean superclean bump git-tag publish example-lex example-include examples_basic2_lex examples_basic_lex examples_c99 examples_ccalc_lex examples_classy examples_codegen_feature_tester_base examples_comments examples_compiled_calc_parse examples_faking examples_floop examples_handlebars examples_issue_url_lexing examples_issue_x1 examples_issue_x2 examples_lex_grammar examples_lexer_comm_debug examples_pascal examples_regex examples_semwhitespace examples_tikiwikiparser examples_unicode2 examples_unicode examples_with_custom_lexer examples_with_includes comparison npm-update test-nyc

