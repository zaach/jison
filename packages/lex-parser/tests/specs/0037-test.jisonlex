//
// title: test start conditions
//
// ...
//

%s TEST TEST2
%x EAT
%%
"enter-test" {this.begin('TEST');}
<TEST,EAT>"x" {return 'T';}
<*>"z" {return 'Z';}
<TEST>"y" {this.begin('INITIAL'); return 'TY';}

