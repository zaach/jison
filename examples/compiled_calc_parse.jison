//
// Stage 1 parser: 'The Front End'
//
// This one represents the classic textbook 'parser/tokenizer' frontend:
// converting input text stream to AST (Abstract Syntax Tree) / tokens,
// a.k.a. IR (Intermediate Representation).
//
// We create an AST as an *array* rather than a tree (less objects to
// create and update).
//
// We can use an array to carry a full-fledged AST as this is the
// 'pre-order traversal' (https://en.wikipedia.org/wiki/Tree_traversal)
// representation of said (theoretic) AST.
//
// Ergo we get an array which looks suspiciously like it's carrying
// tokenized math expressions in Polish Notation (https://en.wikipedia.org/wiki/Polish_notation)
// which has the known benefit of not requiring storing info about
// any priority reversal (https://en.wikipedia.org/wiki/Order_of_operations)
// as you would with 'infix notation': the `(...)` braces around
// sub-expressions.
//
// Of course, nothing is as trivial as it seems, because there still is
// a problem which doesn't show up in theory but does in practice: when you
// perform calculations, the order of execution of theoretically fully
// associative operator sequences IS important.
// (https://www.mathsisfun.com/associative-commutative-distributive.html)
// Here's an example:
//
// ```
// A=1
// B=1e17 + 1e9
// C=1e17 - 1e9
//
// A+(B-C)   --> (B-C) => 2e9,    A+. => 2000000001
// A+B-C     --> A+B => 1e17+1e9, .-C => 2000000000
// ```
//
// What you observe here is floating point accuracy loss due to the limited
// size of the mantissa. Consequently, we must realize that any seemingly
// 'superfluous braces' used in the formula MUST be preserved and recreated
// when we wish to re-print/format/display the given AST (formula) via the
// `compiled_calc_print.jison` tree-walking backend grammar: associative
// operators do have a preferred (default) order of execution and any AST
// we create carrying a non-default order of execution must be recognized
// as such by the backend grammars ('code generators'): compile_calc_exec and
// compile_calc_print.
//
// ASTs for the above example:
//
// ```
// A+(B-C)   --> +A-BC
// A+B-C     --> -+ABC
// ```
//
// And here's another example, using only a single operator (`+` addition):
//
// ```
// A=1
// B=+1e17 + 1e9
// C=-1e17 + 1e9
//
// A+(B+C)   --> (B+C) => 2e9,    A+. => 2000000001
// A+B+C     --> A+B => 1e17+1e9, .+C => 2000000000
// ```
//
// ASTs for the above example:
//
// ```
// A +1 (B +2 C)   --> +1A+2BC
// A +1 B +2 C     --> +2+1ABC
// ```
//
// The default vs. non-default order of execution effect on AST tree inbalance
// is maybe easier to observe when we start with a symmetric tree:
//
// ```
// (A +1 B) +2 (C +3 D)  -->                  [[ +2 ]]
//                                            /      \
//                                          [+1]    [+3]
//                                          /  \    /  \
//                                         A    B  C    D
// --> +2 +1 A B +3 C D
//
// A +1 B +2 C +3 D -->
//  (using a left-recursive grammar, representing left-associativity)
// --> +3 +2 +1 A B C D
//                                            [[+3]]
//                                            /    \
//                                          [+2]    D
//                                          /  \
//                                        [+1]  C
//                                        /  \
//                                       A    B
//
// ...ditto... -->
//  (using a right-recursive grammar, representing right-associativity,
//   which is the only associativity type easily constructed in top-down parsers,
//   either hand-coded or LL(k)-generator based. LR/LALR doesn't suffer from this problem!)
// --> +1 +2 +3 A B C D
//                                            [[+1]]
//                                            /    \
//                                          [+2]    D
//                                          /  \
//                                        [+3]  C
//                                        /  \
//                                       A    B
//
//
// Hence when we encounter a left child of an AST node which carries a
// mutually associative operator (`+` or `-`, etc.), then we are looking at
// a probably enforced order of execution due to extra `(..)` braces.
// THAT of course assumes you've got your grammar set up properly and set
// up your `%left`/`%right` token associativity to help JISON cope with rules
// which specify *both* associativities via left-and-right recursion in
// the grammar -- like the grammar should below!
//



%import symbols  "compiled_calc_AST_symbols.json5"




%lex

//%options flex
%options case-insensitive
//%options xregexp
//%options backtrack_lexer
//%options ranges
%options easy_keyword_rules


%%

// 1.0e7
[0-9]+\.[0-9]*(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// .5e7
[0-9]*\.[0-9]+(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// 5 / 3e4
[0-9]+(?:[eE][-+]*[0-9]+)?\b
                      %{
                        yytext = parseFloat(yytext);
                        return 'NUM';
                      %}

// reserved keywords:
'and'                 return 'AND';
'or'                  return 'OR';
'xor'                 return 'XOR';
'not'                 return 'NOT';
'if'                  return 'IF';
'then'                return 'THEN';
'else'                return 'ELSE';


// accept variable names with dots in them, e.g. `store.item`:
[a-zA-Z_$]+[a-zA-Z_0-9.$]*\b
                      %{
                        var rv = lookup_constant(yytext);
                        if (rv) {
                          yytext = rv;
                          return 'CONSTANT';
                        }
                        rv = lookup_function(yytext);
                        if (rv) {
                          yytext = rv;
                          return 'FUNCTION';
                        }
                        rv = lookup_or_register_variable(yytext);
                        yytext = rv;
                        return 'VAR';
                      %}

\/\/.*                yytext = yytext.substr(2).trim(); return 'COMMENT'; // skip C++-style comments
\/\*[\s\S]*?\*\/      yytext = yytext.substring(2, yyleng - 2).trim(); return 'COMMENT'; // skip C-style multi-line comments

'==='                   return 'EQ';
'=='                    return 'EQ';
'!='                    return 'NEQ';
'<='                    return 'LEQ';
'>='                    return 'GEQ';

'||'                    return 'OR';
'^^'                    return 'XOR';
'&&'                    return 'AND';

'**'                    return 'POWER';    /* Exponentiation        */

'<'                     return 'LT';
'>'                     return 'GT';

'='                     return '=';
'-'                     return '-';
'+'                     return '+';
'*'                     return '*';
'/'                     return '/';
'('                     return '(';
')'                     return ')';
','                     return ',';
'!'                     return '!';
'%'                     return '%';
'~'                     return '~';

'?'                     return '?';                         // IF
':'                     return ':';                         // ELSE

'|'                     return '|';
'^'                     return '^';
'&'                     return '&';


\\[\r\n]                // accept C-style line continuation: ignore this bit.

[\r\n]                  return 'EOL';

[^\S\r\n]+              // ignore whitespace

<<EOF>>                 return 'EOF';
.                       return 'INVALID';


/lex



%token      NUM             // Simple double precision number
%token      VAR FUNCTION    // Variable and Function
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E
%token      ERROR           // Mark error in statement
%token      COMMENT         // A line (or multiple lines) of comment

%token      END             // token to mark the end of a function argument list in the output token stream
%token      FUNCTION_0      // optimization: function without any input parameters
%token      FUNCTION_1      // optimization: function with one input parameter
%token      FUNCTION_2      // optimization: function with two input parameters
%token      FUNCTION_3      // optimization: function with three input parameters

%token      THEN
%token      IF_ELSE         // token signals this is an IF with an ELSE in the resulting AST stream

%left       ELSE            // resolve shift/reduce conflict in IF/ELSE vs IF-without-ELSE by giving ELSE precedence over IF
%left       IF


%right      '='

%left       '?' ':'

%left       XOR
%left       OR
%left       AND
%left       NOT

%right      EQ NEQ GEQ LEQ GT LT

%left       '^'
%left       '|'
%left       '&'

%left       '-' '+'
%left       '*' '/' '%'
%right      POWER
%right      '~'
%right      '!'
%right      FACTORIAL
%right      UMINUS     /* Negation--unary minus */
%right      UPLUS      /* unary plus */
%right      PERCENT    /* unary percentage */

%nonassoc   '(' ')'



/* Grammar follows */

%start input


%ebnf


//%options on-demand-lookahead    // camelCased: option.onDemandLookahead -- WARNING: using this has a negative effect on your error reports: a lot of 'expected' symbols are reported which are not in the real FOLLOW set!
%options no-default-action      // JISON shouldn't bother injecting the default `$$ = $1` action anywhere!
%options no-try-catch           // we assume this parser won't ever crash and we want the fastest Animal possible! So get rid of the try/catch/finally in the kernel!

// allow the parser to eat up to 42 tokens while it's trying to recover from a parse error 
// (jison/yacc default = 3, but you get much less parseError calls when the sh*t really hits the fan 
// and you did set up with such a high number...)
%options error-recovery-token-discard-count=42

%parse-param globalSpace        // extra function parameter for the generated parse() API; we use this one to pass in a reference to our workspace for the functions to play with.



%%


/*
 * When you go and look at the grammar below, do note that the token stream is
 * produced as a 'Polish Notation' simile: `<operator> <arg> <arg> ...`: this
 * has several benefits, not the least of which is that we can do away with
 * 'precedence overrides' in math expressions: no more `()` brackets!
 *
 * Also do note that we're outputting **Polish Notation**, rather than
 * **Reverse Polish Notation**: Polish Notation has the characteristic
 * that the **operator**, i.e. the 'opcode/command' comes before anything
 * else that's related, which is just perfect when you wish to produce
 * the fastest possible bottom-up tree walker: since we use jison to
 * generate our tree walkers for us via the simplest and fastest possible
 * LALR(1) grammar to do so, we only get to be *fast* **because** we have
 * chosen to use a *Polish Notation* structure for our AST token stream.
 *
 * [EDIT: scratch the above: Polish Notation is geared towards writing
 * recursive descent walkers, i.e. Polish Notation is good for LL(1)
 * recursive descent based walkers! Reverse Polish Notation is the stuff you want
 * when doing a bottom-up grammar-based walker: you have every `arg`
 * ready and calculated by the time you hit the `opcode`, resulting
 * in a walker which can be shift+reduce based.
 *
 * Now in another set of files we'll show how you take this stuff to
 * the cleaners and do these boys in, using hand-optimized custom-tailored
 * walkers, which only perform *reduce* operations. Of course *those* are
 * only possible when you 'process' the AST token stream into something
 * that doesn't do 'shift' implicitly, like happens in these grammar-based
 * walkers, but instead turns each of those necessary 'shift' operations
 * into a 'reduce' of its own... in a way, at last. ;-)
 * ]
 */


input:
  ( line EOL )*[s] line EOF
                                {
                                  var rv = null;
                                  for (var i = 0, len = $s.length; i < len; i++) {
                                    var line = $s[i][0];
                                    if (!rv) {
                                      rv = line;
                                    } else if (line.length) {
                                      // We MUST signal the end of an expression as otherwise our AST grammar
                                      // will be ambiguous (and thus our tree walkers confused and unable to
                                      // work) as we must be able to differentiate between 'end of function arglist'
                                      // and 'end of statement': since we expect more functions (and thus
                                      // arglist terminations) than statements, we choose to give the FUNCTION
                                      // arglist an implicit termination while the statement gets to have an
                                      // *explicit* termination (#EOL# token) so that we end up with a shorter
                                      // AST stream -- iff our assumption holds in actual use!
                                      //
                                      // NOTE: We only need to add a sentinel when multiple statements (lines)
                                      // are input: when there's only a single statement (line) it'll unambiguously
                                      // terminated by EOF!
                                      if (rv.length) {
                                        rv.push(#EOL#);
                                      }
                                      append.apply(rv, line);
                                    }
                                  }

                                  if (!rv) {
                                    rv = $line;
                                  } else if ($line.length) {
                                    // We MUST signal the end of an expression as otherwise our AST grammar
                                    // will be ambiguous (and thus our tree walkers confused and unable to
                                    // work) as we must be able to differentiate between 'end of function arglist'
                                    // and 'end of statement': since we expect more functions (and thus
                                    // arglist terminations) than statements, we choose to give the FUNCTION
                                    // arglist an implicit termination while the statement gets to have an
                                    // *explicit* termination (#EOL# token) so that we end up with a shorter
                                    // AST stream -- iff our assumption holds in actual use!
                                    //
                                    // NOTE: We only need to add a sentinel when multiple statements (lines)
                                    // are input: when there's only a single statement (line) it'll unambiguously
                                    // terminated by EOF!
                                    if (rv.length) {
                                      rv.push(#EOL#);
                                    }
                                    append.apply(rv, $line);
                                  }

                                  // always make sure the AST stream is terminated by an EOL:
                                  // this makes the treewalker grammars a little easier as then a line is always
                                  // followed by an EOL!
                                  if (rv.length) {
                                    rv.push(#EOL#);
                                  }

                                  $$ = rv;
                                }
;

line:
  ε                             /* empty */
                                { $$ = []; }
| exp
                                {
                                  console.log('line: ', JSON.stringify($exp, null, 2));
                                  $$ = $exp;
                                }
| COMMENT
                                {
                                  $$ = [#COMMENT#, $COMMENT];
                                }
| error
                                {
                                  yyerrok;
                                  yyclearin;
                                  console.log('skipped erroneous input line', typeof yy.lastErrorInfo, $error, yytext, yyleng);
                                  $$ = [#ERROR#, yy.lastErrorInfo.errStr];
                                }
;


exp:
  NUM
                                { $$ = [#NUM, $NUM]; }
| CONSTANT
                                { $$ = [#CONSTANT, $CONSTANT]; }
| VAR
                                { $$ = [#VAR, $VAR]; }
| VAR '='[assign] exp
                                {
                                  /*
                                     Note: #assign is always to a simple variable, hence we don't need the `#VAR`
                                     token here: it is implicit as there's nothing else we can do.

                                     Technically, this is an AST optimization, but it's such a fundamental one
                                     we do it here instead of later.

                                     NOTE: #assign implies the presence of a VAR as lhs (left hand side) so it
                                     would only be cluttering the AST stream to have a #VAR# token in there:
                                     it is *implicit* to #assign!
                                   */
                                  $exp.unshift(#ASSIGN#, $VAR);
                                  $$ = $exp;
                                }
| FUNCTION '(' ')'
                                { $$ = [#FUNCTION_0#, $FUNCTION]; }
| FUNCTION '(' arglist ')'
                                {
                                  /*
                                     See the comment in the statement EOL rule above: to disambiguate a sequence
                                     of exp subtrees, we MUST add a terminator to either or both statement and
                                     function, otherwise the sequence `FUNCTION exp exp` is ambiguous: it could
                                     be:

                                     - a no-args functions and two more statements,
                                     - a single-arg function and one more statement,
                                     - a two-arg function.

                                     Of course, you may argue that adding 'number of arguments' knowledge to the
                                     FUNCTION token would also resolve this issue, and it would, but that would
                                     be a bit harder to encode in an LALR(1) grammar used as the treewalker core.
                                     It is easier to use a sentinel token in one or both spots.

                                     A lot of functions have only a few arguments, which we later optimize in our AST
                                     by including that knowledge in the FUNCTION token by using derivative tokens
                                     FUNCTION_0, FUNCTION_1, etc.: this can help a smart optimizer to include
                                     special optimizations for these functions without having to re-discover
                                     the arglist length.
                                     As that approach already disambiguates the function-versus-statement
                                     situation by having encoded arglist length in the FUNCTION token, these
                                     tokens never require a sentinel token in the AST stream: small AST stream size.

                                     Now we let the optimizer deal with this when the time comes...

                                     Meanwhile, keep it as simple as possible in here!

                                     Also don't forget to FLATTEN the arglist! ==> `concat.apply(a, arglist)`

                                     NOTE: the #FUNCTION# rule in Polish Notation is ambiguous unless we terminate it
                                     (which is easy to parse in an LALR(1) grammar while adding a argument count is not!)
                                     as we would otherwise get confused over this scenario:

                                          ... PLUS FUNCTION exp exp exp ...

                                     - is this a function with one argument and that last `exp` in there the second term
                                       of a binary(?) opcode waiting in the leading `...`?
                                     - is this a function with two arguments and that last `exp` the second
                                       term of the PLUS?
                                     - is this a function with three arguments and is the second term of the PLUS
                                       waiting in the trailing `...`?

                                     This is the trouble with opcodes which accept a variable number of arguments:
                                     such opcodes always have to be terminated by a sentinel to make the AST grammar
                                     unambiguous.

                                     ... On second thought, we can easily apply the FUNCTION_<N> AST optimization
                                     now, and it doesn't impact the AST rule set much, while it opens up other
                                     possibilities...
                                  */
                                  switch ($arglist.length) {
                                  default:
                                    $$ = flatten.apply([#FUNCTION#, $FUNCTION], $arglist);
                                    $$.push(#END#);
                                    break;

                                  case 1:
                                    $$ = flatten.apply([#FUNCTION_1#, $FUNCTION], $arglist);
                                    break;

                                  case 2:
                                    $$ = flatten.apply([#FUNCTION_2#, $FUNCTION], $arglist);
                                    break;

                                  case 3:
                                    $$ = flatten.apply([#FUNCTION_3#, $FUNCTION], $arglist);
                                    break;
                                  }
                                }

| exp EQ exp
                                {
                                  $exp1.unshift(#EQ#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp NEQ exp
                                {
                                  $exp1.unshift(#NEQ#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp LEQ exp
                                {
                                  $exp1.unshift(#LEQ#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp GEQ exp
                                {
                                  $exp1.unshift(#GEQ#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp LT exp
                                {
                                  $exp1.unshift(#LT#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp GT exp
                                {
                                  $exp1.unshift(#GT#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp OR exp
                                {
                                  $exp1.unshift(#OR#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp XOR exp
                                {
                                  $exp1.unshift(#XOR#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp AND exp
                                {
                                  $exp1.unshift(#AND#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }

| exp '|'[bitwise_or] exp
                                {
                                  $exp1.unshift(#BITWISE_OR#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '^'[bitwise_xor] exp
                                {
                                  $exp1.unshift(#BITWISE_XOR#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '&'[bitwise_and] exp
                                {
                                  $exp1.unshift(#BITWISE_AND#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }

| exp '+'[add] exp
                                {
                                  $exp1.unshift(#ADD#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '-'[subtract] exp
                                {
                                  $exp1.unshift(#SUBTRACT#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '*'[multiply] exp
                                {
                                  $exp1.unshift(#MULTIPLY#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '/'[divide] exp
                                {
                                  $exp1.unshift(#DIVIDE#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '%'[modulo] exp
                                {
                                  $exp1.unshift(#MODULO#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| '-' exp             %prec UMINUS
                                {
                                  $exp1.unshift(#UMINUS#);
                                  $$ = $exp1;
                                }
| '+' exp             %prec UPLUS
                                {
                                  $exp1.unshift(#UPLUS#);
                                  $$ = $exp1;
                                }
| exp POWER exp
                                {
                                  $exp1.unshift(#POWER#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
| exp '%'[percent]
                                {
                                  $exp1.unshift(#PERCENT#);
                                  $$ = $exp1;
                                }
| exp '!'[factorial]
                                {
                                  $exp1.unshift(#FACTORIAL#);
                                  $$ = $exp1;
                                }

| '~'[bitwise_not] exp
                                {
                                  $exp1.unshift(#BITWISE_NOT#);
                                  $$ = $exp1;
                                }
| '!'[not] exp
                                {
                                  $exp1.unshift(#NOT#);
                                  $$ = $exp1;
                                }
| NOT exp
                                {
                                  $exp1.unshift(#NOT#);
                                  $$ = $exp1;
                                }

| '(' exp ')'
                                { $$ = $exp; }

| exp '?' exp ':' exp
                                {
                                  // $$ = [#IF_ELSE#].concat($exp1, $exp2, $exp3);
                                  $exp1.unshift(#IF_ELSE#);
                                  append.apply($exp1, $exp2);
                                  append.apply($exp1, $exp3);
                                  $$ = $exp1;
                                }
| IF exp THEN exp ELSE exp
                                {
                                  // $$ = [#IF_ELSE#].concat($exp1, $exp2, $exp3);
                                  $exp1.unshift(#IF_ELSE#);
                                  append.apply($exp1, $exp2);
                                  append.apply($exp1, $exp3);
                                  $$ = $exp1;
                                }
| IF exp THEN exp
                                {
                                  // $$ = [#IF#].concat($exp1, $exp2);
                                  $exp1.unshift(#IF#);
                                  append.apply($exp1, $exp2);
                                  $$ = $exp1;
                                }
;

arglist:
  exp
                                { $$ = [$exp]; }
| arglist ','[comma] exp
                                {
                                  $$ = $arglist;
                                  $$.push($exp);
                                }
;





/* End of grammar */


%%




// helper functions which will help us reduce garbage production cf. https://www.scirra.com/blog/76/how-to-write-low-garbage-real-time-javascript

// flatten arrays into one:
var flatten = [].concat;

// append array of items:
var append = [].push;

