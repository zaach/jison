
JISON_VERSION := $(shell node ../../dist/cli-cjs-es5.js -V 2> /dev/null )

ifndef JISON_VERSION
	JISON = sh ../../node_modules/.bin/jison
else
	JISON = node ../../dist/cli-cjs-es5.js
endif

ROLLUP = ../../node_modules/.bin/rollup
BABEL = ../../node_modules/.bin/babel
MOCHA = ../../node_modules/.bin/mocha




all: build test

prep:

npm-install:
	npm install

npm-update:
	ncu -a --packageFile=package.json

build:
ifeq ($(wildcard ../../node_modules/.bin/jison),)
	$(error "### FAILURE: Make sure you have run 'make prep' before as the jison compiler is unavailable! ###")
endif
	$(JISON) -m es -o lex-parser.js lex.y lex.l
	-mkdir -p dist
	cat lex-parser-prelude.js > lex-parser-base.js
	cat lex-parser.js >> lex-parser-base.js
	cat lex-parser-base.js > lex-parser.js
	-rm lex-parser-base.js
	$(ROLLUP) -c
	$(BABEL) dist/lex-parser-cjs.js -o dist/lex-parser-cjs-es5.js
	$(BABEL) dist/lex-parser-umd.js -o dist/lex-parser-umd-es5.js

test:
	$(MOCHA) --timeout 18000 --check-leaks --globals assert tests/


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	cd ../../ && node __patch_version_in_js.js

git-tag:

publish:
	npm run pub






clean:
	-rm -f lex-parser.js
	-rm -rf dist/
	-rm -rf node_modules/
	-rm -f package-lock.json

superclean: clean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test clean superclean bump git-tag publish npm-update

