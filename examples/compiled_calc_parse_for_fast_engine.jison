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



%import symbols  "compiled_calc_AST_symbols.json5"




// %lex
//
// Inject the lexer from the other parser as they're the same...



%token      NUM             // Simple double precision number
%token      VAR FUNCTION    // Variable and Function
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E
%token      ERROR           // Mark error in statement

%token      END             // token to mark the end of a function argument list in the output token stream
%token      FUNCTION_0      // optimization: function without any input parameters
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



%options no-default-action      // JISON shouldn't bother injecting the default `$$ = $1` action anywhere!

%parse-param globalSpace        // extra function parameter for the generated parse() API; we use this one to pass in a reference to our workspace for the functions to play with.



%%


input:
  ε                             /* empty */
                                {
                                  $$ = [];
                                }
| input line
                                {
                                  if ($line.length) {
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
                                    // are input: when there's only a single statement (line) it'll unambguously
                                    // terminated by EOF!
                                    if (01 && $input.length) {
                                      $line.push(#EOL#);
                                    }
                                    $$ = $input.concat($line);
                                  } else {
                                    $$ = $input;
                                  }
                                }
;

line:
  EOL
                                { $$ = []; }
| exp EOL
                                {
                                  console.log('line: ', JSON.stringify($exp, null, 2));
                                  $$ = $exp;
                                }
| error EOL
                                {
                                  yyerrok;
                                  yyclearin;
                                  console.log('skipped erroneous input line');
                                  $$ = [#ERROR#, #EOL#];
                                }
| error EOF                     // This rule kicks in when there's an error in the very last input line when it wasn't terminated by EOL
                                {
                                  yyerrok;
                                  yyclearin;
                                  console.log('skipped erroneous input line');
                                  $$ = [#ERROR#, #EOL#];
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
                                  $$ = $exp.concat(#ASSIGN#, $VAR); }
| FUNCTION '(' ')'
                                { $$ = [#FUNCTION_0#, $FUNCTION]; }
| FUNCTION '(' arglist ')'
                                {
                                  /*
                                     As every arg in the arglist comes with a #PUSH# token, we *might* have opted
                                     to push an extra #POP# token into the stream before the #FUNCTION# token,
                                     but we don't have to as that #POP# is *implicit# in the #FUNCTION# token
                                     (assuming the arglist is non-empty, of course).

                                     Now we let the optimizer deal with this when the time comes...

                                     Meanwhile, keep it as simple as possible in here!

                                     Also don't forget to FLATTEN the arglist! ==> `concat.apply(a, arglist)`
                                  */
                                  $$ = [].concat.apply([], $arglist, #FUNCTION#, $FUNCTION);
                                  // No need for this as we solve it by PUSH-ing every function arg:
                                  //
                                  //if (0) {
                                  //  // Reverse Polish Notation ==> *announce* a function is coming your way:
                                  //  $$.unshift(#END#);
                                  //}
                                }

| exp EQ exp
                                { $$ = $exp1.concat(PUSH, $exp2, #EQ); }
| exp NEQ exp
                                { $$ = $exp1.concat(PUSH, $exp2, #NEQ); }
| exp LEQ exp
                                { $$ = $exp1.concat(PUSH, $exp2, #LEQ); }
| exp GEQ exp
                                { $$ = $exp1.concat(PUSH, $exp2, #GEQ); }
| exp LT exp
                                { $$ = $exp1.concat(PUSH, $exp2, #LT); }
| exp GT exp
                                { $$ = $exp1.concat(PUSH, $exp2, #GT); }
| exp OR exp
                                { $$ = $exp1.concat(PUSH, $exp2, #OR); }
| exp XOR exp
                                { $$ = $exp1.concat(PUSH, $exp2, #XOR); }
| exp AND exp
                                { $$ = $exp1.concat(PUSH, $exp2, #AND); }

| exp '|'[bitwise_or] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #BITWISE_OR#); }
| exp '^'[bitwise_xor] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #BITWISE_XOR#); }
| exp '&'[bitwise_and] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #BITWISE_AND#); }

| exp '+'[add] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #ADD#); }
| exp '-'[subtract] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #SUBTRACT#); }
| exp '*'[multiply] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #MULTIPLY#); }
| exp '/'[divide] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #DIVIDE#); }
| exp '%'[modulo] exp
                                { $$ = $exp1.concat(PUSH, $exp2, #MODULO#); }
| '-' exp             %prec UMINUS
                                { $$ = $exp1.concat(#UMINUS#); }
| '+' exp             %prec UPLUS
                                { $$ = $exp1.concat(#UPLUS#); }
| exp POWER exp
                                { $$ = $exp1.concat(PUSH, $exp2, #POWER#); }
| exp '%'[percent]
                                { $$ = $exp1.concat(#PERCENT#); }
| exp '!'[facult]
                                { $$ = $exp1.concat(#FACTORIAL#); }

| '~'[bitwise_not] exp
                                { $$ = $exp1.concat(#BITWISE_NOT#); }
| '!'[not] exp
                                { $$ = $exp1.concat(#NOT#); }
| NOT exp
                                { $$ = $exp1.concat(#NOT#); }

| '(' exp ')'
                                { $$ = $exp; }

| exp '?' exp ':' exp
                                { $$ = $exp1.concat(#CONDITION#, $exp2.length, $exp2, #SKIP#, $exp3.length, $exp3); }
| IF exp THEN exp ELSE exp
                                { $$ = $exp1.concat(#CONDITION#, $exp2.length, $exp2, #SKIP#, $exp3.length, $exp3); }
| IF exp THEN exp
                                { $$ = $exp1.concat(#CONDITION#, $exp2.length, $exp2, #SKIP#, 2, #NUM#, 0); }
;

arglist:
  exp
                                {
                                  /*
                                     We do not *want* to be smart about the arglist here: we leave that to the optimizer
                                     as we can then have smarter optimizations of the AST streams than we can hope to
                                     accomplish here *and* we produce a simpler AST stream input for the optimizer, thus
                                     simplifying its code!

                                     Thus we *always* add a basic PUSH token to every function argument:
                                     the optimizer can go and sort them out, optimizing them into customized pushes
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

