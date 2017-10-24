//
// Stage 1 parser: 'The Front End'
//
// This one represents the classic textbook 'parser/tokenizer' frontend:
// converting input text stream to AST (Abstract Syntax Tree) / tokens,
// a.k.a. IR (Intermediate Representation).
//
// This parser is very similar to the other parser in compiled_calc_parser.jison:
// This one however is geared towards outputting an AST stream optimal for the
// hand-written bottom-up AST tree walkers in compiled_calc_fast_*.js, hence
// we output a *Reverse Polish Notation* stream rather than a *Polish Notation*
// stream; we keep the stream optimizer (sorcerer2) separate from this parser
// to ensure that we can execute that subprocess independently from this
// parsing process.
//
// --------------------------------------------------------------------------
//
// As we have intimate knowledge of the 'no-shift-ever, reduce-only' AST structure
// used by our hand-optimized subprocesses, we have this parser produce the
// suitable AST for that: we *push* function arguments on the stack so that
// those do not need to be *shifted* any more but are *reduced* in a stack-action
// instead, etc.; this also means the AST 'grammar' employed by this system
// does not suffer from the ambiguity between FUNCTION arglist termination
// and statement ('line') termination, which did exist in the original AST
// grammar and was resolved there with the #END# sentinel token.
//



// one grammar is MASTER for our common symbol set:
%import symbols  "./output/compiled_calc/compiled_calc_parse.js"




// %lex
//
// Inject the lexer from the other parser as they're the same...



%token      NUM             // Simple double precision number
%token      VAR FUNCTION    // Variable and Function
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E
%token      ERROR           // Mark error in statement
%token      COMMENT         // A line (or multiple lines) of comment

%token      FUNCTION_0      // optimization: function without any input parameters
%token      FUNCTION_1      // optimization: function with one input parameter
%token      FUNCTION_2      // optimization: function with two input parameters
%token      FUNCTION_3      // optimization: function with three input parameters
%token      PUSH            // push result of expression on stack: this is another argument being fed to a FUNCTION or binary/ternary math operator

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


//%options on-demand-lookahead            // camelCased: option.onDemandLookahead -- WARNING: using this has a negative effect on your error reports: a lot of 'expected' symbols are reported which are not in the real FOLLOW set!
%options default-action-mode=none,merge   // JISON shouldn't bother injecting the default `$$ = $1` action anywhere!
%options no-try-catch                     // we assume this parser won't ever crash and we want the fastest Animal possible! So get rid of the try/catch/finally in the kernel!

%parse-param globalSpace        // extra function parameter for the generated parse() API; we use this one to pass in a reference to our workspace for the functions to play with.



%%


/*
 * When you go and look at the grammar below, do note that the token stream is
 * produced as a 'Reverse Polish Notation' simile: `<arg> <arg> ... <operator>`: this
 * has several benefits, not the least of which is that we can do away with
 * 'precedence overrides' in math expressions: no more `()` brackets!
 *
 * Also do note that we're outputting **Reverse Polish Notation**, rather than
 * **Polish Notation**: Reverse Polish Notation has the characteristic
 * that the **operator**, i.e. the 'opcode/command' comes after anything
 * else that's related, which is just perfect when you wish to produce
 * the fastest possible (hand-coded) bottom-up tree walker.
 *
 * Reverse Polish Notation is the stuff you want
 * when doing a bottom-up grammar-based walker: you have every `arg`
 * ready and calculated by the time you hit the `opcode`, resulting
 * in a walker which can be shift+reduce based.
 *
 * This is the parser that goes with the hand-optimized custom-tailored
 * walkers.
 *
 * Note: we use *hand-coded/optimized* tree walkers for this parser output,
 * so we have maximum control over our codebase here.
 * We can get them faster by doing a little extra legwork right now:
 * we make every SHIFT *explicit* by writing extra PUSH opcodes
 * into the stream where necessary (thus, in a sense, making it act
 * like another kind of REDUCE operation when you hit PUSH a.k.a. 'shift').
 * (We called this opcode PUSH instead of SHIFT because SHIFT is usually
 * regarded as a *bit-shift* operation on integers in other languages, e.g. C,
 * and PUSH is appropriate because a *shift* action really is nothing else
 * than *pushing* the current value/token onto the stack: hence a 'push'.
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
                                  console.log('skipped erroneous input line', typeof yy.lastErrorInfo);
                                  $$ = [#ERROR#, yy.lastErrorInfo];
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
                                  $exp.push(#ASSIGN#, $VAR);
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

                                     NOTE:
                                     As every arg in the arglist comes with a #PUSH# token, we *might* have opted
                                     to push an extra #POP# token into the stream before the #FUNCTION# token,
                                     but we don't have to as that #POP# is *implicit# in the #FUNCTION# token
                                     (assuming the arglist is non-empty, of course).

                                     Now we let the optimizer deal with this when the time comes...

                                     Meanwhile, keep it as simple as possible in here!

                                     Also don't forget to FLATTEN the arglist! ==> `concat.apply(a, arglist)`

                                     NOTE: the #FUNCTION# rule in Reverse Polish Notation is ambiguous unless we 'terminate' it
                                     (which is easy to parse in an LALR(1) grammar while adding a argument count is not!)
                                     as we would otherwise get confused over this scenario:

                                          ... exp exp exp FUNCTION PLUS ...

                                     - is this a function with one argument and that first `exp` in there the second term
                                       of a binary(?) opcode waiting in the trailing `...`?
                                     - is this a function with two arguments and that first `exp` the second
                                       term of the PLUS?
                                     - is this a function with three arguments and is the second term of the PLUS
                                       hiding in the leading `...`?

                                     This is the trouble with opcodes which accept a variable number of arguments:
                                     such opcodes always have to be terminated by a sentinel to make the AST grammar
                                     unambiguous.

                                     ... On second thought, we can easily apply the FUNCTION_<N> AST optimization
                                     now, and it doesn't impact the AST rule set much, while it opens up other
                                     possibilities... (Also don't forget to POP the last PUSH in the $arglist:
                                     again that is another optimization that simplifies the interpreter and does not
                                     demand the full power of an AST optimizer!)
                                  */
                                  var opcode;
                                  var n = $arglist.length;
                                  switch (n) {
                                  default:
                                    // no #END# sentinel needed as we store the N = number of arguments
                                    // with the #FUNCTION# opcode itself (see further below)
                                    $$ = flatten.apply([], $arglist);
                                    opcode = #FUNCTION_N#;
                                    break;

                                  case 1:
                                    $$ = flatten.apply([], $arglist);
                                    opcode = #FUNCTION_1#;
                                    n = 0;
                                    break;

                                  case 2:
                                    $$ = flatten.apply([], $arglist);
                                    opcode = #FUNCTION_2#;
                                    n = 0;
                                    break;

                                  case 3:
                                    $$ = flatten.apply([], $arglist);
                                    opcode = #FUNCTION_3#;
                                    n = 0;
                                    break;
                                  }
                                  // remove/pop last PUSH:
                                  $$.pop();

                                  $$.push(opcode);
                                  $$.push($FUNCTION);
                                  if (n) {
                                    $$.push(n);
                                  }
                                }

| exp EQ exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#EQ);
                                  $$ = $exp1;
                                }
| exp NEQ exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#NEQ);
                                  $$ = $exp1;
                                }
| exp LEQ exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#LEQ);
                                  $$ = $exp1;
                                }
| exp GEQ exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#GEQ);
                                  $$ = $exp1;
                                }
| exp LT exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#LT);
                                  $$ = $exp1;
                                }
| exp GT exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#GT);
                                  $$ = $exp1;
                                }
| exp OR exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#OR);
                                  $$ = $exp1;
                                }
| exp XOR exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#XOR);
                                  $$ = $exp1;
                                }
| exp AND exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#AND);
                                  $$ = $exp1;
                                }

| exp '|'[bitwise_or] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#BITWISE_OR#);
                                  $$ = $exp1;
                                }
| exp '^'[bitwise_xor] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#BITWISE_XOR#);
                                  $$ = $exp1;
                                }
| exp '&'[bitwise_and] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#BITWISE_AND#);
                                  $$ = $exp1;
                                }

| exp '+'[add] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#ADD#);
                                  $$ = $exp1;
                                }
| exp '-'[subtract] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#SUBTRACT#);
                                  $$ = $exp1;
                                }
| exp '*'[multiply] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#MULTIPLY#);
                                  $$ = $exp1;
                                }
| exp '/'[divide] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#DIVIDE#);
                                  $$ = $exp1;
                                }
| exp '%'[modulo] exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#MODULO#);
                                  $$ = $exp1;
                                }
| '-' exp             %prec UMINUS
                                {
                                  $exp1.push(#UMINUS#);
                                  $$ = $exp1;
                                }
| '+' exp             %prec UPLUS
                                {
                                  $exp1.push(#UPLUS#);
                                  $$ = $exp1;
                                }
| exp POWER exp
                                {
                                  $exp1.push(#PUSH#);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#POWER#);
                                  $$ = $exp1;
                                }
| exp '%'[percent]
                                {
                                  $exp1.push(#PERCENT#);
                                  $$ = $exp1;
                                }
| exp '!'[factorial]
                                {
                                  $exp1.push(#FACTORIAL#);
                                  $$ = $exp1;
                                }

| '~'[bitwise_not] exp
                                {
                                  $exp1.push(#BITWISE_NOT#);
                                  $$ = $exp1;
                                }
| '!'[not] exp
                                {
                                  $exp1.push(#NOT#);
                                  $$ = $exp1;
                                }
| NOT exp
                                {
                                  $exp1.push(#NOT#);
                                  $$ = $exp1;
                                }

| '(' exp ')'
                                { $$ = $exp; }

// NOTE: the jump offsets must be corrected for the offset slot itself and optionally the SKIP instruction at the end of the IF branch:
// this explains the `+1` and `+1+2` corrections in the jump offsets in the AST items below.

| exp '?' exp ':' exp
                                {
                                  // $$ = $exp1.concat(#CONDITION#, $exp2.length + 1 + 2, $exp2, #SKIP#, $exp3.length + 1, $exp3);
                                  $exp1.push(#CONDITION#, $exp2.length + 1 + 2);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#SKIP#, $exp3.length + 1);
                                  append.apply($exp1, $exp3);
                                  $$ = $exp1;
                                }
| IF exp THEN exp ELSE exp
                                {
                                  // $$ = $exp1.concat(#CONDITION#, $exp2.length + 1 + 2, $exp2, #SKIP#, $exp3.length + 1, $exp3);
                                  $exp1.push(#CONDITION#, $exp2.length + 1 + 2);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#SKIP#, $exp3.length + 1);
                                  append.apply($exp1, $exp3);
                                  $$ = $exp1;
                                }
| IF exp THEN exp
                                {
                                  // $$ = $exp1.concat(#CONDITION#, $exp2.length + 1 + 2, $exp2, #SKIP#, 2 + 1, #NUM#, 0);
                                  $exp1.push(#CONDITION#, $exp2.length + 1 + 2);
                                  append.apply($exp1, $exp2);
                                  $exp1.push(#SKIP#, 2 + 1, #NUM#, 0);
                                  $$ = $exp1;
                                }
;

arglist:
  exp
                                {
                                  /*
                                     We do not *want* to be smart about the arglist here: we leave that to the FUNCTION rule
                                     as we can then have smarter optimizations of the AST streams than we can hope to
                                     accomplish here *and* we produce a simpler AST stream input for the optimizer, thus
                                     simplifying this code!

                                     Thus we *always* add a basic PUSH token to every function argument:
                                     the FUNCTION rule or optimizer can go and sort them out, optimizing them into customized pushes
                                     or register moves, depending on the context.
                                   */
                                  $exp.push(#PUSH#);
                                  $$ = [$exp];
                                }
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

