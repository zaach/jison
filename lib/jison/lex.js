// Basic RegExp Lexer 
// MIT Licensed
// Zachary Carter <zack.carter@gmail.com>

var RegExpLexer = (function () {

// expand macros and convert to RegExp's
function prepareRules(rules, macros, actions) {
    var m,i,k,
        newRules = [];

    actions.push('switch(arguments[0]) {');

    for (i=0;i < rules.length; i++) {
        m = rules[i][0];
        for (k in macros) {
            if (macros.hasOwnProperty(k) && typeof m === 'string') {
                m = m.split("{"+k+"}").join(macros[k]);
            }
        }
        if (typeof m === 'string') {
            m = new RegExp("^"+m);
        }
        newRules.push(m);
        if (typeof rules[i][1] === 'function') {
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\) \{/, '').replace(/\}\s*$/, '');
        }
        actions.push('case '+i+':' +rules[i][1]+'\nbreak;');
    }
    actions.push("}");

    return newRules;
}

function RegExpLexer (dict, input) {
    dict = dict || {};
    var actions = [];
    this.rules = prepareRules(dict.rules, dict.macros, actions);
    var fun = actions.join("\n");
    "yytext yyleng yylineno".split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp("("+yy+")", "g"), "this.$1");
    });

    this.performAction = Function(fun);
    if (input) {
        this.setInput(input);
    }
}

RegExpLexer.prototype = {
    EOF: '',
    setInput: function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = '';
        return this;
    },
    input: function () {
        var ch = this._input[0];
        this._input = this._input.slice(1);
        return ch;
    },
    unput: function (ch) {
        this._input = ch + this._input;
        return this;
    },
    more: function () {
        this._more = true;
        return this;
    },
    // displays upcoming input, i.e. for error messages
    upcomingInput: function () {
        return this._input.substr(0,20)+(this._input.length > 20 ? '...':'');
    },

    // return next match in input
    next: function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match;
        if (!this._more) {
            this.yytext = '';
        }
        for (var i=0;i < this.rules.length; i++) {
            match = this._input.match(this.rules[i]);
            if (match) {
                if (match[0].match(/\n/)) this.yylineno++;
                this.yytext += match[0];
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                token = this.performAction.call(this, i);
                if (token) return token;
                else return;
            }
        }
        if (this._input == this.EOF) {
            return this.EOF;
        } else {
            throw new Error('Lexical error: No match found for input: '+this.upcomingInput());
        }
    },

    // return next match that has a token
    lex: function () {
        var r = this.next();
        if (r != undefined) {
            return r;
        } else {
            return this.lex();
        }
    },

    generateModule: function generateModule(opt) {
        opt = opt || {};
        var out = "/* generated lexer */",
            moduleName = opt.moduleName || "lexer";
        out += "\nvar "+moduleName+" = "+uneval(RegExpLexer.prototype);
        out += ";\n"+moduleName+".performAction = "+String(this.performAction);
        out += ";\n"+moduleName+".rules = "+uneval(this.rules);
        return out;
    },
    generateCommonJSModule: function generateCommonJSModule(opt) {
        opt = opt || {};
        var out = "/* generated lexer as commonjs module */",
            moduleName = opt.moduleName || "lexer";
        out += this.generateModule(opt);
        out += "\nexports.lexer = "+moduleName;
        out += ";\nexports.lex = function () { return "+moduleName+".lex.apply(lexer, arguments); };";
        return out;
    }
};

return RegExpLexer;

})()

if (typeof exports !== 'undefined') 
    exports.RegExpLexer = RegExpLexer;

