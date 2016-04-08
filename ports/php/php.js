GLOBAL.convertToSyntax = function (types, body) {
    if (types['php'] || types['PHP']) {
        return body;
    }
    return '';
};

var fs = require('fs'),
    spawn = require('child_process').spawn,
    path = require('path'),
    createPHPFile = function (jisonFileName) {
        String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, '');};

        var fileName = jisonFileName.replace('.jison', ''),
            comments = require(path.resolve(__dirname, '../comments.js')),
            requirePath = path.resolve(jisonFileName).replace('.jison', '') + '.js';

        console.log("\n\n\nOpening newly created jison js file: " + fileName + '.js');

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

        function jsPerformActionToPhp(str) {
            str = jsFnBody(str);
            str = str.replace("var $0 = $$.length - 1;", '');
            str = str.replace("var YYSTATE=YY_START", '');
            str = str.replace(new RegExp('[$]0', 'g'), '$o');
            str = str.replace(new RegExp('[$][$]', 'g'), '$s');
            str = str.replace(new RegExp('default[:][;]', 'g'), '');
            str = str.replace(new RegExp('this[.][$]', 'g'), '$thisS');
            str = str.replace(new RegExp('this[-][>]', 'g'), '$this->');
            str = str.replace(new RegExp('yystate', 'g'), '$yystate');
            //str = str.replace(new RegExp('yytext', 'g'), 'yy->text');
            str = str.replace(new RegExp('[$]yy[_][.]', 'g'), '$this->yy->');
            str = str.replace(new RegExp('[$]this[-][>]yy[-][>]yy', 'g'), '$this->yy->');
            str = str.replace(new RegExp('[.]yytext', 'g'), '->text');
            str = str.replace(new RegExp('yy[.]', 'g'), 'yy->');
            str = str.replace(new RegExp('yy_[.][$]', 'g'), '$this->yy->');
            str = str.replace(new RegExp('[$]accept', 'g'), 'accept');
            str = str.replace(new RegExp('[$]end', 'g'), 'end');
            str = str.replace(new RegExp('console[.]log'), '');
            str = str.replace(new RegExp('[$]avoiding_name_collisions'), '$avoidingNameCollisions');

            str = comments.parse(str);

            str = str.replace(/(\d)\n/g, function () {
                return arguments[1] + ';\n';
            });

            return str;
        }


        var option = {
            'namespace': 'Jison',
            'class': fileName,
            'fileName': fileName + '.php',
            'extends': '',
            'use': '',
            'parserValue': ''
        };

        var parserDefinition = fs.readFileSync(fileName + '.jison', "utf8");
        parserDefinition = parserDefinition.split(/\n/g);
        for(var i = 0; i < parserDefinition.length; i++) {
            if (parserDefinition[i].match('//option')) {
                parserDefinition[i] = parserDefinition[i].replace('//option ', '');
                parserDefinition[i] = parserDefinition[i].split(':');
                option[parserDefinition[i][0]] = parserDefinition[i][1];
            }
        }

        var parserRaw = fs.readFileSync(__dirname + "/template.php", "utf8");

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
                'none',
                'shift',
                'reduce',
                'accept'
            ];

            for (var i in symbols) {
                this.symbolsByIndex[symbols[i] * 1] = {
                    name: i.replace('$', ''),
                    index: symbols[i]
                };
            }

            for (var i in this.symbolsByIndex) {
                var symbol = this.symbolsByIndex[i];
                result += '\t\t\t$symbol' + symbol.index + ' = new ParserSymbol("' + symbol.name + '", ' + symbol.index + ');\n';
                this.symbols.push('\t\t\t$this->symbols[' + symbol.index + '] = $symbol' + symbol.index + '');
                this.symbols.push('\t\t\t$this->symbols["' + symbol.name + '"] = $symbol' + symbol.index + '');

            }

            result += this.symbols.join(';\n') + ';\n\n';

            for (var i in terminals) {
                this.terminals.push('\t\t\t\t\t' + i + '=>&$symbol' + i + '');
            }

            result += '\t\t\t$this->terminals = array(\n' + this.terminals.join(',\n') + '\n\t\t\t\t);\n\n';

            for (var i in table) {
                var items = [];
                for (var j in table[i]) {
                    var item = table[i][j],
                        action = 0,
                        state = 0;
                    if (item.join) { //is array
                        if (item.length == 1) {
                            action = item[0];
                            items.push('\t\t\t\t\t' + j + '=>new ParserAction($this->' + actions[action] + ')');
                        } else {
                            action = item[0];
                            state = item[1];
                            items.push('\t\t\t\t\t' + j + '=>new ParserAction($this->' + actions[action] + ', $table' + state + ')');
                        }
                    } else {
                        state = item;
                        items.push('\t\t\t\t\t' + j + '=>new ParserAction($this->' + actions[action] + ', $table' + state + ')');
                    }
                }

                this.tableInstantiation.push('\t\t\t$table' + i + ' = new ParserState(' + i + ')');
                this.tableDefinition.push('\t\t\t$tableDefinition' + i + ' = array(\n\t\t\t\t\n' + items.join(',\n') + '\n\t\t\t\t)');
                this.tableSetActions.push('\t\t\t$table' + i + '->setActions($tableDefinition' + i + ')');
                this.table.push('\t\t\t\t\t' + i + '=>$table' + i + '');
            }

            result += this.tableInstantiation.join(';\n') + ';\n\n';
            result += this.tableDefinition.join(';\n\n') + ';\n\n';
            result += this.tableSetActions.join(';\n') + ';\n\n';
            result += '\t\t\t$this->table = array(\n\t\t\t\t\n' + this.table.join(',\n') + '\n\t\t\t\t);\n\n';

            for (var i in defaultActions) {
                var action = defaultActions[i][0];
                var state = defaultActions[i][1];
                this.defaultActions.push('\t\t\t\t\t' + i + '=>new ParserAction($this->' + actions[action] +', $table' +  state + ')');
            }

            result += '\t\t\t$this->defaultActions = array(\n\t\t\t\t\n' + this.defaultActions.join(',\n') + '\n\t\t\t\t);\n\n';

            for (var i in productions) {
                var production = productions[i];
                if (production.join) {
                    var symbol = production[0],
                        len = production[1];
                    this.productions.push('\t\t\t\t\t' + i + '=>new ParserProduction($symbol' + this.symbolsByIndex[symbol].index + ',' + len + ')');
                } else {
                    var symbol = production;
                    this.productions.push('\t\t\t\t\t' + i + '=>new ParserProduction($symbol' + this.symbolsByIndex[symbol].index + ')');
                }
            }

            result += '\t\t\t$this->productions = array(\n\t\t\t\t\n' + this.productions.join(',\n') + '\n\t\t\t\t);\n\n\n';

            return result;
        }

        function lexerInject() {
            var result = '\n';
            this.rules = [],
                this.conditions = [];

            for (var i in rules) {
                this.rules.push('\t\t\t\t\t' + i + '=>"/' + rules[i].substring(1, rules[i].length - 1).replace(/"/g, '\\"') + '/"');
            }

            result += '\t\t\t$this->rules = array(\n\t\t\t\t\n' + this.rules.join(',\n') + '\n\t\t\t\t);\n\n';

            for (var i in conditions) {
                this.conditions.push('\t\t\t\t\t"' + i + '"=>new LexerConditions(array( ' + conditions[i].rules.join(',') + '), ' + conditions[i].inclusive + ')');
            }

            result += '\t\t\t$this->conditions = array(\n\t\t\t\t\n' + this.conditions.join(',\n') + '\n\t\t\t\t);\n\n';

            return result;
        }

        parserRaw = parserRaw
            .replace('/**/namespace Jison;/**/', (option.namespace ? 'namespace ' + option.namespace + ';\nuse Exception;\n' : ''))
            .replace('/**/class Parser/**/', 'class ' + option.class + (option.extends ? ' extends ' + option.extends : ''))
            .replace('/**use**/', (option.use ? 'use ' + option.use : ''))
            .replace(/[/][*][*][/]ParserValue[/][*][*][/]/g, (option.parserValue ? option.parserValue : 'ParserValue'))

            .replace('//@@PARSER_INJECT@@',
                parserInject()
            )

            .replace('//@@LEXER_INJECT@@',
                lexerInject()
            )

            .replace('//@@ParserPerformActionInjection@@',
                jsPerformActionToPhp(parserPerformAction)
            )

            .replace('//@@LexerPerformActionInjection@@',
                jsPerformActionToPhp(lexerPerformAction, true)
            );

        fs.writeFile(option.fileName, parserRaw, function(err) {
            if (err) {
                console.log("Something went bad");
            } else {
                console.log("**************SUCCESS**************");
                console.log("Success writing new parser files " + fileName + ".js" + " & " + option.fileName);
                console.log("Please Note: The php version of the jison parser is only an ATTEMPTED conversion");
            }
        });
    },
    msg = (console.log("Executing: " + "jison " + process.argv[2])),
    spawnedJison = spawn("jison", [process.argv[2]]);

spawnedJison.stdout.on('data', function (data) {
    console.log(data.toString());
    console.log("**************Possible Issue**************");
});

spawnedJison.on('exit', function(code) {
    if (code != 0) {
        console.log('Failed: ' + code);
    } else {
        createPHPFile(process.argv[2]);
    }
});