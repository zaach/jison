#! /bin/bash
#

pushd $(dirname $0)                                                                                     2> /dev/null  > /dev/null


# ---------------------------------------------------------------------------
# stage 1: rebuild all libraries from scratch, using existing NPM packages.
#          Commit. (`npm install` fails often enough that we invoke the bastard TWICE!)
# ---------------------------------------------------------------------------

make superclean ; make prep ; make prep ; make site


# git submodule foreach git commit -a -m 'rebuilt library files'
# ^-- one or more subrepo's may fail as there'ld be nothing to commit,
#     which would abort the `git submodule foreach` command!
pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null

git commit -a -m 'rebuilt library files'
git push --all


make superclean ; make prep ; make prep ; make site


pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null

git commit -a -m 'rebuilt library files'
git push --all


# ---------------------------------------------------------------------------
# stage 2: Tag and Publish.
# ---------------------------------------------------------------------------


make git-tag

npm publish


# ---------------------------------------------------------------------------
# stage 3: Bump build revision for future work, commit & push.
# ---------------------------------------------------------------------------


make bump


# git submodule foreach git commit -a -m 'rebuilt library files'
# ^-- one or more subrepo's may fail as there'ld be nothing to commit,
#     which would abort the `git submodule foreach` command!
pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
git commit -a -m 'bumped build revision'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'bumped build revision'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
git commit -a -m 'bumped build revision'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'bumped build revision'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'bumped build revision'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null

git commit -a -m 'bumped build revision'
git push --all


# ---------------------------------------------------------------------------
# stage 4: update NPM packages, if any; rebuild & commit
# ---------------------------------------------------------------------------


# rebuild everything before we go and tag the buggers!
#make git-tag
#make site

#../../../util/git_pull_push.sh -f

pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null

ncu -a --packageFile package.json 
git commit -a -m 'updated NPM packages'
git push --all


make superclean ; make prep ; make prep ; make site


pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
git push --all
popd                                                                                                           2> /dev/null  > /dev/null

git commit -a -m 'rebuilt library files'
git push --all



echo "Done. You can now continue work on the new version:"
node lib/cli.js -V


popd                                                                                                    2> /dev/null  > /dev/null



