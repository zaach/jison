
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

build: build_bnf build_lex

build_bnf:
	node lib/cli.js -o modules/ebnf-parser/parser.js modules/ebnf-parser/bnf.y modules/ebnf-parser/bnf.l

build_lex:
	node lib/cli.js -o modules/lex-parser/lex-parser.js modules/lex-parser/lex.y modules/lex-parser/lex.l

