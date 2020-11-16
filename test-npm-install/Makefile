
all: test

prep: npm-install

npm-install:
	npm install

npm-update:
	ncu -a --packageFile=package.json

build:

test:
	node_modules/.bin/jison -x calculator.jison
	node ./calculator.js calc-input.txt


# increment the XXX <prelease> number in the package.json file: version <major>.<minor>.<patch>-<prelease>
bump:
	npm version --no-git-tag-version prerelease

git-tag:
	#node -e 'var pkg = require("./package.json"); console.log(pkg.version);' | xargs git tag

publish:
	#npm run pub 






clean:
	-rm -rf node_modules/
	-rm -f package-lock.json

superclean: clean
	-find . -type d -name 'node_modules' -exec rm -rf "{}" \;





.PHONY: all prep npm-install build test clean superclean bump git-tag publish
