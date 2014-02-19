var fs = require('fs'),
    util = require('util'),
    exec = require('child_process').exec,
    path = require('path');

GLOBAL.convertToSyntax = function (types, body) {
    if (types['cs'] || types['CS'] || types['c#'] || types['C#'] || types['csharp'] || types['CSharp']) {
        return body;
    }
    return '';
};

function puts(error, stdout, stderr) {
    util.puts(stdout);
}

console.log("Executing: " + "jison " + process.argv[2]);

exec("jison " + process.argv[2], function (error) {
    if (error) {
        console.log(error);
        return;
    }
    
    String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

    var fileName = process.argv[2].replace(/(.jison|.json)/, '')
        comments = require(path.resolve(__dirname, '../../../comments.js')),
        requirePath = fileName + '.js';
    
    console.log("Opening newly created jison js file: " + fileName + '.js');

    var Parser = require(requirePath),
        symbols = Parser.parser.symbols_,
        terminals = Parser.parser.terminals_,
        productions = Parser.parser.productions_,
        table = Parser.parser.table,
        defaultActions = Parser.parser.defaultActions,
        //turn regex into string
        rules = [];
    
    for (var i = 0; i < Parser.parser.lexer.rules.length; i++) {
        rules.push(Parser.parser.lexer.rules[i].toString());
    }

    var conditions = Parser.parser.lexer.conditions,
        options = Parser.parser.lexer.options,
        parserPerformAction = Parser.parser.performAction.toString(),
        lexerPerformAction = Parser.parser.lexer.performAction.toString();

    function jsFnBody(str) {
        str = str.split('{');
        str.shift();
        str = str.join('{');

        str = str.split('}');
        str.pop();
        str = str.join('}');

        return str;
    }

    function jsPerformActionToCs(str, isLex) {
        str = jsFnBody(str);
        str = str.replace("var $0 = $$.length - 1;", '');
        str = str.replace("var YYSTATE=YY_START", '');
        str = str.replace(new RegExp('[$]0', 'g'), 'so');
        str = str.replace(new RegExp('[$][$]', 'g'), 'ss');
        str = str.replace(new RegExp('default[:][;]', 'g'), '');
        str = str.replace(new RegExp('this[.][$]', 'g'), 'thisS');
        str = str.replace(new RegExp('[.]yytext', 'g'), '.yytext');
        str = str.replace(new RegExp('[$]accept', 'g'), 'accept');
        str = str.replace(new RegExp('[$]end', 'g'), 'end');
        str = str.replace(new RegExp('console[.]log'), '');
        str = str.replace(new RegExp('[$]avoiding_name_collisions'), 'avoidingNameCollisions');
		if (isLex) {
		    str = str
		        .replace(/(return[ ]+)(['"])([a-zA-Z0-9]+)(['"][;])/g, function() {
                    var symbol = symbols[arguments[3]];
                    if (symbol) {
		                return arguments[1] + symbol + ';';
                    }
                    return arguments[1] + '"' + arguments[3] + '";';
		        });
		}
		str = comments.parse(str);

        str = str.replace(/(\d)\n/g, function () {
            return arguments[1] + ';\n';
        });

        return str;
    }

    var FileName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
    var ClassName = FileName.replace(/^.*[\\\/]/, '').charAt(0).toUpperCase() + FileName.replace(/^.*[\\\/]/, '').slice(1);
    var option = {
    	'using': '',
        'namespace': 'Jison',
        'class': ClassName,
        'fileName': FileName + '.cs',
        'parserValue': ''
    };


    if (fileName.search(/jison/) !== -1) {
        var parserDefinition = fs.readFileSync(fileName + '.jison', "utf8");
        parserDefinition = parserDefinition.split(/\n/g);
        for (var i = 0; i < parserDefinition.length; i++) {
            if (parserDefinition[i].match('//option')) {
                parserDefinition[i] = parserDefinition[i].replace('//option ', '').trim();
                parserDefinition[i] = parserDefinition[i].split(':');
                option[parserDefinition[i][0]] = parserDefinition[i][1];
            }
        }
    }

    console.log(option);

    var parserRaw = fs.readFileSync(__dirname + "/Template.cs", "utf8");

    function parserInject() {
        var result = '\n';
        this.symbols = [];
        this.symbolsByIndex = [];
        this.tableInstantiation = [];
        this.tableDefinition = [];
		this.tableSetActions = [];
        this.table = [];
        this.terminals = [];
        this.defaultActions = [];
        this.productions = [];

        var actions = [
            'None',
            'Shift',
            'Reduce',
            'Accept'
        ];

        for (var i in symbols) {
            this.symbolsByIndex[symbols[i] * 1] = {
                name: i.replace('$', ''),
                index: symbols[i]
            };
        }

        for (var i in this.symbolsByIndex) {
            var symbol = this.symbolsByIndex[i];
            result += '\t\t\tvar symbol' + symbol.index + ' = new ParserSymbol("' + symbol.name + '", ' + symbol.index + ');\n';
            this.symbols.push('\t\t\tSymbols.Add(symbol' + symbol.index + ')');
            
        }

        result += '\n\n\t\t\tSymbols = new ParserSymbols();\n';
		result += this.symbols.join(';\n') + ';\n\n';

        for (var i in terminals) {
            this.terminals.push('\t\t\t\t\t{' + i + ', symbol' + i + '}');
        }

        result += '\t\t\tTerminals = new Dictionary<int, ParserSymbol>\n\t\t\t\t{\n' + this.terminals.join(',\n') + '\n\t\t\t\t};\n\n';
        
        for (var i in table) {
            var items = [];
            for (var j in table[i]) {
                var item = table[i][j],
                    action = 0,
                    state = 0;
                if (item.join) { //is array
                    if (item.length == 1) {
                        action = item[0];
                        items.push('\t\t\t\t\t{' + j + ', new ParserAction(' + actions[action] + ')}');
                    } else {
                        action = item[0];
                        state = item[1];
                        items.push('\t\t\t\t\t{' + j + ', new ParserAction(' + actions[action] + ', ref table' + state + ')}');
                    }
                } else {
                    state = item;
                    items.push('\t\t\t\t\t{' + j + ', new ParserAction(' + actions[action] + ', ref table' + state + ')}');
                }
            }
            
            this.tableInstantiation.push('\t\t\tvar table' + i + ' = new ParserState(' + i + ')');
            this.tableDefinition.push('\t\t\tvar tableDefinition' + i + ' = new Dictionary<int, ParserAction>\n\t\t\t\t{\n' + items.join(',\n') + '\n\t\t\t\t}');
			this.tableSetActions.push('\t\t\ttable' + i + '.SetActions(ref tableDefinition' + i + ')');
            this.table.push('\t\t\t\t\t{' + i + ', table' + i + '}');
        }

        result += this.tableInstantiation.join(';\n') + ';\n\n';
        result += this.tableDefinition.join(';\n\n') + ';\n\n';
        result += this.tableSetActions.join(';\n') + ';\n\n';
        result += '\t\t\tTable = new Dictionary<int, ParserState>\n\t\t\t\t{\n' + this.table.join(',\n') + '\n\t\t\t\t};\n\n';

        for (var i in defaultActions) {
            var action = defaultActions[i][0];
            var state = defaultActions[i][1];
           this.defaultActions.push('\t\t\t\t\t{' + i + ', new ParserAction(' + actions[action] +', ref table' +  state + ')}');
        }

        result += '\t\t\tDefaultActions = new Dictionary<int, ParserAction>\n\t\t\t\t{\n' + this.defaultActions.join(',\n') + '\n\t\t\t\t};\n\n';
        
        for (var i in productions) {
            var production = productions[i];
            if (production.join) {
                var symbol = production[0],
                    len = production[1];
                this.productions.push('\t\t\t\t\t{' + i + ', new ParserProduction(symbol' + this.symbolsByIndex[symbol].index + ',' + len + ')}');
            } else {
                var symbol = production;
                this.productions.push('\t\t\t\t\t{' + i + ', new ParserProduction(symbol' + this.symbolsByIndex[symbol].index + ')}');
            }
        }

        result += '\t\t\tProductions = new Dictionary<int, ParserProduction>\n\t\t\t\t{\t\t\t\t\n' + this.productions.join(',\n') + '\n\t\t\t\t};\n\n\n';

        return result;
    }

    function lexerInject() {
        var result = '\n';
        this.rules = [],
        this.conditions = [];
        
        for (var i in rules) {
            this.rules.push('\t\t\t\t\t{' + i + ', new Regex(@"' + rules[i].substring(1, rules[i].length - 1).replace(/"/g, '""') + '")}');
        }

        result += '\t\t\tRules = new Dictionary<int, Regex>\n\t\t\t\t{\n' + this.rules.join(',\n') + '\n\t\t\t\t};\n\n';

        for (var i in conditions) {
            this.conditions.push('\t\t\t\t\t{"' + i + '", new LexerConditions(new List<int> { ' + conditions[i].rules.join(',') + ' }, ' + conditions[i].inclusive + ')}');
        }

        result += '\t\t\tConditions = new Dictionary<string, LexerConditions>\n\t\t\t\t{\n' + this.conditions.join(',\n') + '\n\t\t\t\t};\n\n';

        return result;
    }
    
    parserRaw = parserRaw
    	.replace(new RegExp('//@@USING_INJECT@@', 'g'),(option.using ? 'using ' + option.using.split(',').join(';\nusing ') + ';' : ''))
        .replace(new RegExp('[/][*][*][/]namespace Jison[/][*][*][/]', 'g'), 'namespace ' + option.namespace)
        .replace(new RegExp('[/][*][*][/]class Parser[/][*][*][/]', 'g'), 'class ' + option.class)
        .replace(new RegExp('[/][*][*][/]public Parser[/][*][*][/]', 'g'), 'public ' + option.class)
        .replace(new RegExp('[/][*][*][/]ParserValue[/][*][*][/]', 'g'), (option.parserValue || 'ParserValue'))
        .replace('new Parser(', 'new ' + option.class + '(')

        .replace('//@@PARSER_INJECT@@',
            parserInject()
        )
    
        .replace('//@@LEXER_INJECT@@',
            lexerInject()
        )
		
		.replace('//@@ParserPerformActionInjection@@',
			jsPerformActionToCs(parserPerformAction)
		)
		
		.replace('//@@LexerPerformActionInjection@@',
			jsPerformActionToCs(lexerPerformAction, true)
		);

    fs.writeFile(option.fileName, parserRaw, function (err) {
        if (err) {
            console.log("Something went bad");
            console.log(err);
        } else {
            console.log("Success writing new parser files " + fileName + ".js" + " & " + option.fileName);
            console.log("Please Note: The csharp version of the jison parser is only an ATTEMPTED conversion");
        }
    });
});