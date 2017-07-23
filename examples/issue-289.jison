%lex

%%

\s+                 /* whitespace */
[a-zA-Z]+           return 'ID';
\"[^\"\n]*\"        return 'STR';
"("                 return '(';
")"                 return ')';
"["                 return '[';
"]"                 return ']';
","                 return ',';
<<EOF>>             return 'EOF';

/lex

%start value

%%

value
    : ID                            {$$ = $1;}
    | '[' ']'                       {$$ = [];}
    | '[' values ']'                {$$ = $2;}
    | id '(' ')'                    {$$ = [$1, []];}
    | id '(' values ')'             {$$ = [$1, $3];}
;

id
    : ID                            {$$ = $1;}
    | STR                           {$$ = $1;}
;

values
    : value                         {$$ = [$1];}
    | values ',' value              {$$ = $1; $$.push($3);}
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

parser.main = function () {
    parser.yy = {
        parseError: function custom_parseError(str, hash, ExceptionClass) {
            // grab the collected values already present on the parse stack:
            var vs = hash.value_stack;
            vs = vs.slice(1, hash.stack_pointer);

            console.error("parse error: ", str, "\n");
            return vs.join(':') + ':FAILURE';
        }
    };
    var type = parser.options.type + (parser.options.hasPartialLrUpgradeOnConflict ? '+HQ' : '');
    var rv = parser.parse('a(b())');
    console.log("a(b()) ==> ", rv, ' when grammar has been compiled as type: ', type);
    switch (type) {
    default:
        assert.ok(false, "should never get here");
        break;

    case "lalr":
        assert.equal(rv, "a:FAILURE");
        break;

    case "lalr+HQ":
    case "lr":
        assert.deepEqual(rv, ["a", [["b", []]]]);
        break;
    }

    rv = parser.parse('a(b)');
    console.log("a(b) ==> ", rv, ' when grammar has been compiled as type: ', type);
    switch (type) {
    default:
        assert.ok(false, "should never get here");
        break;

    case "lalr":
        assert.equal(rv, "a:FAILURE");
        break;

    case "lalr+HQ":
    case "lr":
        assert.deepEqual(rv, ["a", ["b"]]);
        break;
    }

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

