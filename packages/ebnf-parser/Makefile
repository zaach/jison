
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

	node __patch_version_in_js.js

	$(JISON) -m es bnf.y bnf.l
	mv bnf.js parser.js

	$(JISON) -m es ebnf.y
	mv ebnf.js transform-parser.js

	node __patch_prelude_in_js.js

	-mkdir -p dist
	$(ROLLUP) -c
	$(BABEL) dist/ebnf-parser-cjs.js -o dist/ebnf-parser-cjs-es5.js
	$(BABEL) dist/ebnf-parser-umd.js -o dist/ebnf-parser-umd-es5.js

test:
	$(MOCHA) --timeout 18000 --check-leaks --globals assert tests/


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	cd ../../ && node __patch_version_in_js.js

git-tag:

publish:
	npm run pub






clean:
	-rm -f parser.js
	-rm -f transform-parser.js
	-rm -f bnf.js
	-rm -f ebnf.js
	-rm -rf dist/
	-rm -rf node_modules/
	-rm -f package-lock.json

superclean: clean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test clean superclean bump git-tag publish npm-update

