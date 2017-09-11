
/* 
 * description: Parses and executes mathematical expressions. 
 * Self-contained example which runs a series of tests in a performance benchmark: 
 * see main() at the bottom 
 */



/* lexical grammar */
%lex

// %options backtrack_lexer

%s PERCENT_ALLOWED

%%

// `%`: the grammar is not LALR(1) unless we make the lexer smarter and have 
// it disambiguate the `%` between `percent` and `modulo` functionality by 
// additional look-ahead:
// we introduce a lexical predicate here to disambiguate the `%` and thus 
// keep the grammar LALR(1)!
//      https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
// we also use an (inclusive) lexical scope which turns this rule on only 
// immediately after a number was lexed previously.

<PERCENT_ALLOWED>"%"(?=\s*(?:[^0-9)]|E\b|PI\b|$))
                      // followed by another operator, i.e. anything that's 
                      // not a number, or The End: then this is a unary 
                      // `percent` operator.
                      //
                      // `1%-2` would be ambiguous but isn't: the `-` is 
                      // considered as a unary minus and thus `%` is a 
                      // `modulo` operator.
                      //
                      // `1%*5` thus is treated the same: any operator 
                      // following the `%` is assumed to be a *binary* 
                      // operator. Hence `1% times 5` which brings us to 
                      // operators which only exist in unary form: `!`, and 
                      // values which are not numbers, e.g. `PI` and `E`:
                      // how about
                      // - `1%E` -> modulo E,
                      // - `1%!0` -> modulo 1 (as !0 -> 1)
                      //
                      // Of course, the easier way to handle this would be to 
                      // keep the lexer itself dumb and put this additional 
                      // logic inside a post_lex handler which should then be 
                      // able to obtain additional look-ahead tokens and queue 
                      // them for later, while using those to inspect and 
                      // adjust the lexer output now -- a trick which is used 
                      // in the cockroachDB SQL parser code, for example.
                      //
                      // The above regex solution however is a more local 
                      // extra-lookahead solution and thus should cost us less 
                      // overhead than the suggested post_lex alternative, but 
                      // it comes at a cost itself: complex regex and 
                      // duplication of language knowledge in the lexer itself, 
                      // plus inclusion of *grammar* (syntactic) knowledge in 
                      // the lexer too, where it doesn't belong in an ideal 
                      // world...
                      console.log('percent: ', yytext);
                      return '%';

<PERCENT_ALLOWED>.                     
                      this.popState(); 
                      this.unput(yytext); 
                      // this.unput(yytext); can be used here instead of 
                      // this.reject(); which would only work when we set the 
                      // backtrack_lexer option


\s+                   /* skip whitespace */

[0-9]+("."[0-9]+)?\b  
                      this.pushState('PERCENT_ALLOWED'); 
                      return 'NUMBER';

"*"                   return '*';
"/"                   return '/';
"-"                   return '-';
"+"                   return '+';
"^"                   return '^';
"!"                   return '!';
"%"                   return 'MOD';
"("                   return '(';
")"                   return ')';
"PI"                  return 'PI';
"E"                   return 'E';
<<EOF>>               return 'EOF';
.                     return 'INVALID';

/lex





/* operator associations and precedence */

%left '+' '-'
%left MOD '*' '/'
%right '^'                  // it really doesn't matter, but we ASSUME most expressions with chained power expressions, e.g. `10^3^2`, have the nearer-to-one(1) integer? values, which makes us guess it's slightly better, given the restrictions of floating point accuracy, to calculate the uppermost power part first, i.e. `3^2` instead of `10^3` in the given example.
%right '!'
%right '%'

%token INVALID



%start expressions

%options parser-errors-are-recoverable lexer-errors-are-recoverable



%% /* language grammar */



expressions
    : e EOF
        {
          print('### expression result:', $1);

          // No need to `return $1;`: the value is automatically carried to the outside
          // (UNLESS it is 'undefined', in which case the parser is assumed
          // to be a recognizer, but that is not the case here!)
          $$ = $1;
        }
    | e error EOF
        {
            //print('~~~ (...) error: ', { '$1': $1, '#1': #1, yytext: yytext, '$$': $$, '@$': @$, token: parser.describeSymbol(#$), 'yystack': yystack, 'yyvstack': yyvstack, 'yylstack': yylstack, last_error: yy.lastErrorMessage});
            print('~~~', parser.describeSymbol(#error), ' error: ', { '$1': $1, '$2': typeof $2, yytext: yytext, '@error': @error, token: parser.describeSymbol(#error)}, yy.lastErrorMessage);
            yyerrok;
            yyclearin;
            $$ = $e + 3;
            // ^-- every error recovery rule in this grammar adds a different value 
            // so we can track which error rule(s) were executed during the parse
            // of (intentionally) erroneous test expressions.
            print($1, $2, $3, '==>', $$);
        }
    ;

e
    : e '+' e
        {
            $$ = $1 + $3;
            print($1, $2, $3, '==>', $$);
        }
    | e '-' e
        {
            $$ = $1 - $3;
            print($1, $2, $3, '==>', $$);
        }
    | m
    ;

m
    : m MOD m
        {
            $$ = $1 % $3;
            print($1, $2, $3, '==>', $$);
        }
    | m '/' m
        {
            $$ = $1 / $3;
            print($1, $2, $3, '==>', $$);
        }
    | m '*' m
        {
            $$ = $1 * $3;
            print($1, $2, $3, '==>', $$);
        }
    | p
    ;

p
    : p '^' p
        {
            $$ = Math.pow($1, $3);
            print($1, $2, $3, '==>', $$);
        }
    | u
    ;

u
    :  u '!'                                    // 'factorial'
        {
            $$ = (function fact(n) {
                n = Math.max(0, n | 0);
                var rv = 1;
                for (var i = 2; i <= n; i++) {
                    rv *= i;
                }
                return rv;
            })($u);
            print($1, $2, '==>', $$);
        }
    | '!' u                                     // 'not'
        {
            $$ = ($u ? 0 : 1);
            print($1, $2, '==>', $$);
        }
    // the PERCENT `%` operator only accepts direct values with optional sign:
    | NUMBER '%'
        {
            $$ = $NUMBER / 100;
            print($1, $2, '==>', $$);
        }
    | '-' u     // doesn't need the `%prec UMINUS` tweak as the grammar ruleset enforces the precedence implicitly
        {
            $$ = -$u;
            print($1, $2, '==>', $$);
        }
    | '+' u     // doesn't need the `%prec UMINUS` tweak as the grammar ruleset enforces the precedence implicitly
        {
            $$ = $u;
            print($1, $2, '==>', $$);
        }
    | '(' e ')'
        {
            $$ = $2;
            print($1, $2, $3, '==>', $$);
        }
    | v
    ;

v
    : NUMBER
        {
            $$ = Number(yytext);
            print($1, '==>', $$);
        }
    | E
        {
            $$ = Math.E;
            print($1, '==>', $$);
        }
    | PI
        {
            $$ = Math.PI;
            print($1, '==>', $$);
        }
    | error
        {
            //print('~~~ (...) error: ', { '$1': $1, '#1': #1, yytext: yytext, '$$': $$, '@$': @$, token: parser.describeSymbol(#$), 'yystack': yystack, 'yyvstack': yyvstack, 'yylstack': yylstack, last_error: yy.lastErrorMessage});
            print('~~~', parser.describeSymbol(#$), ' error: ', { '$1': typeof $1, yytext: yytext, '@$': @$, token: parser.describeSymbol(#$), 'yyvstack': yyvstack }, yy.lastErrorMessage, yy.lastErrorHash.token, yysp);
            yyerrok;
            //yyclearin;
            $$ = 5;         
            // ^-- every error recovery rule in this grammar adds a different value 
            // so we can track which error rule(s) were executed during the parse
            // of (intentionally) erroneous test expressions.
            print($1, '==>', $$);
        }
    ;





// ----------------------------------------------------------------------------------------

%%

// feature of the GH fork: specify your own main.
//
// compile with
//
//      jison -o test.js --main that/will/be/me.jison
//
// then run
//
//      node ./test.js
//
// to see the output.

var assert = require("assert");


var print = (typeof console !== 'undefined' ? function __print__() {
    console.log.apply(null, ['  '].concat(Array.prototype.slice.call(arguments, 0)));
} : function __dummy__() {});










parser.pre_parse = function (yy) {
    print("parsing: ", yy.lexer.upcomingInput(-1 /* i.e. produce the entire (unparsed) input string */));

    parser.lexer.options.post_lex = function (token) {
        print("lex() ==> ", token, '[' + this.yytext + ']', parser.describeSymbol(token));
    };
};



if (0) {
    parser.trace = function () {
        print.apply(null, ['TRACE: '].concat(Array.prototype.slice.call(arguments, 0)));
    };
}



parser.yy.parseError = function parseError(str, hash, ExceptionClass) {
    assert(hash.yy);
    assert(this);
    assert(this !== parser.yy);
    assert(this === hash.yy.parser || this === hash.yy.lexer);
    if (hash.recoverable) {
        hash.yy.parser.trace(str);
        hash.yy.lastErrorMessage = str;
        hash.yy.lastErrorHash = hash;
    } else {
        console.error(str, hash && hash.exception);
        throw new ExceptionClass(str, hash);
    }
};



%include benchmark.js




parser.main = function () {
    print("Running benchmark...");
    var t1 = perf.start();

    var basenum = 1;

    function test() {
        const formulas_and_expectations =  [
            basenum + '+2*(3-5--+--+6!)-7/-8%',                      1523.5 + basenum,
            basenum + '+2*0.7%^PI^2+4+5',                              9 + basenum, /* this bets on JS floating point calculations discarding the small difference with this integer value... */
            basenum + '+(2+3*++++)+5+6+7+8+9 9',                     55 + basenum, // with error recovery and all it gives you a value...
            basenum + '+2*(3!-5!-6!)/7/8',                           -29.785714285714285 + basenum,
        ];

        basenum++;

        for (var i = 0, len = formulas_and_expectations.length; i < len; i += 2) {
            var formula = formulas_and_expectations[i];
            var expectation = formulas_and_expectations[i + 1];

            var rv = parser.parse(formula);
            print("'" + formula + "' ==> ", rv, "\n");
            assert.equal(rv, expectation);
        }
        return formulas_and_expectations.length / 2;
    }

    if (0) {
        print = function dummy() {};
    }
    if (01) {
        test();
    } else {
        bench(test);
    }

    // if you get past the assert(), you're good.
    print("tested OK @", r(perf.mark(), 2), " ms");
};

