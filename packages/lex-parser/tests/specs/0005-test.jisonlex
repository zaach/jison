
//
// title: test advanced
//
// ...
//

%%
$ {return 'EOF';}
. {/* skip */}
"stuff"*/("{"|";") {/* ok */}
(.+)[a-z]{1,2}"hi"*? {/* skip */}

