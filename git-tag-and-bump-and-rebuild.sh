#! /bin/bash
#

pushd $(dirname $0)                                                                                     2> /dev/null  > /dev/null


make git-tag
make bump
make site

git submodule foreach git commit -a -m 'bumped build revision'
git commit -a -m 'bumped build revision'

../../../util/git_pull_push.sh -f

ncu -a --packageFile package.json 

make superclean ; make prep ; make site


popd                                                                                                    2> /dev/null  > /dev/null



