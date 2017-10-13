
%options ranges


DIGITS          [0-9]
ALPHA           [a-zA-Z]|{DIGITS}
SPACE           " "
WHITESPACE      \s


%include with-includes.prelude1.js

%%

{WHITESPACE}+   {/* skip whitespace */}
[{DIGITS}]+     /* leading comment */  
                %include "with-includes.action1.js"  // demonstrate the ACTION block include and the ability to comment on it right here.
[{DIGITS}{ALPHA}]+     
                %{ console.log("buggerit millenium hands and shrimp!"); %}

"+"             {return '+';}
"-"             {return '-';}
"*"             {return '*';}
<<EOF>>         {return 'EOF';}

%%

%include with-includes.prelude2.js

