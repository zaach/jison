
all: web preview

web:
	cd web/ && nanoc compile
	cp -r ../examples output/jison/ 

preview:
	cd web/ && nanoc view

deploy:
	git clone git@github.com:zaach/jison.git /tmp/jison-gh-pages
	cd /tmp/jison-gh-pages && git checkout gh-pages && rm -r ./*
	cd - && cp -r output/jison/* /tmp/jison-gh-pages/
