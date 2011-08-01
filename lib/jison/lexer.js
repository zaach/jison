// Basic RegExp Lexer 
// MIT Licensed
// Zachary Carter <zach@carter.name>

var RegExpLexer = (function () {

// expand macros and convert matchers to RegExp's
function prepareRules(rules, macros, actions, tokens, startConditions) {
    var m,i,k,action,conditions,
        newRules = [];

    if (macros) {
        macros = prepareMacros(macros);
    }

    actions.push('switch($avoiding_name_collisions) {');

    for (i=0;i < rules.length; i++) {
        if (Object.prototype.toString.apply(rules[i][0]) !== '[object Array]') {
            // implicit add to all inclusive start conditions
            for (k in startConditions) {
                if (startConditions[k].inclusive) {
                    startConditions[k].rules.push(i);
                }
            }
        } else if (rules[i][0][0] === '*') {
            // Add to ALL start conditions
            for (k in startConditions) {
                startConditions[k].rules.push(i);
            }
            rules[i].shift();
        } else {
            // Add to explicit start conditions
            conditions = rules[i].shift();
            for (k=0;k<conditions.length;k++) {
                startConditions[conditions[k]].rules.push(i);
            }
        }

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
            rules[i][1] = String(rules[i][1]).replace(/^\s*function \(\)\s?\{/, '').replace(/\}\s*$/, '');
        }
        action = rules[i][1];
        if (tokens && action.match(/return '[^']+'/)) {
            action = action.replace(/return '([^']+)'/, function (str, pl) {
                        return "return "+(tokens[pl] ? tokens[pl] : "'"+pl+"'");
                    });
        }
        actions.push('case '+i+':' +action+'\nbreak;');
    }
    actions.push("}");

    return newRules;
}

// expand macros within macros
function prepareMacros (macros) {
    var cont = true,
        m,i,k,mnew;
    while (cont) {
        cont = false;
        for (i in macros) if (macros.hasOwnProperty(i)) {
            m = macros[i];
            for (k in macros) if (macros.hasOwnProperty(k) && i !== k) {
                mnew = m.split("{"+k+"}").join(macros[k]);
                if (mnew !== m) {
                    cont = true;
                    macros[i] = mnew;
                }
            }
        }
    }
    return macros;
}

// expand macros within macros
function prepareStartConditions (conditions) {
    var sc,
        hash = {};
    for (sc in conditions) if (conditions.hasOwnProperty(sc)) {
        hash[sc] = {rules:[],inclusive:!!!conditions[sc]};
    }
    return hash;
}

function buildActions (dict, tokens) {
    var actions = [dict.actionInclude || '', "var YYSTATE=YY_START"];
    var tok;
    var toks = {};

    for (tok in tokens) {
        toks[tokens[tok]] = tok;
    }

    this.rules = prepareRules(dict.rules, dict.macros, actions, tokens && toks, this.conditions);
    var fun = actions.join("\n");
    "yytext yyleng yylineno".split(' ').forEach(function (yy) {
        fun = fun.replace(new RegExp("("+yy+")", "g"), "yy_.$1");
    });

    return Function("yy,yy_,$avoiding_name_collisions,YY_START", fun);
}

function RegExpLexer (dict, input, tokens) {
    if (typeof dict === 'string') {
        dict = require("./jisonlex").parse(dict);
    }
    dict = dict || {};
    this.conditions = prepareStartConditions(dict.startConditions);
    this.conditions['INITIAL'] = {rules:[],inclusive:true};

    this.performAction = buildActions.call(this, dict, tokens);
    this.conditionStack = ['INITIAL'];

    this.moduleInclude = dict.moduleInclude;

    this.yy = {};
    if (input) {
        this.setInput(input);
    }
}

RegExpLexer.prototype = {
    EOF: 1,
    parseError: function parseError(str, hash) {
        if (this.yy.parseError) {
            this.yy.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },

    // resets the lexer, sets new input 
    setInput: function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        return this;
    },
    // consumes and returns one char from the input
    input: function () {
        var ch = this._input[0];
        this.yytext+=ch;
        this.yyleng++;
        this.match+=ch;
        this.matched+=ch;
        var lines = ch.match(/\n/);
        if (lines) this.yylineno++;
        this._input = this._input.slice(1);
        return ch;
    },
    // unshifts one char into the input
    unput: function (ch) {
        this._input = ch + this._input;
        return this;
    },
    // When called from action, caches matched text and appends it on next action
    more: function () {
        this._more = true;
        return this;
    },
    // displays upcoming input, i.e. for error messages
    pastInput: function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
    // displays upcoming input, i.e. for error messages
    upcomingInput: function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
    // displays upcoming input, i.e. for error messages
    showPosition: function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },

    // return next match in input
    next: function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            match = this._input.match(this.rules[rules[i]]);
            if (match) {
                lines = match[0].match(/\n.*/g);
                if (lines) this.yylineno += lines.length;
                this.yylloc = {first_line: this.yylloc.last_line,
                               last_line: this.yylineno+1,
                               first_column: this.yylloc.last_column,
                               last_column: lines ? lines[lines.length-1].length-1 : this.yylloc.last_column + match[0].length}
                this.yytext += match[0];
                this.match += match[0];
                this.matches = match;
                this.yyleng = this.yytext.length;
                this._more = false;
                this._input = this._input.slice(match[0].length);
                this.matched += match[0];
                token = this.performAction.call(this, this.yy, this, rules[i],this.conditionStack[this.conditionStack.length-1]);
                if (token) return token;
                else return;
            }
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(), 
                    {text: "", token: null, line: this.yylineno});
        }
    },

    // return next match that has a token
    lex: function lex () {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
    begin: function begin (condition) {
        this.conditionStack.push(condition);
    },
    popState: function popState () {
        return this.conditionStack.pop();
    },
    _currentRules: function _currentRules () {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },

    generate:  function generate(opt) {
        var code = "";
        if (opt.commonjs)
            code = this.generateCommonJSModule(opt);
        else
            code = this.generateModule(opt);

        return code;
    },
    generateModule: function generateModule(opt) {
        opt = opt || {};
        var out = "/* Jison generated lexer */",
            moduleName = opt.moduleName || "lexer";
        out += "\nvar "+moduleName+" = (function(){\n"+(this.moduleInclude||'')+"\nvar lexer = ({";
        var p = [];
        for (var k in RegExpLexer.prototype)
            if (RegExpLexer.prototype.hasOwnProperty(k) && k.indexOf("generate") === -1)
            p.push(k + ":" + (RegExpLexer.prototype[k].toString() || '""'));
        out += p.join(",\n");
        out += "})";
        out += ";\nlexer.performAction = "+String(this.performAction);
        out += ";\nlexer.rules = [" + this.rules + "]";
        out += ";\nlexer.conditions = " + JSON.stringify(this.conditions);
        out += ";return lexer;})()";
        return out;
    },
    generateCommonJSModule: function generateCommonJSModule(opt) {
        opt = opt || {};
        var out = "/* Jison generated lexer as commonjs module */",
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

