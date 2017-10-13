
LEX = node ./dist/cli-cjs-es5.js

ROLLUP = ../../node_modules/.bin/rollup
BABEL = ../../node_modules/.bin/babel
MOCHA = ../../node_modules/.bin/mocha




all: build test examples

prep: npm-install

npm-install:
	npm install

npm-update:
	ncu -a --packageFile=package.json

build:
	node __patch_version_in_js.js
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


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	npm version --no-git-tag-version prerelease

git-tag:
	node -e 'var pkg = require("./package.json"); console.log(pkg.version);' | xargs git tag

publish:
	npm run pub






clean:
	-rm -rf dist/
	-rm -rf node_modules/
	-rm -f package-lock.json
	-rm -rf examples/output/

superclean: clean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test examples clean superclean bump git-tag publish example-lex example-include examples_basic2_lex examples_basic_lex examples_c99 examples_ccalc_lex examples_classy examples_codegen_feature_tester_base examples_comments examples_compiled_calc_parse examples_faking examples_floop examples_handlebars examples_issue_url_lexing examples_issue_x1 examples_issue_x2 examples_lex_grammar examples_lexer_comm_debug examples_pascal examples_regex examples_semwhitespace examples_tikiwikiparser examples_unicode2 examples_unicode examples_with_custom_lexer examples_with_includes

