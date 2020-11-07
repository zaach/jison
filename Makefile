
NANOC := $(shell command -v nanoc 2> /dev/null)

ROLLUP = node_modules/.bin/rollup
BABEL = node_modules/.bin/babel
MOCHA = node_modules/.bin/mocha
NYC = node_modules/.bin/nyc      --clean=false --temp-directory ./.nyc_output

ifndef FULL_CODE_COVERAGE
	JISON = node dist/cli-cjs-es5.js
else
	JISON = $(NYC) --reporter=lcov -- node dist/cli-cjs-es5.js
endif



all: clean-nyc sync subpackages build test test-nyc examples-test report-nyc

everything:                         \
		clean                       \
		npm-update                  \
		prep                        \
		all                         \
		site


prep: subpackages-prep npm-install

# `make site` will perform an extensive (re)build of the jison tool, all examples and the web pages.
# Use `make compile-site` for a faster, if less complete, site rebuild action.
site: build test examples-test web-examples web/content/assets/js/jison.js compile-site

clean-site:
	-@rm -rf web/tmp/
	-@rm -rf web/output/jison/
	-@rm -rf web/content/examples/
	-rm web/content/assets/js/jison.js
	-rm web/content/assets/js/calculator.js

# `make compile-site` will perform a quick (re)build of the web pages
compile-site: web-examples web/content/assets/js/jison.js
	-@rm -rf web/tmp/
	-@rm -rf web/content/examples/
	cp -r examples web/content/examples/
ifndef NANOC
	$(warning "*** nanoc is not available, please install ruby, gem and nanoc. ***")
	$(warning "*** JISON website pages have NOT been updated!                  ***")
else
	cd web/ && nanoc compile
	-@rm -rf docs/
	-mkdir -p docs
	cp -r web/output/jison/* docs/
endif

web/content/assets/js/jison.js:
	@[ -a  node_modules/.bin/browserify ] || echo "### FAILURE: Make sure you run 'make prep' before as the browserify tool is unavailable! ###"
	sh node_modules/.bin/browserify entry.js --exports require > web/content/assets/js/jison.js

preview:
ifndef NANOC
	$(error "nanoc is not available, please install ruby, gem and nanoc")
else
	cd web/ && nanoc view &
	open http://localhost:3000/jison/
endif

# `make deploy` is `make site` plus GIT checkin of the result into the gh-pages branch
deploy: site
	#git checkout gh-pages
	#cp -r web/output/jison/* ./
	#git add . --all
	git commit -a -m 'Deploy site updates'
	#git checkout master

test:
	$(MOCHA) --timeout 18000 --check-leaks --globals assert --recursive tests/

analyze-coverage:
	istanbul cover test/unit-tests.js

check-coverage:
	istanbul check-coverage --statement 96 --branch 96 --function 96

dynamic-analysis: analyze-coverage check-coverage

clean-nyc:
	# clear the coverage cache, etc.
	-rm -rf ./.nyc_output
	-rm -rf ./coverage/

test-nyc:
	# DO NOT clear the coverage cache, etc.: earlier build tasks MAY also have contributed coverage info!
	cd packages/helpers-lib && make test-nyc
	cd packages/lex-parser && make test-nyc
	cd packages/jison-lex && make test-nyc
	cd packages/ebnf-parser && make test-nyc
	cd packages/json2jison && make test-nyc
	cd packages/jison2json && make test-nyc
	$(NYC) --reporter=lcov --reporter=text --exclude 'examples/issue-lex*.js' -- $(MOCHA) --timeout 18000 --check-leaks --globals assert --recursive tests/
	-rm -rf ./coverage/
	# report PRELIMINARY collective coverage results:
	$(NYC) report --reporter=html

report-nyc:
	-rm -rf ./coverage/
	# report collective coverage results:
	$(NYC) report --reporter=html

web-examples: web/content/assets/js/calculator.js

examples: examples_directory

web/content/assets/js/calculator.js: examples/calculator.jison build
	$(JISON) examples/calculator.jison -o $@


comparison:
	cd examples/ && make comparison

lexer-comparison:
	cd packages/jison-lex && make comparison

lexer-test:
	cd packages/jison-lex && make test

examples_directory:
	cd examples/ && make all


examples-test: 
	cd examples/ && make error-handling-tests basic-tests github-issue-tests misc-tests

error-handling-tests: 
	cd examples/ && make error-handling-tests

basic-tests: 
	cd examples/ && make basic-tests

github-issue-tests:
	cd examples/ && make github-issue-tests

misc-tests: 
	cd examples/ && make misc-tests



examples/ansic:
	cd examples/ && make ansic

examples/basic:
	cd examples/ && make basic

examples/basic2:
	cd examples/ && make basic2

examples/basic2_lex:
	cd examples/ && make basic2_lex

examples/basic_lex:
	cd examples/ && make basic_lex

examples/basic_w_error_rule:
	cd examples/ && make basic_w_error_rule

examples/bloop:
	cd examples/ && make bloop

examples/btyacc-ansiC:
	cd examples/ && make btyacc-ansiC

examples/btyacc-ansiC2:
	cd examples/ && make btyacc-ansiC2

examples/btyacc-ftp:
	cd examples/ && make btyacc-ftp

examples/btyacc-t1:
	cd examples/ && make btyacc-t1

examples/btyacc-t2:
	cd examples/ && make btyacc-t2

examples/c99:
	cd examples/ && make c99

examples/calc_LA_on_demand:
	cd examples/ && make calc_LA_on_demand

examples/calculator:
	cd examples/ && make calculator

examples/calculator_json:
	cd examples/ && make calculator_json

examples/ccalc:
	cd examples/ && make ccalc

examples/classy:
	cd examples/ && make classy

examples/classy_ast:
	cd examples/ && make classy_ast

examples/comments:
	cd examples/ && make comments

examples/compiled_calc:
	cd examples/ && make compiled_calc

examples/dism:
	cd examples/ && make dism

examples/dism_lr0:
	cd examples/ && make dism_lr0

examples/dot:
	cd examples/ && make dot

examples/error-handling-and-yyclearin:
	cd examples/ && make error-handling-and-yyclearin

examples/error-handling-and-yyerrok-loopfix:
	cd examples/ && make error-handling-and-yyerrok-loopfix

examples/error-handling-and-yyerrok-looping1:
	cd examples/ && make error-handling-and-yyerrok-looping1

examples/error-handling-and-yyerrok-looping2:
	cd examples/ && make error-handling-and-yyerrok-looping2

examples/error-handling-and-yyerrok-macro:
	cd examples/ && make error-handling-and-yyerrok-macro

examples/error-handling-and-yyerrok-part1:
	cd examples/ && make error-handling-and-yyerrok-part1

examples/error-handling-and-yyerrok-part2:
	cd examples/ && make error-handling-and-yyerrok-part2

examples/error-handling-and-yyerrok-part3:
	cd examples/ && make error-handling-and-yyerrok-part3

examples/error-handling-and-yyerrok-part4a:
	cd examples/ && make error-handling-and-yyerrok-part4a

examples/error-handling-and-yyerrok-part4b:
	cd examples/ && make error-handling-and-yyerrok-part4b

examples/error-handling-and-yyerrok-part5:
	cd examples/ && make error-handling-and-yyerrok-part5

examples/error-only:
	cd examples/ && make error-only

examples/error-recognition-actions:
	cd examples/ && make error-recognition-actions

examples/faking-multiple-start-rules:
	cd examples/ && make faking-multiple-start-rules

examples/faking-multiple-start-rules-alt:
	cd examples/ && make faking-multiple-start-rules-alt

examples/flow:
	cd examples/ && make flow

examples/formula:
	cd examples/ && make formula

examples/fsyacc-cgrammar:
	cd examples/ && make fsyacc-cgrammar

examples/gantt:
	cd examples/ && make gantt

examples/grammar:
	cd examples/ && make grammar

examples/handlebars:
	cd examples/ && make handlebars

examples/happyhappy:
	cd examples/ && make happyhappy

examples/inherited_y:
	cd examples/ && make inherited_y

examples/issue-205:
	cd examples/ && make issue-205

examples/issue-205-2:
	cd examples/ && make issue-205-2

examples/issue-205-3:
	cd examples/ && make issue-205-3

examples/issue-205-4:
	cd examples/ && make issue-205-4

examples/issue-254:
	cd examples/ && make issue-254

examples/issue-289:
	cd examples/ && make issue-289

examples/issue-293:
	cd examples/ && make issue-293

examples/issue-342:
	cd examples/ && make issue-342

examples/issue-344:
	cd examples/ && make issue-344

examples/issue-344-2:
	cd examples/ && make issue-344-2

examples/issue-348:
	cd examples/ && make issue-348

examples/issue-357-url-lexing:
	cd examples/ && make issue-357-url-lexing

examples/issue-360:
	cd examples/ && make issue-360

examples/jscore:
	cd examples/ && make jscore

examples/json_ast_js:
	cd examples/ && make json_ast_js

examples/json_js:
	cd examples/ && make json_js

examples/klammergebirge:
	cd examples/ && make klammergebirge

examples/lalr-but-not-slr:
	cd examples/ && make lalr-but-not-slr

examples/lambdacalc:
	cd examples/ && make lambdacalc

examples/lex:
	cd examples/ && make lex

examples/lojban-300:
	cd examples/ && make lojban-300

examples/lr-but-not-lalr:
	cd examples/ && make lr-but-not-lalr

examples/mermaid:
	cd examples/ && make mermaid

examples/mfcalc:
	cd examples/ && make mfcalc

examples/no-prec-hack-needed:
	cd examples/ && make no-prec-hack-needed

examples/codegen-feature-tester:
	cd examples/ && make codegen-feature-tester

examples/nv_classy_ast:
	cd examples/ && make nv_classy_ast

examples/olmenu-proto2:
	cd examples/ && make olmenu-proto2

examples/parser-to-lexer-communication-test:
	cd examples/ && make parser-to-lexer-communication-test

examples/parser-to-lexer-communication-test--profiling:
	cd examples/ && make parser-to-lexer-communication-test--profiling

profiling:
	cd examples/ && make profiling

examples/pascal:
	cd examples/ && make pascal

examples/phraser:
	cd examples/ && make phraser

examples/precedence:
	cd examples/ && make precedence

examples/reduce_conflict:
	cd examples/ && make reduce_conflict

examples/regex:
	cd examples/ && make regex

examples/semwhitespace:
	cd examples/ && make semwhitespace

examples/test-EOF-bugfix:
	cd examples/ && make test-EOF-bugfix

examples/test-epsilon-rules-early-reduce:
	cd examples/ && make test-epsilon-rules-early-reduce

examples/test-literal-quote-tokens-in-grammar:
	cd examples/ && make test-literal-quote-tokens-in-grammar

examples/test-nonassociative-operator-0:
	cd examples/ && make test-nonassociative-operator-0

examples/test-nonassociative-operator-1:
	cd examples/ && make test-nonassociative-operator-1

examples/test-nonassociative-operator-2:
	cd examples/ && make test-nonassociative-operator-2

examples/test-propagation-rules-reduction-1:
	cd examples/ && make test-propagation-rules-reduction-1

examples/theory-left-recurs-01:
	cd examples/ && make theory-left-recurs-01

examples/tikiwikiparser:
	cd examples/ && make tikiwikiparser

examples/unicode:
	cd examples/ && make unicode

examples/unicode2:
	cd examples/ && make unicode2

examples/with-includes:
	cd examples/ && make with-includes

examples/with_custom_lexer:
	cd examples/ && make with_custom_lexer

examples/yacc-error-recovery:
	cd examples/ && make yacc-error-recovery










build:                                                                  \
		subpackages-build                                               \
		prep_util_dir                                                   \
		dist/cli-cjs-es5.js                                             \
		packages/ebnf-parser/ebnf.y                                     \
		packages/ebnf-parser/bnf.y                                      \
		packages/ebnf-parser/bnf.l                                      \
		packages/lex-parser/lex.y                                       \
		packages/lex-parser/lex.l

npm-install:
	npm install

npm-update: subpackages-npm-update
	ncu -a --packageFile=package.json
	-rm -f package-lock.json

prep_util_dir:
	#@[ -d  node_modules/jison-gho/dist ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	#@[ -f  node_modules/jison-gho/dist/cli-cjs-es5.js ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	-mkdir -p dist
	#+[ -f dist/cli-cjs-es5.js     ] || ( cp node_modules/jison-gho/dist/cli-cjs-es5.js      dist/cli-cjs-es5.js      && touch -d 1970/1/1  dist/cli-cjs-es5.js     )

dist/cli-cjs-es5.js: dist/jison.js rollup.config-cli.js package.json lib/jison-parser-kernel.js
	node __patch_version_in_js.js
	node __patch_parser_kernel_in_js.js
	-mkdir -p dist
	$(ROLLUP) -c rollup.config-cli.js
	$(BABEL) dist/cli-cjs.js -o dist/cli-cjs-es5.js
	$(BABEL) dist/cli-umd.js -o dist/cli-umd-es5.js
	node __patch_nodebang_in_js.js

dist/jison.js: rollup.config.js rollup.config-template.js package.json lib/jison-parser-kernel.js
	node __patch_version_in_js.js
	node __patch_parser_kernel_in_js.js
	-mkdir -p dist
	$(ROLLUP) -c
	$(BABEL) dist/jison-cjs.js -o dist/jison-cjs-es5.js
	$(BABEL) dist/jison-umd.js -o dist/jison-umd-es5.js





subpackages:
	cd packages/helpers-lib && make
	cd packages/lex-parser && make
	cd packages/jison-lex && make
	cd packages/ebnf-parser && make
	cd packages/json2jison && make
	cd packages/jison2json && make

subpackages-build:
	cd packages/helpers-lib && make build
	cd packages/lex-parser && make build
	cd packages/jison-lex && make build
	cd packages/ebnf-parser && make build
	cd packages/json2jison && make build
	cd packages/jison2json && make build

subpackages-prep:
	cd packages/helpers-lib && make prep
	cd packages/lex-parser && make prep
	cd packages/jison-lex && make prep
	cd packages/ebnf-parser && make prep
	cd packages/jison2json && make prep
	cd packages/json2jison && make prep


subpackages-npm-update:
	cd packages/helpers-lib && make npm-update
	cd packages/lex-parser && make npm-update
	cd packages/jison-lex && make npm-update
	cd packages/ebnf-parser && make npm-update
	cd packages/jison2json && make npm-update
	cd packages/json2jison && make npm-update


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	npm version --no-git-tag-version prerelease
	node __patch_version_in_js.js

sync:
	node __patch_version_in_js.js
	node __patch_parser_kernel_in_js.js

git-tag:
	node -e 'var pkg = require("./package.json"); console.log(pkg.version);' | xargs git tag


git:
	-git pull --all
	-git push --all


subpackages-publish:
	cd packages/helpers-lib && make publish
	cd packages/lex-parser && make publish
	cd packages/jison-lex && make publish
	cd packages/ebnf-parser && make publish
	cd packages/jison2json && make publish
	cd packages/json2jison && make publish

publish: subpackages-publish
	npm run pub


clean: clean-site
	cd examples/ && make clean

	cd packages/helpers-lib && make clean
	cd packages/lex-parser && make clean
	cd packages/jison-lex && make clean
	cd packages/ebnf-parser && make clean
	cd packages/jison2json && make clean
	cd packages/json2jison && make clean

#
# When you've run `make superclean` you must run `make prep`, `make` and `make deploy` to regenerate all content again.
#
# The 'superclean' target is to be used when you need to update/edit the jison code generators and want to
# make sure that jison is rebuilt from scratch.
# The 'superclean' target is also useful in the above context for it enables you to find the 'originals'
# of each part of the generator (lexer & parser) as all derived copies have been killed.
#
superclean: clean clean-site
	-rm -rf node_modules/
	-rm -f package-lock.json

	cd examples/ && make superclean

	cd packages/helpers-lib && make superclean
	cd packages/lex-parser && make superclean
	cd packages/jison-lex && make superclean
	cd packages/ebnf-parser && make superclean
	cd packages/jison2json && make superclean
	cd packages/json2jison && make superclean

	-rm -rf dist
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;

	# recover old jison run-time so we can bootstrap without failure and need for manual git-revert action
	git checkout dist/




.PHONY: all everything                                                              \
		prep subpackages-prep														\
		subpackages-build sync                                                      \
		site preview deploy test web-examples examples examples-test                \
		examples_directory comparison lexer-comparison                              \
		error-handling-tests basic-tests github-issue-tests misc-tests              \
		build npm-install                                                           \
		subpackages                                                                 \
		clean superclean git prep_util_dir                                          \
		bump                                                                        \
		git-tag subpackages-git-tag                                                 \
		compile-site clean-site                                                     \
		publish subpackages-publish                                                 \
		npm-update subpackages-npm-update                                           \
		test-nyc clean-nyc report-nyc




#
# Available tasks/targets:
# 
# all:
# analyze-coverage:
# basic-tests:
# build:
# bump:
# check-coverage:
# clean-nyc:
# clean-site:
# clean:
# comparison:
# compile-site:
# deploy:
# dynamic-analysis:
# error-handling-tests:
# everything:
# examples-test:
# examples/***:
# examples:
# examples_directory:
# git-tag:
# git:
# github-issue-tests:
# lexer-comparison:
# lexer-test:
# misc-tests:
# npm-install:
# npm-update:
# prep:
# prep_util_dir:
# preview:
# profiling:
# publish:
# report-nyc:
# site:
# subpackages-build:
# subpackages-npm-update:
# subpackages-prep:
# subpackages-publish:
# subpackages:
# superclean:
# sync:
# test-nyc:
# test:
# web-examples:
# 