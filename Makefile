
all: build test

site:
	node script/web-bundle.js > web/content/assets/js/jison.js 
	cd web/ && nanoc compile
	cp -r examples web/output/jison/

preview:
	cd web/ && nanoc view &
	open http://localhost:3000/jison/

deploy:
	rm -r ../pages/jison/*
	cp -r web/output/jison/* ../pages/jison/
	cd ../pages/jison && git add . && git commit -m 'Deploy site updates' && git push origin gh-pages 

build: build_bnf build_lex

build_bnf:
	node lib/jison/cli-wrapper.js src/bnf.jison src/bnf.jisonlex
	mv bnf.js lib/jison/util/bnf-parser.js

build_lex:
	node lib/jison/cli-wrapper.js src/jisonlex.jison src/jisonlex.jisonlex
	mv jisonlex.js lib/jison/util/lex-parser.js

test:
	node tests/all-tests.js
testn:
	narwhal tests/all-tests.js

