
/* 
 * description: Test parser action code to lexer action code communication hack behaviour:
 * check how many look-ahead tokens are consumed by the lexer before it realizes the parser
 * has triggered a mode change, for example.
 *
 * Another test executed in this sample grammar is the check when epsilon rule action
 * code blocks are actually executed: are they executed *immediately* or is there some
 * delay there too?
 */

%debug
%options output-debug-tables


%lex

%options ranges

%x alt

%%

'('                 return '(';
')'                 return ')';
.                   return 'A';

<alt>'('            return 'BEGIN';
<alt>')'            return 'END';
<alt>.              return 'B';

/lex


%token BEGIN     "begin=("
%token END       "end=)"
%token A         "A=."
%token B         "B=."

%%



S
    : init e                    -> console.log('S:complete = ', $e);
    ;

init
    : %epsilon                  -> console.log('init:epsilon');
    ;

x
    : %epsilon                  -> console.log('X:epsilon');                    $$ = '<epsilon>';
    ;

e
    : cmd e                     -> console.log('e:cmd=', $cmd);                 $$ = $cmd + ' | ' + $e;
    | %epsilon                  -> console.log('e:epsilon');                    $$ = '<epsilon>';
    ;

cmd
    : a                         -> console.log('cmd:a');                        $$ = $a;
    | f_a                       -> console.log('cmd:function a()');             $$ = $f_a;
    | b                         -> console.log('cmd:b');                        $$ = $b;
    | f_b                       -> console.log('cmd:function b()');             $$ = $f_b;
    | error                     -> console.log('cmd:error', $error);            yyerrok; yyclearin; $$ = 'ERROR';
    ;

a
    : A                         -> console.log('a:A');                          $$ = 'A[' + $A + ']';
    ;

f_a
    : A lb e rb                 -> console.log('function a:', $e);              $$ = 'A' + $lb + $e + $rb;
    ;

b
    : B                         -> console.log('b:B');                          $$ = 'B[' + $B + ']';
    ;

f_b
    : B lb e rb                 -> console.log('function b:', $e);              $$ = 'B' + $lb + $e + $rb;
    ;

lb
    : '('                       -> console.log('lb+PUSH:[(] '); yy.lexer.pushState('alt'); $$ = '(';
    | BEGIN                     -> console.log('lb:[alt-(] '); $$ = '{';
    ;

rb
    : ')'                       -> console.log('lb:[)] ');                      $$ = ')';
    | END                       -> console.log('lb+POP:[alt-)] '); yy.lexer.popState(); $$ = '}';
    ;

%%

parser.main = function compiledRunner(args) {
    var inp = 'xxx((x)x)xxx';
    console.log('input = ', inp);


    // set up a custom parseError handler.
    //
    // Note that this one has an extra feature: it tweaks the `yytext` value to propagate 
    // the error info into the parser error rules as `$error`: 
    parser.parseError = function altParseError(msg, hash) {
        if (hash && hash.exception) {
            msg = hash.exception.message;
            //console.log('ex:', hash.exception, hash.exception.stack);
        }
        console.log("### ERROR: " + msg, hash);
        if (hash && hash.lexer) {
            hash.lexer.yytext = hash;
        };
    };

    parser.lexer.options.post_lex = function (tok) {
        console.log('lexer produces one token: ', tok, parser.describeSymbol(tok));
    };
     

    parser.parse(inp);

    return 0;
};

