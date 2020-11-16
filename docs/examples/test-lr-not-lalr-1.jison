/*
 * From http://stackoverflow.com/questions/8496065/why-is-this-lr1-grammar-not-lalr1 / http://compilers.iecc.com/comparch/article/95-02-053 :
 * 
 * > holzmuel@kafka.informatik.uni-stuttgart.de (Bernd Holzmueller) writes:
 * > > Does anybody know of a concrete example of an LALR(1)-conflict in an existing
 * > > (or hypothetical but semantically meaningful) programming language grammar
 * > > which is *exactly* LALR(1), i.e. the conflict is solved by moving to LR(1)?
 * > 
 * > 
 * > The following grammar is the classic example of an LR(1) grammar that
 * > is not LALR(1):
 * > 
 * > 
 * >         S -> aEa | bEb | aFb | bFa
 * >         E -> e
 * >         F -> e
 * > 
 * > 
 * > This does not, however, translate directly into a common programming
 * > language parsing problem. These days language designers tend to make
 * > their grammars LALR(1) consistent in order to facilitate implementation,
 * > and so the problem will not occur in ordinary situations.
 * > 
 * > I can remember having an LALR(1) inconsistency in a grammar I was
 * > developing, and I was certain that it would be LR(1) consistent,
 * > but since I did not have an LR(1) parser generator to test my theory, I
 * > did not pursue it further. You might try to look for such an
 * > inconsistency in the published grammar for Modula-3 [Cardelli, et al.,
 * > "Modula-3 Language Definition", ACM SIGPLAN Notices, V.27, #8, Aug
 * > 1992]. It seems to have every other conceivable kind of inconsistency. :-)
 * > 
 * > --- 
 * > 
 * > Let's begin by constructing LR(1) configuration sets for the grammar:
 * > 
 * > ``` 
 * >  (1)
 * >  S' -> .S [$]
 * >  S  -> .aEa [$]
 * >  S  -> .aFb [$]
 * >  S  -> .bFa [$]
 * >  S  -> .bEb [$]
 * > 
 * >  (2)
 * >  S' -> S. [$]
 * > 
 * >  (3)
 * >  S  -> a.Ea [$]
 * >  S  -> a.Fb [$]
 * >  E  -> .e   [a]
 * >  F  -> .e   [b]
 * > 
 * >  (4)
 * >  E  -> e.   [a]
 * >  F  -> e.   [b]
 * > 
 * >  (5)
 * >  S  -> aE.a [$]
 * > 
 * >  (6)
 * >  S  -> aEa. [$]
 * > 
 * >  (7)
 * >  S  -> aF.b [$]
 * > 
 * >  (8)
 * >  S  -> aFb. [$]
 * > 
 * >  (9)
 * >  S  -> b.Fa [$]
 * >  S  -> b.Eb [$]
 * >  E  -> .e   [b]
 * >  F  -> .e   [a]
 * > 
 * >  (10)
 * >  E  -> e.   [b]
 * >  F  -> e.   [a]
 * > 
 * >  (11)
 * >  S  -> bF.a [$]
 * > 
 * >  (12)
 * >  S  -> bFa. [$]
 * > 
 * >  (13)
 * >  S  -> bE.b [$]
 * > 
 * >  (14)
 * >  S  -> bEb. [$]
 * >  
 * > If you'll notice, states (4) and (10) have the same core, so in the 
 * > LALR(1) automaton we'd merge them together to form the new state
 * > 
 * >  (4, 10)
 * >  E -> e. [a, b]
 * >  F -> e. [a, b]
 * > ``` 
 * > 
 * > Which now has a reduce/reduce conflict in it (all conflicts in LALR(1) 
 * > that weren't present in the LR(1) parser are reduce/reduce, by the way). 
 * > This accounts for why the grammar is LR(1) but not LALR(1).
 * > 
 * > --- 
 * > 
 * > From http://compilers.iecc.com/comparch/article/95-02-056 :
 * > 
 * > The example given has become the standard example. It has the drawback
 * > of being too simple. This example has misled many people into thinking
 * > that it should be easy to write fast state-splitting algorithms for
 * > LR(1)-parser generation. To get an idea how hard the problem really is,
 * > read the paper:
 * > 
 * > David Pager, "On the Incremental Approach to Left-to-right Parsing",
 * > Tech. Report PE 238, Information and Computer Sciences Dept., 
 * > University of Hawaii, 1972
 * > 
 * > Sincerely,
 * > 
 * > Bob Corbett
 * > 
 */


%options module-name=bison_bugger


%lex

%options ranges

%%

\s+                   /* skip whitespace */
a                     return 'a';
b                     return 'b';
c                     return 'c';
d                     return 'd';
';'                   return ';';
':'                   return ':';
','                   return ',';
'+'                   return '+';
'-'                   return '-';
'='                   return '=';
'('                   return '(';
')'                   return ')';
'['                   return '[';
']'                   return ']';
.                     return 'ERROR';

/lex




%token a b c d

%%

S → a E a 
  | b E b  
  | a F b  
  | b F a
  ;

E → e;

F → e;


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

parser.main = function () {
    var rv = parser.parse('a+b');
    console.log("test #1: 'a+b' ==> ", rv, parser.yy);
    assert.equal(rv, '+aDabX:a');

    rv = parser.parse('a-b');
    console.log("test #2: 'a-b' ==> ", rv);
    assert.equal(rv, 'XE');

    console.log("\nAnd now the failing inputs: even these deliver a result:\n");

    // set up an aborting error handler which does not throw an exception
    // but returns a special parse 'result' instead:
    var errmsg = null;
    var errReturnValue = '@@@';
    parser.yy.parseError = function (msg, hash) {
        errmsg = msg;
        return errReturnValue + (hash.parser ? hash.value_stack.slice(0, hash.stack_pointer).join('.') : '???');
    };

    rv = parser.parse('aa');
    console.log("test #3: 'aa' ==> ", rv);
    assert.equal(rv, '@@@.T.a');

    rv = parser.parse('a');
    console.log("test #4: 'a' ==> ", rv);
    assert.equal(rv, '@@@.a');

    rv = parser.parse(';');
    console.log("test #5: ';' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('?');
    console.log("test #6: '?' ==> ", rv);
    assert.equal(rv, '@@@');

    rv = parser.parse('a?');
    console.log("test #7: 'a?' ==> ", rv);
    assert.equal(rv, '@@@.a');

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

