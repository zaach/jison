
all: test

site:
	browserify -r ./lib/jison.js -a 'file:fs' -a 'system:util' --exports require | uglifyjs > web/content/assets/js/jison.js
	cd web/ && nanoc compile
	cp -r examples web/output/jison/

preview:
	cd web/ && nanoc view &
	open http://localhost:3000/jison/

deploy:
	rm -r ../pages/jison/*
	cp -r web/output/jison/* ../pages/jison/
	cd ../pages/jison && git add . && git commit -m 'Deploy site updates' && git push origin gh-pages

test:
	node tests/all-tests.js

