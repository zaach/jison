
all: build test examples/issue-293 examples/issue-254 examples/issue-289-BAD

prep: npm-install

# `make site` will perform an extensive (re)build of the jison tool, all examples and the web pages.
# Use `make compile-site` for a faster, if less complete, site rebuild action.
site: build web-examples web/content/assets/js/jison.js compile-site 

clean-site:
	-@rm -rf web/tmp/
	-@rm -rf web/output/jison/
	-@rm -rf web/content/examples/
	-rm web/content/assets/js/jison.js
	-rm web/content/assets/js/calculator.js

# `make compile-site` will perform a quick (re)build of the web pages
compile-site: 
	-@rm -rf web/tmp/
	-@rm -rf web/content/examples/
	cp -r examples web/content/examples/
	cd web/ && nanoc compile

web/content/assets/js/jison.js: build test web-examples examples
	@[ -a  node_modules/.bin/browserify ] || echo "### FAILURE: Make sure you run 'make prep' before as the browserify tool is unavailable! ###"
	sh node_modules/.bin/browserify entry.js --exports require > web/content/assets/js/jison.js

preview:
	cd web/ && nanoc view &
	open http://localhost:3000/jison/

# `make deploy` is `make site` plus GIT checkin of the result into the gh-pages branch
deploy: site
	git checkout gh-pages
	cp -r web/output/jison/* ./
	#git add . --all 
	git commit -m 'Deploy site updates'
	git checkout master

test:
	node tests/all-tests.js

web-examples: web/content/assets/js/calculator.js

examples: examples_directory

web/content/assets/js/calculator.js: examples/calculator.jison build
	node lib/cli.js examples/calculator.jison -o $@


examples_directory: build
	cd examples/ && make all

examples/error-handling: build
	cd examples/ && make error-handling



examples/ansic: build
	cd examples/ && make ansic

examples/basic: build
	cd examples/ && make basic

examples/basic2: build
	cd examples/ && make basic2

examples/basic2_lex: build
	cd examples/ && make basic2_lex

examples/basic_lex: build
	cd examples/ && make basic_lex

examples/basic_w_error_rule: build
	cd examples/ && make basic_w_error_rule

examples/bloop: build
	cd examples/ && make bloop

examples/btyacc-ansiC: build
	cd examples/ && make btyacc-ansiC

examples/btyacc-ansiC2: build
	cd examples/ && make btyacc-ansiC2

examples/btyacc-ftp: build
	cd examples/ && make btyacc-ftp

examples/btyacc-t1: build
	cd examples/ && make btyacc-t1

examples/btyacc-t2: build
	cd examples/ && make btyacc-t2

examples/c99: build
	cd examples/ && make c99

examples/calc_LA_on_demand: build
	cd examples/ && make calc_LA_on_demand

examples/calculator: build
	cd examples/ && make calculator

examples/calculator_json: build
	cd examples/ && make calculator_json

examples/ccalc: build
	cd examples/ && make ccalc

examples/classy: build
	cd examples/ && make classy

examples/classy_ast: build
	cd examples/ && make classy_ast

examples/comments: build
	cd examples/ && make comments

examples/compiled_calc: build
	cd examples/ && make compiled_calc

examples/dism: build
	cd examples/ && make dism

examples/dism_lr0: build
	cd examples/ && make dism_lr0

examples/dot: build
	cd examples/ && make dot

examples/error-handling-and-yyclearin: build
	cd examples/ && make error-handling-and-yyclearin

examples/error-handling-and-yyerrok-loopfix: build
	cd examples/ && make error-handling-and-yyerrok-loopfix

examples/error-handling-and-yyerrok-looping1: build
	cd examples/ && make error-handling-and-yyerrok-looping1

examples/error-handling-and-yyerrok-looping2: build
	cd examples/ && make error-handling-and-yyerrok-looping2

examples/error-handling-and-yyerrok-macro: build
	cd examples/ && make error-handling-and-yyerrok-macro

examples/error-handling-and-yyerrok-part1: build
	cd examples/ && make error-handling-and-yyerrok-part1

examples/error-handling-and-yyerrok-part2: build
	cd examples/ && make error-handling-and-yyerrok-part2

examples/error-handling-and-yyerrok-part3: build
	cd examples/ && make error-handling-and-yyerrok-part3

examples/error-handling-and-yyerrok-part4a: build
	cd examples/ && make error-handling-and-yyerrok-part4a

examples/error-handling-and-yyerrok-part4b: build
	cd examples/ && make error-handling-and-yyerrok-part4b

examples/error-handling-and-yyerrok-part5: build
	cd examples/ && make error-handling-and-yyerrok-part5

examples/error-only: build
	cd examples/ && make error-only

examples/error-recognition-actions: build
	cd examples/ && make error-recognition-actions

examples/faking-multiple-start-rules: build
	cd examples/ && make faking-multiple-start-rules

examples/faking-multiple-start-rules-alt: build
	cd examples/ && make faking-multiple-start-rules-alt

examples/flow: build
	cd examples/ && make flow

examples/formula: build
	cd examples/ && make formula

examples/fsyacc-cgrammar: build
	cd examples/ && make fsyacc-cgrammar

examples/gantt: build
	cd examples/ && make gantt

examples/grammar: build
	cd examples/ && make grammar

examples/handlebars: build
	cd examples/ && make handlebars

examples/happyhappy: build
	cd examples/ && make happyhappy

examples/inherited_y: build
	cd examples/ && make inherited_y

examples/issue-254: build
	cd examples/ && make issue-254

examples/issue-289: build
	cd examples/ && make issue-289

examples/issue-289-BAD: build
	cd examples/ && make issue-289-BAD

examples/issue-293: build
	cd examples/ && make issue-293

examples/jscore: build
	cd examples/ && make jscore

examples/json_ast_js: build
	cd examples/ && make json_ast_js

examples/json_js: build
	cd examples/ && make json_js

examples/klammergebirge: build
	cd examples/ && make klammergebirge

examples/lambdacalc: build
	cd examples/ && make lambdacalc

examples/lex: build
	cd examples/ && make lex

examples/lojban-300: build
	cd examples/ && make lojban-300

examples/mermaid: build
	cd examples/ && make mermaid

examples/mfcalc: build
	cd examples/ && make mfcalc

examples/nv_classy_ast: build
	cd examples/ && make nv_classy_ast

examples/olmenu-proto2: build
	cd examples/ && make olmenu-proto2

examples/phraser: build
	cd examples/ && make phraser

examples/pascal: build
	cd examples/ && make pascal

examples/parser-to-lexer-communication-test: build
	cd examples/ && make parser-to-lexer-communication-test

examples/precedence: build
	cd examples/ && make precedence

examples/reduce_conflict: build
	cd examples/ && make reduce_conflict

examples/regex: build
	cd examples/ && make regex

examples/semwhitespace: build
	cd examples/ && make semwhitespace

examples/tikiwikiparser: build
	cd examples/ && make tikiwikiparser

examples/unicode: build
	cd examples/ && make unicode

examples/unicode2: build
	cd examples/ && make unicode2

examples/with-includes: build
	cd examples/ && make with-includes

examples/with_custom_lexer: build
	cd examples/ && make with_custom_lexer

examples/yacc-error-recovery: build
	cd examples/ && make yacc-error-recovery



build: build_bnf build_lex

npm-install: submodules-npm-install
	npm install

JISON_DEPS = \
	lib/util/regexp-lexer.js \
	lib/util/package.json \
	lib/util/ebnf-parser.js \
	lib/util/ebnf-transform.js \
	lib/util/transform-parser.js


build_bnf: lib/util/parser.js

lib/util/parser.js: $(JISON_DEPS) submodules prep_util_dir \
					lib/cli.js lib/jison.js modules/ebnf-parser/bnf.y modules/ebnf-parser/bnf.l
	NODE_PATH=lib/util  node lib/cli.js -o $@ modules/ebnf-parser/bnf.y modules/ebnf-parser/bnf.l

build_lex: lib/util/lex-parser.js

lib/util/lex-parser.js: $(JISON_DEPS) submodules prep_util_dir \
						lib/cli.js lib/jison.js modules/lex-parser/lex.y modules/lex-parser/lex.l
	NODE_PATH=lib/util  node lib/cli.js -o $@ modules/lex-parser/lex.y modules/lex-parser/lex.l

prep_util_dir:
	@[ -d  modules/ebnf-parser/node_modules/jison/lib/util ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	@[ -f  modules/ebnf-parser/node_modules/jison/lib/util/parser.js ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	@[ -f  modules/ebnf-parser/node_modules/jison/lib/util/lex-parser.js ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	+[ -f lib/util/parser.js     ] || ( cp modules/ebnf-parser/node_modules/jison/lib/util/parser.js      lib/util/parser.js      && touch -d 1970/1/1  lib/util/parser.js     )
	+[ -f lib/util/lex-parser.js ] || ( cp modules/ebnf-parser/node_modules/jison/lib/util/lex-parser.js  lib/util/lex-parser.js  && touch -d 1970/1/1  lib/util/lex-parser.js )


lib/util/regexp-lexer.js: modules/jison-lex/regexp-lexer.js
	cat modules/jison-lex/regexp-lexer.js | sed -e 's/require("lex-parser")/require(".\/lex-parser")/' -e "s/require('lex-parser')/require('.\/lex-parser')/" > $@

lib/util/package.json: modules/jison-lex/package.json
	cat modules/jison-lex/package.json > $@

lib/util/ebnf-parser.js: modules/ebnf-parser/ebnf-parser.js submodules
	cat modules/ebnf-parser/ebnf-parser.js | sed -e 's/require("lex-parser")/require(".\/lex-parser")/' -e "s/require('lex-parser')/require('.\/lex-parser')/" > $@

lib/util/ebnf-transform.js: modules/ebnf-parser/ebnf-transform.js submodules
	cat modules/ebnf-parser/ebnf-transform.js > $@

lib/util/transform-parser.js: modules/ebnf-parser/transform-parser.js submodules
	cat modules/ebnf-parser/transform-parser.js > $@


submodules:
	cd modules/ebnf-parser && make
	cd modules/jison-lex && make
	cd modules/jison2json && make
	cd modules/json2jison && make
	cd modules/lex-parser && make


submodules-npm-install:
	cd modules/ebnf-parser && make npm-install
	cd modules/jison-lex && make npm-install
	cd modules/jison2json && make npm-install
	cd modules/json2jison && make npm-install
	cd modules/lex-parser && make npm-install


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
#
# Generally when I want to bump jison up one build number, then the submodules should also be bumped.
# This is less relevant for the jison2json and json2jison tools as they probably won't have changed,
# but hey, this way the build numbers stay nicely in sync!   :-)
bump: submodules-bump
	npm version --no-git-tag-version prerelease

submodules-bump:
	cd modules/ebnf-parser && make bump
	cd modules/jison-lex && make bump
	cd modules/jison2json && make bump
	cd modules/json2jison && make bump
	cd modules/lex-parser && make bump

git-tag: submodules-git-tag
	node -e 'var pkg = require("./package.json"); console.log(pkg.version);' | xargs git tag

submodules-git-tag:
	cd modules/ebnf-parser && make git-tag
	cd modules/jison-lex && make git-tag
	cd modules/jison2json && make git-tag
	cd modules/json2jison && make git-tag
	cd modules/lex-parser && make git-tag


git:
	#-cd gh-pages; git reset --hard; git checkout master; git pull --all; git checkout gh-pages; git pull --all
	-git submodule foreach 'git reset --hard; git pull --all; git push --all; true'
	-git pull --all; git push --all


clean: clean-site
	cd examples/ && make clean
	cd modules/ebnf-parser && make clean
	cd modules/jison-lex && make clean
	cd modules/jison2json && make clean
	cd modules/json2jison && make clean
	cd modules/lex-parser && make clean
	-rm -f $(JISON_DEPS)
	-rm -f lib/util/parser.js lib/util/lex-parser.js
	-rm -rf node_modules/

#
# When you've run `make superclean` you must run `make prep`, `make` and `make deploy` to regenerate all content again.
#
# The 'superclean' target is to be used when you need to update/edit the jison code generators and want to
# make sure that jison is rebuilt from scratch.
# The 'superclean' target is also useful in the above context for it enables you to find the 'originals'
# of each part of the generator (lexer & parser) as all derived copies have been killed.
#
superclean: clean clean-site
	cd examples/ && make superclean
	cd modules/ebnf-parser && make superclean
	cd modules/jison-lex && make superclean
	cd modules/jison2json && make superclean
	cd modules/json2jison && make superclean
	cd modules/lex-parser && make superclean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;




.PHONY: all prep site preview deploy test web-examples examples build npm-install build_bnf build_lex submodules submodules-npm-install clean superclean git prep_util_dir bump submodules-bump git-tag submodules-git-tag compile-site clean-site
