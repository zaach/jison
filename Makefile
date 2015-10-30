
all: build test examples/issue-293 examples/issue-254

prep: npm-install

site: web/content/assets/js/jison.js

web/content/assets/js/jison.js: build test examples
	@[ -a  node_modules/.bin/browserify ] || echo "### FAILURE: Make sure you run 'make prep' before as the browserify tool is unavailable! ###"
	sh node_modules/.bin/browserify entry.js --exports require > web/content/assets/js/jison.js
	-@rm -rf web/tmp/
	cd web/ && nanoc compile
	cp -r examples web/output/jison/

preview:
	cd web/ && nanoc view &
	open http://localhost:3000/jison/

deploy: site
	git checkout gh-pages
	cp -r web/output/jison/* ./
	#git add . --all 
	git commit -m 'Deploy site updates'
	git checkout master

test:
	node tests/all-tests.js

examples: web/content/assets/js/calculator.js examples_directory

web/content/assets/js/calculator.js: examples/calculator.jison build
	node lib/cli.js examples/calculator.jison -o $@


examples_directory: build
	cd examples/ && make all


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

examples/calculator: build
	cd examples/ && make calculator

examples/calc_LA_on_demand: build
	cd examples/ && make calc_LA_on_demand

examples/calculator_json: build
	cd examples/ && make calculator_json

examples/classy: build
	cd examples/ && make classy

examples/classy_ast: build
	cd examples/ && make classy_ast

examples/comments: build
	cd examples/ && make comments

examples/dism: build
	cd examples/ && make dism

examples/dism_lr0: build
	cd examples/ && make dism_lr0

examples/formula: build
	cd examples/ && make formula

examples/handlebars: build
	cd examples/ && make handlebars

examples/inherited_y: build
	cd examples/ && make inherited_y

# build *AND* run the test:
examples/issue-254:
	cd examples/ && make issue-254

# build *AND* run the test:
examples/issue-293:
	cd examples/ && make issue-293

examples/jscore: build
	cd examples/ && make jscore

examples/json_js: build
	cd examples/ && make json_js

examples/json_ast_js: build
	cd examples/ && make json_ast_js

examples/lambdacalc: build
	cd examples/ && make lambdacalc

examples/nv_classy_ast: build
	cd examples/ && make nv_classy_ast

examples/phraser: build
	cd examples/ && make phraser

examples/precedence: build
	cd examples/ && make precedence

examples/reduce_conflict: build
	cd examples/ && make reduce_conflict

examples/semwhitespace: build
	cd examples/ && make semwhitespace

examples/tikiwikiparser: build
	cd examples/ && make tikiwikiparser


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
	@[ -d  node_modules/jison/lib/util ] || echo "### FAILURE: Make sure you have run 'make prep' before as the jison compiler backup utility files are unavailable! ###"
	+[ -f lib/util/parser.js     ] || ( cp node_modules/jison/lib/util/parser.js      lib/util/parser.js      && touch -d 1970/1/1  lib/util/parser.js     )
	+[ -f lib/util/lex-parser.js ] || ( cp node_modules/jison/lib/util/lex-parser.js  lib/util/lex-parser.js  && touch -d 1970/1/1  lib/util/lex-parser.js )


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

git-tag:
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


clean:
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
# When you've run `make superclean` you must run `make` and `make deploy` to regenerate all content again.
#
# The 'superclean' target is to be used when you need to update/edit the jison code generators and want to
# make sure that jison is rebuilt from scratch.
# The 'superclean' target is also useful in the above context for it enables you to find the 'originals'
# of each part of the generator (lexer & parser) as all derived copies have been killed.
#
superclean: clean
	cd examples/ && make superclean
	cd modules/ebnf-parser && make superclean
	cd modules/jison-lex && make superclean
	cd modules/jison2json && make superclean
	cd modules/json2jison && make superclean
	cd modules/lex-parser && make superclean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;
	-rm -rf web/output/
	-rm -rf web/tmp/
	#-rm -rf ./gh-pages/*
	-rm -f web/content/assets/js/calculator.js
	-rm -f web/content/assets/js/jison.js




.PHONY: all prep site preview deploy test examples build npm-install build_bnf build_lex submodules submodules-npm-install clean superclean git prep_util_dir bump submodules-bump git-tag submodules-git-tag
