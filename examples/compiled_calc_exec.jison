
%import symbols  "./output/compiled_calc/compiled_calc_parse.js"



%token      NUM             // Simple double precision number  
%token      VAR FUNCTION    // Variable and Function            
%token      CONSTANT        // Predefined Constant Value, e.g. PI or E

%token      END             // token to mark the end of a function argument list in the output token stream


%nonassoc  '='
%nonassoc   '-' '+'
%nonassoc   '*' '/'
%nonassoc  POWER  
%nonassoc '!'
%nonassoc '%'
%nonassoc  UMINUS     /* Negation--unary minus */
%nonassoc  UPLUS      /* unary plus */
%nonassoc  ','

/* Grammar follows */

%start input


%%


input:   
  /* empty */
| input line
;

line:
  exp NL  
                                { 
                                    console.log('expression result value: ', $exp); 
                                }
;

exp:
  NUM        
                                { $$ = $NUM; }
| CONSTANT        
                                { $$ = $CONSTANT; }
| VAR        
                                { $$ = yy.variables[$VAR]; }
| '=' VAR exp 
                                { $$ = yy.variables[$VAR] = $exp; }
| FUNCTION END 
                                { $$ = $FUNCTION(); }
| FUNCTION arglist END   
                                { $$ = $FUNCTION.apply(null, $arglist); }
| '+' exp exp         
                                { $$ = $exp1 + $exp2; }
| '-' exp exp         
                                { $$ = $exp1 - $exp2; }
| '*' exp exp         
                                { $$ = $exp1 * $exp2; }
| '/' exp exp         
                                { $$ = $exp1 / $exp2; }
| UMINUS exp 
                                { $$ = -$exp; }
| UPLUS exp
                                { $$ = +$exp; }
| POWER exp exp         
                                { $$ = Math.pow($exp1, $exp2); }
| '!' exp 
                                { $$ = yy.functions['factorial']($exp); }
| '%' exp 
                                { $$ = $exp / 100; }
;

arglist:
  exp
                                { $$ = [$exp]; }
| ',' exp arglist
                                { $$ = [$exp].concat($arglist); }
;

/* End of grammar */


%%



%include './output/compiled_calc/compiled_calc_parse.js'




// ------------------- with custom lexer -----------------------

parser.main = function compiledRunner(args) {
    if (!args[1]) {
        console.log('Usage: ' + args[0] + ' FILE');
        return 1;
    }

    /*
     * What you see happening here is:
     *
     * - the first parser parsed the text input and turns it into a token stream (a 
     *   serialized AST, as it were)
     * - then the second parser (defined above) is executed, while it is fed the token stream produced
     *   by the first parser:
     *   + the second parser comes with its own minimal, CUSTOM, lexer (see code below)
     *   + the second parser can be made to be ultra-fast as it doesn't need to mind
     *     about detecting human errors (the front-side = first parser took care of that!)
     *     and it doesn't need to mind about human readable notation either: it takes
     *     a AST/token-stream as input which 'happens to be' prepped by the first parser
     *     to be perfect for a Reverse Polish Notation grammar: both parsers have the
     *     same language power, but the second has simpler rules (note that the 
     *     '( exp )' subrule is absent as RPN doesn't need such bracketed priority kludges!)
     *
     *   + A THIRD parser COULD be provided to take the token stream from the first
     *     parser and produce human-readable text output from hat stream: this is just
     *     another use of the same power.
     *
     * What is ultimately shown here is a multi-stage compiler/engine:
     *
     * - the first parser is the 'front end' which is facing human input
     * - the second / third / ... parsers are really slightly sophisticated 'tree walkers'
     *   which take the serialized 'intermediate format' (the token stream) and process
     *   it, as fast as possible.
     *
     * When is this useful?
     *
     * For example, when you need to calculate or otherwise machine-process your parsed
     * input many times, and fast, (e.g. when calculating the expression values) while
     * human input parsing costs would be in the way during such calculus processes:
     * now it is separated into a real 'front end'; the 'odd' thing we did here is re-use
     * yacc/jison to also produce the 'internal' stream/tree walkers as well:
     * quite often those are hand-coded, but I chose to showcase the new `%import symbols`
     * feature of JISON, together with the new #TOKEN and #TOKEN# references, both of 
     * which are geared towards this specific usage of JISON and your grammars: this way
     * you can use JISON as an advanced tree walker generator for machine format processing too!
     */


    var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');

    // Front End parse: read human input and produce a token stream i.e. serialized AST:
    var toklst = compiled_calc_parse.parse(source);

    console.log('parsed token list: ', JSON.stringify(toklst, null, 2));


    // Now set up the second parser's custom lexer: this bugger should munch the token stream. Fast!
    parser.__lexer__ = {
      __input__: null,

      setInput: function setInput2(input, yy) {
        console.log('set input to from token list: ', input);
        this.__input__ = input;
      },

      lex: function lex2() {
        var l = this.__input__;
        console.log('LEX: input token list: ', l);
        if (l.length) {
          var t = l.shift();

          console.log('shift TOKEN from token list: ', t, parser.describeSymbol(Math.abs(t)));

          // negative token ID indicates that a VALUE is following on its heels...
          if (t < 0) {
            t = -t;

            // also pop value:
            var v = l.shift();
            // and set it up for lex() to feed it to the parser engine properly:
            this.yytext = v;

            console.log('shift VALUE from token list: ', v);
          }
          return t;
        }
        // end of stream: keep spitting out EOF tokens until Kingdom Come:
        return parser.EOF;
      }
    };

    // Execute the second parser: takes a formula/expression token stream as input and
    // spits out the calculated value per line:
    parser.parse(toklst);

    return 2;
};

