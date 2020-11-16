/*
 * How to have multiple start rules?
 *
 * By a parser+lexer hack which turns single start rule into multiple.
 * This hack uses the lexer start conditions to help keep the hack extremely local: the same
 * input elsewhere in the input won't trigger the hack.
 *
 * Three different 'toy grammars' are showcased here:
 * - one accepts dates in ISO format: YYYY-MM-DD or YYYY MMM DD
 * - one accepts times: HH:MM or HH:MM:SS
 * - one accepts numbers, with or without sign: +7, -1.0, .42
 *
 * Note that the hack also uses the advanced lexer API: `.unput()`
 *
 * This example employs an epsilon rule (plus lexer hacks);
 * see faking-multiple-start-rules.jison for another (modern & cleaner) way to accomplish the same. 
 */



// %options on-demand-lookahead



%lex


// Off Topic
// ---------
//
// Do not specify the xregexp option as we want the XRegExp \p{...} regex macros converted to 
// native regexes and used as such:
//
// %options xregexp


/*
 * We have several 'lexer states', all of which are defined here: `%x` means it's an _exclusive_ lexer state, while
 * JISON considers `%s` states to be _inclusive_, i.e. states which include the set of unmarked lexer rules alongside
 * the ones that are marked up as belonging to the given state.
 */

%x PARSE_MODE_DETECTION
%s VALUE_MODE


ASCII_LETTER                        [a-zA-z]
// \p{Alphabetic} already includes [a-zA-z], hence we don't need to merge with {ASCII_LETTER}:
UNICODE_LETTER                      [\p{Alphabetic}]
DIGIT                               [\p{Number}]
WHITESPACE                          [\s\r\n\p{Separator}]

// Match simple floating point values, for example `1.0`, but also `9.`, `.05` or just `7`:
BASIC_FLOATING_POINT_NUMBER         (?:[0-9]+(?:"."[0-9]*)?|"."[0-9]+)



%%

/*
 * A word on the `PARSE_MODE_DETECTION` 'hack' / We have multiple `%start` Rules
 * -----------------------------------------------------------------------------
 *
 * The `PARSE_MODE_DETECTION` mode is a parser/lexer communications hack to give us multiple start rules, i.e.
 * we use this hack as the code generator (JISON) does not support multiple `%start` rules.
 *
 * We 'hack' this feature into the grammar by setting up a start rules which first checks which start
 * rule we really desire and then goes and tweaks the input fed to the lexer (and switches to the
 * `PARSE_MODE_DETECTION` mode alongside) to help the lexer 'fake' a token which the parser can then
 * use to switch to the desired start rule.
 *
 * As the hack involves using the JISON lexer `.unput()` method at the very beginning of the parsing/lexing
 * process, the 'hack' byte which is meant to tickle the lexer as described above, lands in NEGATIVE `yylloc`
 * space. In other words: the hack does not damage the input position information of the real text/input
 * being lexed/parsed subsequently.
 *
 * The intricacies of the 'hack' involve:
 *
 * - a *grammar* subrule to set it all up, which itself does not require any lexer tokens (is 'empty') nor any
 *   look-ahead, thus allowing the parser to 'reduce' this `init_phase` rule without having had to call the
 *   lexer *yet*. This means that any parser action code attached to this `init_phase` rule will execute
 *   before the lexer is demanded to deliver any tokens.
 *
 * - us pushing a special character value as a prefix of the lexed input via `.unput()`: this character is
 *   later recognized by the lexer and produces a special token which is used to direct the parser
 *   towards the desired 'start rule'.
 *
 * The crux here is that we do not want any look-ahead or other lexer tokenization activity before we have
 * been able to set up the context for switching to a particular start rule.
 *
 * To protect against the 'magic characters' `\u0001 .. \u0003` occurring in (possibly malicious/illegal) input, we use a
 * lexer mode which will only be used at the very start of the parse process: `PARSE_MODE_DETECTION`.
 */

<PARSE_MODE_DETECTION>"\u0001"
        %{
            this.popState();
            console.log('detected date mode');
            return 'DATE_PARSE_MODE';
        %}

<PARSE_MODE_DETECTION>"\u0002"
        %{
            this.popState();
            console.log('detected time mode');
            return 'TIME_PARSE_MODE';
        %}

<PARSE_MODE_DETECTION>"\u0003"
        %{
            this.popState();
            console.log('detected value mode');
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE';
        %}

/*
 * Catch all other possible initial input characters, make sure we do not consume them and
 * process the input in the default parse mode: `INITIAL`
 */
<PARSE_MODE_DETECTION>.
        %{
            this.popState();
            console.log('detected DEFAULT (value) mode');
            /*
             * When we did not observe one of the special character codes at the forefront of our
             * input stream then we will parsing the entire input in the default mode, i.e. as a numeric value.
             *
             * Therefore, let the previous lexer state (should be `INITIAL`) process this bit instead;
             * do not consume the matched input.
             *
             * **WARNING**: you might think this would be easily accomplished using the lexer.reject()
             * call like this:
             *
             *     this.reject();
             *
             * but `reject()` only works as expected _as long as you do NOT switch lexer states_!
             *
             * Some understanding of the lexer internals is required here: when you call `reject()`, the
             * lexer will simply test the input against the next regex in the current set. The key here
             * is _the current set_: when the lexer is required to produce a token, it will construct
             * a _regex set_ given the _current lexer state_.
             *
             * What we need here is the lexer retrying matching the same input after we changed the
             * lexer state above when we called:
             *
             *     this.popState();
             *
             * The way to accomplish this is to 'push back' the matched content into the input buffer using
             * `.unput()` and then signal the lexer that we matched nothing by returning no token at all:
             *
             *      return false;
             *
             * That `return false` will make sure the lexer considers this action as 'complete' (by
             * us `return`ing from the lexer), while the boolean `false` tells the lexer it will need
             * to run another round in order to provide its caller with a 'real' lexed token.
             *
             *
             * ### For the technically inquisitive
             *
             * The crux is us employing the side effects of the jison lexer engine,
             * more specifically this bit, where I'd like you to take notice of
             * the recursive nature of the `.lex()` method in here, plus the fact that `.next()`
             * will call `._currentRules()` each time it is invoked (while this is a very much
             * reduced and somewhat paraphrased extract of the original):
             *
             *      // generated by jison-lex...
             *      parser.lexer = {
             *          ...,
             *          next: function () {
             *              ...
             *              var match, token, rule_under_test;
             *              var rules = this._currentRules();
             *              for (var i = 0; i < rules.length; i++) {
             *                  rule_under_test = this.rules[rules[i]];
             *                  match = this._input.match(rule_under_test);
             *                  ...
             *                  if (match) {
             *                      // exec the matching lexer action code:
             *                      token = this.test_match(match, rule_under_test);
             *
             *                      // stay in this loop when .reject() was called,
             *                      // otherwise we'll run with this match:
             *                      if (!this.rejected) break;
             *                  }
             *              }
             *              if (match) {
             *                  ...
             *                  if (token !== false) {
             *                      return token;
             *                  }
             *                  // else: this is a lexer rule which consumes input
             *                  //       without producing a token (e.g. whitespace)
             *                  return false;
             *              }
             *              ...
             *          },
             *
             *          // return next match that has a token
             *          lex: function lex() {
             *              var r = this.next();
             *              if (r) {
             *                  return r;
             *              } else {
             *                  return this.lex();
             *              }
             *          },
             *
             *          // produce the lexer rule set which is active
             *          // for the currently active lexer condition state
             *          _currentRules: function _currentRules() {
             *              ...
             *              return this.conditions[...].rules;
             *          },
             *
             *          ...
             *
             *          conditions: {
             *              "PARSE_MODE_DETECTION": {
             *                  rules: [
             *                      0, 1, 2, 3, 4
             *                  ],
             *                  inclusive: false
             *              },
             *              ...
             *              "INITIAL": {
             *                  rules: [
             *                      5, 6, 7, 8, 9,
             *                      ...
             *                  ],
             *                  inclusive: true
             *              }
             *          }
             *      };
             *
             */
            this.unput(this.matches[0]);
            
            // Pick the default parse mode:
            this.pushState('VALUE_MODE');
            return 'VALUE_PARSE_MODE';
        %}

<PARSE_MODE_DETECTION><<EOF>>
        %{
            this.popState();
            // let the previous lexer state process that EOF for real...
            return false;
        %}





/*
 * And here our lexer rule sets starts for real...
 * -----------------------------------------------
 */




{UNICODE_LETTER}+
        %{
            return 'MONTH';
        %}


// As the {BASIC_FLOATING_POINT_NUMBER} can also lex a year or hour or other integer number,
// we use a lexer condition to help us only recognize floating numbers when we actually expect
// them:

<VALUE_MODE>{BASIC_FLOATING_POINT_NUMBER}
        %{
            yytext = parseFloat(yytext);
            return 'FLOAT';
        %}

// Recognize any integer value, e.g. 2016
{DIGIT}+
        %{
            yytext = parseInt(yytext, 10);
            return 'INTEGER';
        %}

'-'     return '-';
'+'     return '+';
'/'     return '/';
':'     return ':';
'.'     return '.';




/*
 * The sag wagon, which mops up the dregs
 * --------------------------------------
 */

\s+         /*: skip whitespace */

<<EOF>>     return 'EOF';

.
        %{
            yy.lexer.parseError("Don't know what to do with this: it's unsupported input: '" + yytext + "'");
            return 'error';
        %}




/lex






%token FLOAT INTEGER MONTH

%nonassoc '-' ':' '+' '/' '.'







%start start_parsing



/*
 * %parse-param adds one or more named arguments to the action call; these user args are assumed to be passed to Parser.parse(input, ...args...)
 */
%parse-param mode




%% /* language grammar */



start_parsing
    : init gobble_unwanted_lookahead do_the_work
        {
            return $do_the_work;
        }
    ;


// This rule SHOULD be reduced without a single lexer token being popped yet.
// (Alas, not so in JISON... see the next grammar rule for more info...)
init
    : /* empty */
        {
            console.log('init: set up parse mode: ', mode);
            initParseMode(yy, mode);
        }
    ;


// In classic YACC this wasn't needed (depending on which implmentation you used);
// here we need this as JISON *always* fetches one lexed token look-ahead, even when 
// the next step is always reducing an epsilon rule. See also the setup code in the
// main() function at the bottom of this example...

gobble_unwanted_lookahead 
    : DUMMY
    ;



do_the_work
    : VALUE_PARSE_MODE value EOF
        {
            return {
                value: $value
            };
        }

    | DATE_PARSE_MODE date EOF
        {
            return {
                date: $date
            };
        }

    | TIME_PARSE_MODE time EOF
        {
            return {
                time: $time
            };
        }
    ;



value
    : '-'[minus] number
        {
            $$ = -$number;
        }

    | '+'[plus] number
        {
            $$ = $number;
        }

    | number
    ;


number
    : FLOAT

    | INTEGER
    ;


date
    : year month day
        {
            $$ = $year + '-' + $month + '-' + $day;
        }

    | year '.' month '.' day
        {
            $$ = $year + '-' + $month + '-' + $day;
        }

    | year '/' month '/' day
        {
            $$ = $year + '-' + $month + '-' + $day;
        }

    | year '-' month '-' day
        {
            $$ = $year + '-' + $month + '-' + $day;
        }
    ;

year
    : INTEGER
    ;

month
    : INTEGER

    | MONTH
    ;

day
    : INTEGER
    ;


time
    : hour ':' minute ':' second
        {
            $$ = $hour + ':' + $minute + ':' + $second;
        }

    | hour ':' minute
        {
            $$ = $hour + ':' + $minute + ':00';
        }
    ;    

hour
    : INTEGER
    ;

minute
    : INTEGER
    ;

second
    : INTEGER
    ;



/*
 * And here endeth the parser proper
 * ---------------------------------
 *
 * This concludes the grammar rules definitions themselves.
 * What follows is a chunk of support code that JISON will include in the generated parser.
 */


%%



/*
 * This chunk is included in the parser object code,
 * following the 'init' code block that may be set in `%{ ... %}` at the top of this
 * grammar definition file.
 */



/* @const */ var DATE_MODE = 'D';
/* @const */ var TIME_MODE = 'T';
/* @const */ var VALUE_MODE = 'V';

var parseModeInitialized = 0;

function initParseMode(yy, parser_mode) {
    /*
     * The 'init phase' is always invoked for every parse invocation.
     *
     * At this point in time, nothing has happened yet: no token has
     * been lexed, no real statement has been parsed yet.
     */

    /*
     * Depending on parser mode we must push a 'magick marker' into the lexer stream
     * which is a hack offering a working alternative to having the parser generator
     * support multiple %start rules.
     */
    yy.lexer.pushState('PARSE_MODE_DETECTION');


    parseModeInitialized = 1;


    // prevent crash in lexer as the look-ahead activity in there may already have 
    // changed yytext to become another type (not string any more):
    //yy.lexer.yytext = yy.lexer.match;


    switch (parser_mode) {
    default:
        break;

    case DATE_MODE:
        yy.lexer.unput("\u0001");
        break;

    case TIME_MODE:
        yy.lexer.unput("\u0002");
        break;

    case VALUE_MODE:
        yy.lexer.unput("\u0003");
        break;
    }
};





// Demo main() to showcase the use of this example:
parser.main = function () {
    // set up a custom parseError handler.
    //
    // Note that this one has an extra feature: it returns a special (truthy) 'parse value'
    // which will be returned by the parse() call when this handler was invoked: this is 
    // very useful to quickly make the parse process a known result even when errors have
    // occurred: 
    parser.parseError = function altParseError(msg, hash) {
        if (hash && hash.exception) {
            msg = hash.exception.message;
            //console.log('ex:', hash.exception, hash.exception.stack);
        }
        console.log("### ERROR: " + msg);
        return {
            error: 'parse error'
        };
    };

    // Because JISON doesn't reduce epsilon rules *before* the next non-epsilon rule is
    // inspected, i.e. JISON *always* fetches a single look-ahead token from the lexer,
    // and we cannot have that as we need to push back the parse mode marker *before*
    // anything is lexed in there, so we have to complicate this hack by hooking into
    // the lexer and making it spit out dummy tokens until we observe the parse mode
    // being set up via initParseMode() above...
    parser.lexer.options.pre_lex = function () {
        // This callback can return a token ID to prevent the lexer from munching any
        // input:
        if (!parseModeInitialized) {
            //console.log('pre_lex pre init --> DUMMY');
            return parser.symbols_['DUMMY'];
        }
        //console.log('pre_lex');
    };

    // And hook into setInput AI to reset the global flag...
    var si_f = parser.lexer.setInput;
    parser.lexer.setInput = function (input, yy) {
        parseModeInitialized = 0;

        console.log('setting input: ', input);
        
        return si_f.call(this, input, yy);
    };

    // End of fixup to make the hack work. 
    //
    // Compare this with the code in the faking-multiple-start-rules.jison example which
    // employs the pre_parse() API: that one is much cleaner than this!


    console.log('\n\nUsing number parse mode:\n');

    var input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    console.log('\n\nErrors in this mode:\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, VALUE_MODE)
    }, null, 2));



    console.log('\n\nUsing date parse mode:\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    console.log('\n\nErrors in this mode:\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, DATE_MODE)
    }, null, 2));



    console.log('\n\nUsing time parse mode:\n');

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    console.log('\n\nErrors in this mode:\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input, TIME_MODE)
    }, null, 2));




    console.log('\n\nUsing DEFAULT parse mode:\n');

    input = '-7.42';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    console.log('\n\nErrors in this mode:\n');

    input = '2016-03-27';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '2016 march 13';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '17:05';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));

    input = '08:30:22';
    console.log(JSON.stringify({
        input: input,
        parse_result: parser.parse(input)
    }, null, 2));



};
