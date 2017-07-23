
all: 

site: __cp_web

# special make target for when `git checkout gh-pages` has failed in `make deploy`:
# continue from there.
# 
# WARNING: we assume you are in `gh-pages` branch when you invoke this make target!
__cp_web: 
	cp -r web/output/jison/* ./
	#git add . --all
	git commit -a -m 'Deploy site updates'
	#git checkout master













.PHONY: all site __cp_web

