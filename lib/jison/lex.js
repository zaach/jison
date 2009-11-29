/* Basic RegExp Lexer */
// By Zachary Carter

var Lex = (function () {

function lexError(msg) {
    throw new Error('Lexical error: '+msg);
}

// expand macros and convert to RegExp's
function prepareRules(rules, macros) {
    var m,i,k;
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
        rules[i][0] = m;
        if (typeof rules[i][1] === 'string') {
            rules[i][1] = new Function(rules[i][1]);
        }
    }
    return rules;
}

function RegExpLexer (dict, input) {
    dict = dict || {};
    this.rules = prepareRules(dict.rules, dict.macros);
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
            match = this._input.match(this.rules[i][0]);
            if (match) {
                this.yytext += match[0];
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                if (this.rules[i][1]) {
                    token = this.rules[i][1].call(this);
                }
                if (token) return token;
                else return;
            }
        }
        if (this._input == this.EOF) {
            return this.EOF;
        } else {
            lexError('No match found for input: '+this._input);
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
    }
};

// For polymorphism, since an array is already tokenized
function ArrayLexer (dict, input) {
    dict = dict || {};
    this.rules = dict.rules;
    if (input) {
      this.setInput(input.slice(0));
    }
}

ArrayLexer.prototype = Object.create(RegExpLexer.prototype);

// return next match in input
ArrayLexer.prototype.next = function () {
    if (!this._input.length) return '';

    return this._input.shift();
};

return {
    RegExpLexer: RegExpLexer,
    ArrayLexer: ArrayLexer
  };

})()

if (typeof exports !== 'undefined') {
    exports.Lex = Lex;
    exports.RegExpLexer = Lex.RegExpLexer;
}

