var fs = require('fs');
var util = require('util')
var exec = require('child_process').exec;
var path = require('path');

function puts(error, stdout, stderr) {
    util.puts(stdout);
}

console.log("Executing: " + "jison " + process.argv[2]);

exec("jison " + process.argv[2], function(error) {
    if (error) {
        console.log(error);
        return;
    }

    var fileName = process.argv[2].replace('.jison', '');
    var requirePath = path.resolve(process.argv[2]).replace('.jison', '') + '.js';

    console.log("Opening newly created jison js file: " + fileName + '.js');
    var Parser = require(requirePath);

    var symbols = JSON.stringify(Parser.parser.symbols_);
    var terminals = JSON.stringify(Parser.parser.terminals_);
    var productions = JSON.stringify(Parser.parser.productions_);

    var table = JSON.stringify(Parser.parser.table);
    var defaultActions = JSON.stringify(Parser.parser.defaultActions);

    //turn regex into string
    var rules = [];
    for(var i = 0; i < Parser.parser.lexer.rules.length; i++) {
        rules.push(Parser.parser.lexer.rules[i].toString());
    }
    rules = JSON.stringify(rules);
    rules = rules.substring(1, rules.length - 1);

    var conditions = Parser.parser.lexer.conditions;
    var options = JSON.stringify(Parser.parser.lexer.options);
    var parserPerformAction = Parser.parser.performAction.toString();
    var lexerPerformAction = Parser.parser.lexer.performAction.toString();

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
        str = str.replace(new RegExp('[$]0', 'g'), '$O');
        str = str.replace(new RegExp('[$][$]', 'g'), '$S');
        str = str.replace(new RegExp('default[:][;]', 'g'), '');
        str = str.replace(new RegExp('this[.][$]', 'g'), '$thisS');
        str = str.replace(new RegExp('this[-][>]', 'g'), '$this->');
        str = str.replace(new RegExp('yystate', 'g'), '$yystate');
        str = str.replace(new RegExp('yytext', 'g'), '$yytext');
        str = str.replace(new RegExp('[.]yytext', 'g'), '->yytext');
        str = str.replace(new RegExp('yy[.]', 'g'), 'yy->');
        str = str.replace(new RegExp('yy_[.][$]', 'g'), '$yy_->');
        str = str.replace(new RegExp('[$]accept', 'g'), 'accept');
        str = str.replace(new RegExp('[$]end', 'g'), 'end');
        str = str.replace(new RegExp('console[.]log'), '');

        str = str.split(/\n/g);

        var strNew = [];
        for(var i = 0; i < str.length; i++) {
            if (str[i].match(/\/\/php /g) || !str[i].match(/\/\/js/g)) {
                strNew.push( str[i].replace(/\/\/php /g, '') );
            }
        }

        str = strNew;

        str = str.join('\n');

        str = str.replace(/(\d)\n/g, function(){
            return arguments[1] + ';\n';
        });

        return str;
    }

    var phpOption = {
        parserClass: 'Parser',
        lexerClass: 'Lexer',
        fileName: fileName + '.php'
    };

    var parserDefinition = fs.readFileSync(fileName + '.jison', "utf8");
    parserDefinition = parserDefinition.split(/\n/g);
    for(var i = 0; i < parserDefinition.length; i++) {
        if (parserDefinition[i].match('//phpOption ')) {
            parserDefinition[i] = parserDefinition[i].replace('//phpOption ', '');
            parserDefinition[i] = parserDefinition[i].split(':');
            phpOption[parserDefinition[i][0]] = parserDefinition[i][1];
        }
    }

    console.log(phpOption);

    var parserRaw = fs.readFileSync(__dirname + "/template.php", "utf8");

    parserRaw = parserRaw
        .replace('class Parser',                'class ' + phpOption.parserClass)
        .replace('new Parser',                  'new ' + phpOption.parserClass)
        .replace('class Lexer',                 'class ' + phpOption.lexerClass)
        .replace('new Lexer',                   'new ' + phpOption.lexerClass)

        .replace('"<@@SYMBOLS@@>"',             "json_decode('" + (symbols) + "', true)")
        .replace('"<@@TERMINALS@@>"',           "json_decode('" + (terminals) + "', true)")
        .replace('"<@@PRODUCTIONS@@>"',         "json_decode('" + (productions) + "', true)")

        .replace('"<@@TABLE@@>"',               "json_decode('" + (table) + "', true)")
        .replace('"<@@DEFAULT_ACTIONS@@>"',     "json_decode('" + (defaultActions) + "', true)")

        .replace('"<@@RULES@@>"',               'array(' + rules + ')')
        .replace('"<@@CONDITIONS@@>"',           "json_decode('" + JSON.stringify(conditions) + "', true)")

        .replace('"<@@OPTIONS@@>"',             "json_decode('" + (options) + "', true)")

        .replace('"<@@PARSER_PERFORM_ACTION@@>";', jsPerformActionToPhp(parserPerformAction))
        .replace('"<@@LEXER_PERFORM_ACTION@@>";', jsPerformActionToPhp(lexerPerformAction));

    fs.writeFile(phpOption.fileName, parserRaw, function(err) {
        if (err) {
            console.log("Something went bad");
        } else {
            console.log("Success writing new parser files " + fileName + ".js" + " & " + phpOption.fileName);
            console.log("Please Note: The php version of the jison parser is only an ATTEMPTED conversion");
        }
    });
});