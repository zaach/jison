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
	
	var conditions = JSON.stringify(Parser.parser.lexer.conditions);
	var parserPerformAction = Parser.parser.performAction.toString();
	var lexerPerformAction = Parser.parser.lexer.performAction.toString();

	function jsToPhpGen(str, stripKey) {
		str = str.replace(new RegExp('[\[]', 'g'), "array(");
		str = str.replace(new RegExp('\]', 'g'), ")");
		str = str.replace(new RegExp('[\{]', 'g'), "array(");
		str = str.replace(new RegExp('[\}]', 'g'), ")");
		str = str.replace(new RegExp('[:]', 'g'), "=>");
		str = str.replace('$accept', 'accept');
		str = str.replace('$end', 'end');

		if (stripKey) {
			str = str.replace(new RegExp(',"', 'g'), ',');
			str = str.replace(new RegExp('"=>', 'g'), '=>');
			str = str.replace(new RegExp('[\(]"', 'g'), '(');
		}

		return str;
	}

	function jsFnToPhpGen(str) {
		str = str.split('{');
		str.shift();
		str = str.join('{');

		str = str.split('}');
		str.pop();
		str = str.join('}');

		return str;
	}

	function jsPerformActionToPhp(str) {
		str = jsFnToPhpGen(str);
		str = str.replace("var $0 = $$.length - 1;", '');
		str = str.replace("var YYSTATE=YY_START", '');
		str = str.replace(new RegExp('[$]0', 'g'), '$O');
		str = str.replace(new RegExp('[$][$]', 'g'), '$S');
		str = str.replace(new RegExp('parserlib[.]', 'g'), 'ParserLib::');
		str = str.replace(new RegExp('this[.][$]', 'g'), '$thisS');
		str = str.replace(new RegExp('yystate', 'g'), '$yystate');
		str = str.replace(new RegExp('this[-][->]', 'g'), '$this->');
		str = str.replace(new RegExp('yy[_][.]yytext', 'g'), '$yy_->yytext');
		str = str.replace(new RegExp('yy[.]', 'g'), '$yy->');
		str = str.replace(new RegExp('\][.]', 'g'), ']->');
		str = str.replace(new RegExp('\[\]', 'g'), 'array()');
		str = str.replace(new RegExp('default[:][;]', 'g'), '');
		
		str = str.split(/\n/g);
		
		for(var i = 0; i < str.length; i++) {
			if (str[i].match(/\/\/js/g)) {
				str[i] = "";
			} else if (str[i].match(/\/\/php /g)) {
				str[i] = str[i].replace(/\/\/php /g, '');
			}
		}
		
		str = str.join('\n');
		
		str = str.replace(/(\d)\n/g, function(){
			return arguments[1] + ';\n';
		});
		
		return str;
	}
	
	var parserRaw = fs.readFileSync(__dirname + "/template.php", "utf8");

	parserRaw = parserRaw.replace('"<@@SYMBOLS@@>"', jsToPhpGen(symbols));
	parserRaw = parserRaw.replace('"<@@TERMINALS@@>"', jsToPhpGen(terminals, true));
	parserRaw = parserRaw.replace('"<@@PRODUCTIONS@@>"', jsToPhpGen(productions));

	parserRaw = parserRaw.replace('"<@@TABLE@@>"', jsToPhpGen(table));
	parserRaw = parserRaw.replace('"<@@DEFAULT_ACTIONS@@>"', jsToPhpGen(defaultActions));

	parserRaw = parserRaw.replace('"<@@RULES@@>"', 'array(' + rules + ')');
	parserRaw = parserRaw.replace('"<@@CONDITIONS@@>"', jsToPhpGen(conditions));

	parserRaw = parserRaw.replace('"<@@PARSER_PERFORM_ACTION@@>";', jsPerformActionToPhp(parserPerformAction));
	parserRaw = parserRaw.replace('"<@@LEXER_PERFORM_ACTION@@>";', jsPerformActionToPhp(lexerPerformAction));

	fs.writeFile(fileName + '.php', parserRaw, function(err) {
		if (err) {
			console.log("Something went bad");
		} else {
			console.log("Success writing new parser files " + fileName + ".js" + " & " + fileName + ".php");
			console.log("Please Note: The php version of the jison parser is only an ATTEMPTED conversion");
		}
	});
});
