
all: web preview

web:
	cd web/ && nanoc compile

preview:
	cd web/ && nanoc view

deploy:
	git clone git@github.com:zaach/jison.git /tmp/jison-gh-pages
	cd /tmp/jison-gh-pages && git checkout gh-pages
