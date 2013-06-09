
all: build test

site:
	node_modules/browserify/bin/cmd.js -r ./lib/jison.js -a 'file:fs' -a 'system:util' --exports require > web/content/assets/js/jison.js
	cd web/ && nanoc compile
	cp -r examples web/output/jison/

preview:
	cd web/ && nanoc view &
	open http://localhost:3000/jison/

deploy:
	-rm -r ./gh-pages/*
	cp -r web/output/jison/* ./gh-pages/
	-cd ./gh-pages && git add . && git commit -m 'Deploy site updates' && git push origin gh-pages

test:
	node tests/all-tests.js

#
# As usual, the 'npm install' of the required packages is FUBAR. So we stick with the old build tasks,
# as those at least worked as soon as you got the 'npm install' for jison itself hacked into a working condition.
#
# You know where to take NodeJS/NPM...
#

build: npm-install build_bnf build_lex

npm-install:
	npm install

JISON_DEPS = \
	lib/util/regexp-lexer.js \
	lib/util/package.json \
	lib/util/ebnf-parser.js \
	lib/util/ebnf-transform.js \
	lib/util/transform-parser.js


build_bnf: $(JISON_DEPS)
	NODE_PATH=lib/util  node lib/cli.js -o modules/ebnf-parser/parser.js modules/ebnf-parser/bnf.y modules/ebnf-parser/bnf.l
	cat modules/ebnf-parser/parser.js > lib/util/parser.js

build_lex: $(JISON_DEPS)
	NODE_PATH=lib/util  node lib/cli.js -o modules/lex-parser/lex-parser.js modules/lex-parser/lex.y modules/lex-parser/lex.l
	cat modules/lex-parser/lex-parser.js > lib/util/lex-parser.js


lib/util/regexp-lexer.js: modules/jison-lex/regexp-lexer.js
	cat modules/jison-lex/regexp-lexer.js | sed -e 's/require("lex-parser")/require(".\/lex-parser")/' > $@

lib/util/package.json: modules/jison-lex/package.json
	cat modules/jison-lex/package.json > $@

lib/util/ebnf-parser.js: modules/ebnf-parser/ebnf-parser.js
	cat modules/ebnf-parser/ebnf-parser.js | sed -e 's/require("lex-parser")/require(".\/lex-parser")/' > $@

lib/util/ebnf-transform.js: modules/ebnf-parser/ebnf-transform.js
	cat modules/ebnf-parser/ebnf-transform.js > $@

lib/util/transform-parser.js: modules/ebnf-parser/transform-parser.js
	cat modules/ebnf-parser/transform-parser.js > $@




clean:
	-@rm lib/util/regexp-lexer.js
	-@rm lib/util/package.json
	-@rm lib/util/ebnf-parser.js
	-@rm lib/util/ebnf-transform.js
	-@rm lib/util/transform-parser.js

