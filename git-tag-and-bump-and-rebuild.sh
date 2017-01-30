#! /bin/bash
#

pushd $(dirname $0)                                                                                     2> /dev/null  > /dev/null


make git-tag
make site

../../../util/git_pull_push.sh -f

ncu -a --packageFile package.json 

make superclean ; make prep ; make site

# git submodule foreach git commit -a -m 'rebuilt library files'
# ^-- one or more subrepo's may fail as there'ld be nothing to commit,
#     which would abort the `git submodule foreach` command!
pushd modules/ebnf-parser/                                                                                     2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison2json/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/jison-lex/                                                                                       2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/json2jison/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
popd                                                                                                           2> /dev/null  > /dev/null
pushd modules/lex-parser/                                                                                      2> /dev/null  > /dev/null
git commit -a -m 'rebuilt library files'
popd                                                                                                           2> /dev/null  > /dev/null

git commit -a -m 'rebuilt library files'

npm publish

# ----

make bump

git submodule foreach git commit -a -m 'bumped build revision'
git commit -a -m 'bumped build revision'

../../../util/git_pull_push.sh -f

# ncu -a --packageFile package.json 

make superclean ; make prep ; make site


popd                                                                                                    2> /dev/null  > /dev/null



