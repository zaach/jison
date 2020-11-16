
JISON_VERSION := $(shell node ../../dist/cli-cjs-es5.js -V 2> /dev/null )

ROLLUP = ../../node_modules/.bin/rollup
BABEL = ../../node_modules/.bin/babel
MOCHA = ../../node_modules/.bin/mocha
NYC = ../../node_modules/.bin/nyc      --clean=false --temp-directory ../../.nyc_output

ifndef JISON_VERSION
	JISON = sh ../../node_modules/.bin/jison
else
ifndef FULL_CODE_COVERAGE
	JISON = node ../../dist/cli-cjs-es5.js
else
	JISON = $(NYC) --reporter=lcov -- node ../../dist/cli-cjs-es5.js
endif
endif



all: build test

prep:

npm-install:
	npm install

npm-update:
	ncu -a --packageFile=package.json
	-rm -f package-lock.json

build:
ifeq ($(wildcard ../../node_modules/.bin/jison),)
	$(error "### FAILURE: Make sure you have run 'make prep' before as the jison compiler is unavailable! ###")
endif
	$(JISON) -m es -o lex-parser.js lex.y lex.l
	-mkdir -p dist
	$(ROLLUP) -c
	$(BABEL) dist/lex-parser-cjs.js -o dist/lex-parser-cjs-es5.js
	$(BABEL) dist/lex-parser-umd.js -o dist/lex-parser-umd-es5.js

test:
	$(MOCHA) --timeout 18000 --check-leaks --globals assert tests/

test-nyc:
	-rm -rf ./coverage/
	$(NYC) --reporter=lcov --reporter=html --reporter=text  -- $(MOCHA) --timeout 18000 --check-leaks --globals assert tests/


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	cd ../../ && node __patch_version_in_js.js

git-tag:

publish:
	npm run pub






clean:
	-rm -f lex-parser.js
	-rm -rf dist/

superclean: clean
	-rm -rf node_modules/
	-rm -f package-lock.json
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test clean superclean bump git-tag publish npm-update test-nyc

