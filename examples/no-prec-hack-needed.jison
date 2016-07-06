
/* 
 * description: Parses and executes mathematical expressions. 
 * Self-contained example which runs a series of tests in a performance benchmark: 
 * see main() at the bottom 
 *
 * At the same time the grammar exhibits error recovery rules which cause 
 * conflicts, despite of which we get a working grammar (because we don't
 * worry when a conflict occurs where only error rules are involved...)

    $ ./lib/cli.js -c 0 --main examples/no-prec-hack-needed.jison
        Conflict in grammar: multiple actions possible when lookahead token is EOF in state 3
        - reduce by rule: v -> error
        - shift token (then go to state 17)
          (Resolved S/R conflict: shift by default.)
        Conflict in grammar: multiple actions possible when lookahead token is ) in state 27
        - reduce by rule: v -> error
        - shift token (then go to state 34)
          (Resolved S/R conflict: shift by default.)

        States with conflicts:

        State 3    (EOF @ v -> error .)

          expressions -> error .EOF              #lookaheads= [$end]
          v -> error .                           #lookaheads= [%]  [!]  [/]  [*]  [EOF]  [+]  [-]  [^]

        State 27    () @ v -> error .)

          u -> ( error .)                        #lookaheads= [^]  [-]  [+]  [EOF]  [*]  [/]  [!]  [%]  [)]
          v -> error .                           #lookaheads= [%]  [!]  [/]  [*]  [)]  [+]  [-]  [^]


        JISON output for module [noPrecHackNeeded] has been written to file: no-prec-hack-needed.js

    $ node no-prec-hack-needed.js
        Time: total:  4995ms , sample_count: 177 , # runs: 35400 , average: 0.1411ms , deviation: 2.96% , peak_de
        viation: 31.28%

    $ node -v
        v6.1.0

 */



/* lexical grammar */
%lex
%%

\s+                   /* skip whitespace */
[0-9]+("."[0-9]+)?\b  return 'NUMBER';
"*"                   return '*';
"/"                   return '/';
"-"                   return '-';
"+"                   return '+';
"^"                   return '^';
"!"                   return '!';
"%"                   return '%';
"("                   return '(';
")"                   return ')';
"PI"                  return 'PI';
"E"                   return 'E';
<<EOF>>               return 'EOF';
.                     return 'INVALID';

/lex

/* operator associations and precedence */

%left '+' '-'
%left '*' '/'
%right '^'                  // it really doesn't matter, but we ASSUME most expressions with chained power expressions, e.g. `10^3^2`, have the nearer-to-one(1) integer? values, which makes us guess it's slightly better, given the restrictions of floating point accuracy, to calculate the uppermost power part first, i.e. `3^2` instead of `10^3` in the given example.
%right '!'
%right '%'

%token INVALID

%start expressions

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
    | error EOF
        {
            //print('~~~ (...) error: ', { '$1': $1, '#1': #1, yytext: yytext, '$$': $$, '@$': @$, token: parser.describeSymbol(#$), 'yystack': yystack, 'yyvstack': yyvstack, 'yylstack': yylstack, last_error: yy.lastErrorMessage});
            print('~~~', parser.describeSymbol(#$), ' error: ', { '$1': $1, yytext: yytext, '@$': @$, token: parser.describeSymbol(#$)}, yy.lastErrorMessage);
            yyerrok;
            yyclearin;
            $$ = 1;
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
    : m '*' m
        {
            $$ = $1 * $3;
            print($1, $2, $3, '==>', $$);
        }
    | m '/' m
        {
            $$ = $1 / $3;
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
    :  u '!'
        {{
            $$ = (function fact(n) {
                return n == 0 ? 1 : fact(n - 1) * n;
            })($u);
            print($1, $2, '==>', $$);
        }}
    | u '%'
        {
            $$ = $u / 100;
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
    | '(' error ')'
        {
            //print('~~~ (...) error: ', { '$1': $1, '#1': #1, yytext: yytext, '$$': $$, '@$': @$, token: parser.describeSymbol(#$), 'yystack': yystack, 'yyvstack': yyvstack, 'yylstack': yylstack, last_error: yy.lastErrorMessage});
            print('~~~', parser.describeSymbol(#$), ' error: ', { '$1': $1, yytext: yytext, '@$': @$, token: parser.describeSymbol(#$)}, yy.lastErrorMessage);
            yyerrok;
            yyclearin;
            $$ = 1;
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
            print('~~~', parser.describeSymbol(#$), ' error: ', { '$1': $1, yytext: yytext, '@$': @$, token: parser.describeSymbol(#$)}, yy.lastErrorMessage);
            yyerrok;
            yyclearin;
            $$ = 1;
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



/**
 * Provide a generic performance timer, which strives to produce highest possible accuracy time measurements.
 * 
 * methods:
 * 
 * - `start()` (re)starts the timer and 'marks' the current time for ID="start". 
 *   `.start()` also CLEARS ALL .mark_delta() timers!
 *
 * - `mark(ID)` calculates the elapsed time for the current timer in MILLISECONDS (floating point) 
 *   since `.start()`. `.mark_delta()` then updates the 'start/mark time' for the given ID.
 *
 *   ID *may* be NULL, in which case `.mark()` will not update any 'start/mark time'.
 *    
 * - `mark_delta(ID, START_ID)` calculates the elapsed time for the current timer in MILLISECONDS (floating point) since 
 *   the last call to `.mark_delta()` or `.mark()` with the same ID. `.mark_delta()` then updates the 
 *   'start/mark time' for the given ID.
 *
 *   When the optional START_ID is specified, the delta is calculated against the last marked time 
 *   for that START_ID.
 *
 *   When the ID is NULL or not specified, then the default ID of "start" will be assumed.
 *   
 *   This results in consecutive calls to `.mark_delta()` with the same ID to produce 
 *   each of the time intervals between the calls, while consecutive calls to
 *   `.mark()` with he same ID would produce an increase each time instead as the time 
 *   between the `.mark()` call and the original `.start()` increases.
 * 
 * Notes:
 * 
 * - when you invoke `.mark()` or `.mark_delta()` without having called .start() before, 
 *   then the timer is started at the mark.
 * 
 * - `.start()` will erase all stored 'start/mark times' which may have been
 *   set by `.mark()` or `.mark_delta()` before -- you may call `.start()` multiple times for
 *   the same timer instance, after all.
 * 
 * - you are responsible to manage the IDs for `.mark()` and `.mark_delta()`. The ID MUST NOT be "start" 
 *   as ID = "start" identifies the .start() timer.
 * 
 * References for the internal implementation:
 * 
 *    - http://updates.html5rocks.com/2012/08/When-milliseconds-are-not-enough-performance-now
 *    - http://ejohn.org/blog/accuracy-of-javascript-time/
 *
 * @class 
 * @constructor
 */
function PerformanceTimer() {
  /* @private */ var start_time = false;
  var obj = {
  };
  // feature detect:
  /* @private */ var f, tv;
  /* @private */ var p = (typeof window !== 'undefined' && window.performance);
  if (p && p.timing.navigationStart && p.now) {
    f = function () {
      return p.now();
    };
  } else if (p && typeof p.webkitNow === 'function') {
    f = function () {
      return p.webkitNow();
    };
  } else {
    p = (typeof process !== 'undefined' && process.hrtime);
    if (typeof p === 'function') {
      tv = p();
      if (tv && tv.length === 2) {
        f = function () {
          var rv = p();
          return rv[0] * 1e3 + rv[1] * 1e-6;
        };
      } 
    } 
    if (!f) {
      f = function () {
        return Date.now();
      };
      try {
        f();
      } catch (ex) {
        f = function () {
          return +new Date();
        };
      }
    }
  }

  obj.start = function () {
    start_time = {
      start: f()
    };
    return obj;
  };
  
  obj.mark = function (id, start_id) {
    if (start_time === false) this.start();
    var end_time = f();
    var begin_time = start_time[start_id || id || "start"];
    if (!begin_time) {
      begin_time = end_time;
    }
    var rv = end_time - begin_time;
    if (id) {
      start_time[id] = end_time;
    }
    return rv;
  };
  
  obj.mark_delta = function (id) {
    if (start_time === false) this.start();
    id = id || "start";
    var end_time = f();
    var begin_time = start_time[id];
    if (!begin_time) {
      begin_time = end_time;
    }
    var rv = end_time - begin_time;
    start_time[id] = end_time;
    return rv;
  };
  
  obj.reset_mark = function (id) {
    id = id || "start";
    start_time[id] = null;
    return obj;
  };

  obj.get_mark = function (id) {
    id = id || "start";
    return start_time[id];
  };

  obj.mark_sample_and_hold = function (id) {
    if (start_time === false) this.start();
    id = id || "start";
    // sample ...
    var end_time = f();
    var begin_time = start_time[id];
    if (!begin_time) {
      begin_time = end_time;
      // ... and hold
      start_time[id] = begin_time;
    }
    var rv = end_time - begin_time;
    return rv;
  };

  return obj;
}

var perf = PerformanceTimer();







parser.pre_parse = function (yy) {
    print("parsing: ", yy.lexer.upcomingInput(-1 /* i.e. produce the entire (unparsed) input string */));

    parser.lexer.options.post_lex = function (token) {
        print("lex() ==> ", token, '[' + this.yytext + ']', parser.describeSymbol(token));
    };
};



//parser.trace = function () {
//    print.apply(null, ['TRACE: '].concat(Array.prototype.slice.call(arguments, 0)));
//};



parser.yy.parseError = function parseError(str, hash) {
    assert(hash.yy);
    assert(this.yy);
    assert(this.yy !== hash.yy);
    if (hash.recoverable) {
        this.trace(str);
        hash.yy.lastErrorMessage = str;
    } else {
        console.error(str, hash && hash.exception);
        throw new this.JisonParserError(str, hash);
    }
};





// round to the number of decimal digits:
function r(v, n) {
    var m = Math.pow(10, n | 0);
    v *= m;
    v = Math.round(v);
    return v / m;
}

function bench(f, n) {
    var factor = 50;
    const run = 1;         // factor of 50 !  
    n = n | 0;
    n /= run;
    n = n | 0;
    n = Math.max(n, 10); // --> minimum number of tests: 10*run*factor
    perf.mark('monitor');

    // get the number of tests internal to the test function: 1 or more
    factor *= f();

    var ts = [];
    for (var i = 0; i < n; i++) {
        perf.mark('bench');
        for (var j = 0; j < run; j++) {
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
        }
        ts.push(perf.mark('bench'));
        var consumed = perf.mark_sample_and_hold('monitor');
        //console.log('consumed', consumed, ts[ts.length - 1], i);
        if (consumed < 5000) {
            // stay in the loop until 5 seconds have expired!:
            i = Math.min(i, n - 2);
        }
    }

    var sum = 0;
    for (var i = 0, cnt = ts.length; i < cnt; i++) {
        sum += ts[i];
    }
    var avg = sum / cnt;

    var dev = 0;
    var peak = 0;
    for (var i = 0; i < cnt; i++) {
        var delta = Math.abs(ts[i] - avg);
        dev += delta;
        peak = Math.max(peak, delta);
    }
    dev /= cnt;
    var sample_size = run * factor;
    console.log("Time: total: ", r(sum, 0) + 'ms',
        ", sample_count:", cnt,
        ", # runs:", cnt * sample_size,
        ", average:", r(avg / sample_size, 4) + 'ms',
        ", deviation:", r(100 * dev / avg, 2) + '%',
        ", peak_deviation:", r(100 * peak / avg, 2) + '%'
    );
}

parser.main = function () {
    print("Running benchmark...");
    var t1 = perf.start();

    var basenum = 1;

    function test() {
        const formulas_and_expectations =  [
            basenum + '+2*(3-5--+--+6!)-7/-8%',                      1523.5 + basenum,
            basenum + '+2*E%^PI^2+4+5',                              9 + basenum, /* this bets on JS floating point calculations discarding the small difference with this integer value... */
            basenum + '+(2+3*++++)+5+6+7+8+9 9',                     32 + basenum, // with error recovery and all it gives you a value...
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

    print = function dummy() {};
    bench(test);

    // if you get past the assert(), you're good.
    print("tested OK @", r(perf.mark(), 2), " ms");
};

