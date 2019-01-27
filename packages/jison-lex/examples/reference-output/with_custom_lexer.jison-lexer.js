
            var lexer;
// When you set up a custom lexer, this is the minimum example for one:
    // 
    // your lexer class/object must provide these interface methods and constants at least:
    //
    // - setInput(string)
    // - lex() -> token
    // - EOF = 1
    // - ERROR = 2
    //
    // and your lexer must have a `options` member set up as a hash table, i.e. JS object:
    //
    // - options: {}
    //
    // Your lexer must be named `lexer` as shown below.

    var input = ""; 
    var input_offset = 0; 

    var lexer = { 
        EOF: 1, 
        ERROR: 2, 

        options: {}, 

        lex: function () { 
            if (input.length > input_offset) { 
                return input[input_offset++]; 
            } else { 
                return this.EOF; 
            } 
        }, 

        setInput: function (inp) { 
            input = inp; 
            input_offset = 0; 
        } 
    };
;

            //=============================================================================
            //                     JISON-LEX OPTIONS:

            {
  lexerActionsUseYYLENG: '???',
  lexerActionsUseYYLINENO: '???',
  lexerActionsUseYYTEXT: '???',
  lexerActionsUseYYLOC: '???',
  lexerActionsUseParseError: '???',
  lexerActionsUseYYERROR: '???',
  lexerActionsUseLocationTracking: '???',
  lexerActionsUseMore: '???',
  lexerActionsUseUnput: '???',
  lexerActionsUseReject: '???',
  lexerActionsUseLess: '???',
  lexerActionsUseDisplayAPIs: '???',
  lexerActionsUseDescribeYYLOC: '???',
  lex_rule_dictionary: {
    rules: [],
    moduleInclude: `// Included by Jison: includes/with-includes.main.js:

parser.main = function (args) {
    if (!args[1]) {
      console.log('Usage: ' + args[0] + ' FILE');
      process.exit(1);
    }

    var tty = require('tty');
    if (tty.isatty(process.stdout.fd)) {
      console.log('not redirected');
    }
    else {
      console.log('redirected');
    }

    var input_chunks = [];

    function process_one_line(source) {
      try {
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2) + '\\n');
      } catch (ex) {
        process.stdout.write("Parse error:\\n" + JSON.stringify(ex, null, 2) + "\\nfor input:\\n" + source + '\\n');
      }
    }

    function act() {
      // see if we got an entire line's worth from stdin already?
      var source = input_chunks.join("").split('\\n');
      while (source.length > 1) {
        process_one_line(source[0]);
        source.shift();
      }
      input_chunks = source;
    }

    if (args[1] === '-') {
      // read from stdin, echo output to stdout
      process.stdin.setEncoding('utf8');

      process.stdin.on('readable', function() {
        var chunk = process.stdin.read();
        //console.log("chunk:", JSON.stringify(chunk, null, 2));
        if (chunk !== null) {
          input_chunks.push(chunk);
          act();
        }
      });

      process.stdin.on('end', function() {
        input_chunks.push('\\n');
        act();
        process.exit(0);
      });      
    } else {
      try {
        var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2));
        return +rv || 0;
      } catch (ex) {
        process.stdout.write("Parse error:\\n" + JSON.stringify(ex, null, 2) + "\\nfor input file:\\n" + args[1]);
        return 66;
      }
    }
}

// End Of Include by Jison: includes/with-includes.main.js`,
    macros: {},
    startConditions: {},
    codeSections: [],
    importDecls: [],
    unknownDecls: [],
    options: {
      ranges: true,
    },
    actionInclude: `// When you set up a custom lexer, this is the minimum example for one:
    // 
    // your lexer class/object must provide these interface methods and constants at least:
    //
    // - setInput(string)
    // - lex() -> token
    // - EOF = 1
    // - ERROR = 2
    //
    // and your lexer must have a \`options\` member set up as a hash table, i.e. JS object:
    //
    // - options: {}
    //
    // Your lexer must be named \`lexer\` as shown below.

    var input = ""; 
    var input_offset = 0; 

    var lexer = { 
        EOF: 1, 
        ERROR: 2, 

        options: {}, 

        lex: function () { 
            if (input.length > input_offset) { 
                return input[input_offset++]; 
            } else { 
                return this.EOF; 
            } 
        }, 

        setInput: function (inp) { 
            input = inp; 
            input_offset = 0; 
        } 
    }`,
  },
  options: {
    moduleType: 'commonjs',
    debug: false,
    enableDebugLogs: false,
    json: true,
    dumpSourceCodeOnFailure: true,
    throwErrorOnCompileFailure: true,
    defaultModuleName: 'lexer',
    xregexp: false,
    lexerErrorsAreRecoverable: false,
    flex: false,
    backtrack_lexer: false,
    ranges: true,
    trackPosition: true,
    caseInsensitive: false,
    exportSourceCode: false,
    exportAST: false,
    prettyCfg: true,
    noMain: true,
  },
  moduleType: 'commonjs',
  conditions: {
    INITIAL: {
      rules: [],
      inclusive: true,
    },
  },
  performAction: `function lexer__performAction(yy, yyrulenumber, YY_START) {
            var yy_ = this;

            // When you set up a custom lexer, this is the minimum example for one:
    // 
    // your lexer class/object must provide these interface methods and constants at least:
    //
    // - setInput(string)
    // - lex() -> token
    // - EOF = 1
    // - ERROR = 2
    //
    // and your lexer must have a \`options\` member set up as a hash table, i.e. JS object:
    //
    // - options: {}
    //
    // Your lexer must be named \`lexer\` as shown below.

    var input = ""; 
    var input_offset = 0; 

    var lexer = { 
        EOF: 1, 
        ERROR: 2, 

        options: {}, 

        lex: function () { 
            if (input.length > input_offset) { 
                return input[input_offset++]; 
            } else { 
                return this.EOF; 
            } 
        }, 

        setInput: function (inp) { 
            input = inp; 
            input_offset = 0; 
        } 
    }
var YYSTATE = YY_START;
/* no rules ==> no rule SWITCH! */
        }`,
  caseHelperInclude: `{

}`,
  rules: [],
  macros: {},
  regular_rule_count: 0,
  simple_rule_count: 0,
  conditionStack: [
    'INITIAL',
  ],
  actionInclude: `// When you set up a custom lexer, this is the minimum example for one:
    // 
    // your lexer class/object must provide these interface methods and constants at least:
    //
    // - setInput(string)
    // - lex() -> token
    // - EOF = 1
    // - ERROR = 2
    //
    // and your lexer must have a \`options\` member set up as a hash table, i.e. JS object:
    //
    // - options: {}
    //
    // Your lexer must be named \`lexer\` as shown below.

    var input = ""; 
    var input_offset = 0; 

    var lexer = { 
        EOF: 1, 
        ERROR: 2, 

        options: {}, 

        lex: function () { 
            if (input.length > input_offset) { 
                return input[input_offset++]; 
            } else { 
                return this.EOF; 
            } 
        }, 

        setInput: function (inp) { 
            input = inp; 
            input_offset = 0; 
        } 
    }`,
  moduleInclude: `// Included by Jison: includes/with-includes.main.js:

parser.main = function (args) {
    if (!args[1]) {
      console.log('Usage: ' + args[0] + ' FILE');
      process.exit(1);
    }

    var tty = require('tty');
    if (tty.isatty(process.stdout.fd)) {
      console.log('not redirected');
    }
    else {
      console.log('redirected');
    }

    var input_chunks = [];

    function process_one_line(source) {
      try {
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2) + '\\n');
      } catch (ex) {
        process.stdout.write("Parse error:\\n" + JSON.stringify(ex, null, 2) + "\\nfor input:\\n" + source + '\\n');
      }
    }

    function act() {
      // see if we got an entire line's worth from stdin already?
      var source = input_chunks.join("").split('\\n');
      while (source.length > 1) {
        process_one_line(source[0]);
        source.shift();
      }
      input_chunks = source;
    }

    if (args[1] === '-') {
      // read from stdin, echo output to stdout
      process.stdin.setEncoding('utf8');

      process.stdin.on('readable', function() {
        var chunk = process.stdin.read();
        //console.log("chunk:", JSON.stringify(chunk, null, 2));
        if (chunk !== null) {
          input_chunks.push(chunk);
          act();
        }
      });

      process.stdin.on('end', function() {
        input_chunks.push('\\n');
        act();
        process.exit(0);
      });      
    } else {
      try {
        var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2));
        return +rv || 0;
      } catch (ex) {
        process.stdout.write("Parse error:\\n" + JSON.stringify(ex, null, 2) + "\\nfor input file:\\n" + args[1]);
        return 66;
      }
    }
}

// End Of Include by Jison: includes/with-includes.main.js`,
  __in_rules_failure_analysis_mode__: false,
  exportSourceCode: {
    enabled: false,
  },
  is_custom_lexer: true,
}

        