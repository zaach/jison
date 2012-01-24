<?php
/* Jison generated parser */
ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);

class Parser
{
	var $symbols_ = array();
	var $terminals_ = array();
	var $productions_ = array();
	var $table = array();
	var $defaultActions = array();
	var $debug = false;
	
	function __construct()
	{
		$accept = 'accept';
		$end = 'end';
		
		//parser
		$this->symbols_ = 		"<@@SYMBOLS@@>";
		$this->terminals_ = 	"<@@TERMINALS@@>";
		$this->productions_ = 	"<@@PRODUCTIONS@@>";
		$this->table = 			"<@@TABLE@@>";
		$this->defaultActions = "<@@DEFAULT_ACTIONS@@>";
		
		//lexer
		$this->lexer_rules = 			"<@@RULES@@>";
		$this->lexer_conditions = 	"<@@CONDITIONS@@>";
	}
	
	function trace()
	{
		
	}
	
	function performAction(&$thisS, $yytext, $yyleng, $yylineno, $yystate, $S, $_S, $O)
	{
		"<@@PARSER_PERFORM_ACTION@@>";
	}
	
	function popStack($n, $stack, $vstack, $lstack)
	{
		array_slice($stack, 0, 2 * $n);
		array_slice($vstack, 0, $n);
		array_slice($lstack, 0, $n);
	}

	function lex()
	{
		$token = $this->lexer_lex(); // $end = 1
		$token = (isset($token) ? $token : 1);
		
		// if token isn't its numeric value, convert
		if (!is_numeric($token)) {
			if (isset($this->symbols_[$token])) {
				$token = $this->symbols_[$token];
			}
		}
		return $token;
	}
	
	function parseError($str = "", $hash = array())
	{
		throw new Exception($str);
	}
	
	function parse($input)
	{
		$stack = array(0);
		$vstack = array(null);
		// semantic value stack
		$lstack = array();
		//location stack
		$yytext = '';
		$yylineno = 0;
		$yyleng = 0;
		$shifts = 0;
		$reductions = 0;
		$recovering = 0;
		$TERROR = 2;
		$EOF = 1;
		
		$this->setInput($input);
		$yyloc = $this->lexer_yylloc;
		$lstack[] = $yyloc;
		
		if (!empty($this->yy->parseError) && function_exists($this->yy->parseError)) $this->parseError = $this->yy->parseError;

		//$symbol, $preErrorSymbol, $state, $action, $a, $r, $yyval = array();
		//$p, $len, $newState, $expected, $recovered = false;
		
		$yyval = (object)array();
		$recovered = false;
		
		while (true) {
			// retreive state number from top of stack
			$state = $stack[count($stack) - 1];
			// use default actions if available
			if (isset($this->defaultActions[$state])) {
				$action = $this->defaultActions[$state];		
			} else {
				if (empty($symbol)) {
					$symbol = $this->lex();
				}
				// read action for current state and first input
				if (isset($this->table[$state][$symbol])) {
					$action = $this->table[$state][$symbol];
				}
			}
			
			if (empty($action) == true) {
				if (empty($recovering) == false) {
					// Report error
					$expected = array();
					foreach($this->table[$state] as $p) {
						if ($p > 2) {
							$expected[] = implode($p);
						}
					}
					
					$errStr = 'Parse error on line ' . ($yylineno + 1) . ":\n" . $this->showPosition() . '\nExpecting ' . implode(', ', $expected);
			
					$this->parseError($errStr, array(
						"text"=> $this->lexer_match,
						"token"=> $symbol,
						"line"=> $this->lexer_yylineno,
						"loc"=> $yyloc,
						"expected"=> $expected
					));
				}
	
				// just recovered from another error
				if ($recovering == 3) {
					if ($symbol == $EOF) {
						$this->parseError(isset($errStr) ? $errStr : 'Parsing halted.');
					}
		
					// discard current lookahead and grab another
					$yyleng = $this->lexer_yyleng;
					$yytext = $this->yytext;
					$yylineno = $this->lexer_yylineno;
					$yyloc = $this->lexer_yylloc;
					$symbol = $this->lex();
				}
	
				// try to recover from error
				while (true) {
					// check for error recovery rule in this state
					if (isset($this->table[$state][$TERROR])) {
						break 2;
					}
					if ($state == 0) {
						$this->parseError(isset($errStr) ? $errStr : 'Parsing halted.');
					}
					//$this->popStack(1, $stack, $vstack);
					
					array_slice($stack, 0, 2 * 1);
					array_slice($vstack, 0, 1);
					
					$state = $stack[count($stack) - 1];
				}
	
				$preErrorSymbol = $symbol; // save the lookahead token
				$symbol = $TERROR; // insert generic error symbol as new lookahead
				$state = $stack[count($stack) - 1];
				if (isset($this->table[$state][$TERROR])) {
					$action = $this->table[$state][$TERROR];
				}
				$recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
			}
	
			// this shouldn't happen, unless resolve defaults are off
			if (is_array($action[0]) && count($action) > 1) {
				$this->parseError('Parse Error: multiple actions possible at state: ' . $state . ', token: ' . $symbol);
			}
			
			switch ($action[0]) {
				case 1:
					// shift
					//$this->shiftCount++;
					$stack[] = $symbol;
					$vstack[] = $this->yytext;
					$lstack[] = $this->lexer_yylloc;
					$stack[] = $action[1]; // push state
					$symbol = "";
					if (empty($preErrorSymbol)) { // normal execution/no error
						$yyleng = $this->lexer_yyleng;
						$yytext = $this->yytext;
						$yylineno = $this->lexer_yylineno;
						$yyloc = $this->lexer_yylloc;
						if ($recovering > 0) $recovering--;
					} else { // error just occurred, resume old lookahead f/ before error
						$symbol = $preErrorSymbol;
						$preErrorSymbol = "";
					}
					break;
		
				case 2:
					// reduce
					$len = $this->productions_[$action[1]][1];
					// perform semantic action
					$vstackCount = count($vstack);
					$lstackCount = count($lstack);
					$yyval->S = $vstack[$vstackCount - $len];// default to $S = $1
					// default location, uses first token for firsts, last for lasts
					$yyval->_S = array(
                        "first_line"=> 		$lstack[$lstackCount - (isset($len) ? $len : 1)]['first_line'],
                        "last_line"=> 		$lstack[$lstackCount - 1]['last_line'],
                        "first_column"=> 	$lstack[$lstackCount - (isset($len) ? $len : 1)]['first_column'],
                        "last_column"=> 	$lstack[$lstackCount - 1]['last_column']
                    );
					
					$r = $this->performAction($yyval->S, $yytext, $yyleng, $yylineno, $action[1], $vstack, $lstack, $vstackCount - 1);
					
					if (empty($r) == false) {
						return $r;
					}
					
					// pop off stack		
					if ($len > 0) {
						$stack = array_slice($stack, 0, -1 * $len * 2);
						$vstack = array_slice($vstack, 0, -1 * $len);
						$lstack = array_slice($lstack, 0, -1 * $len);
					}
					
					$stack[] = $this->productions_[$action[1]][0]; // push nonterminal (reduce)
					$vstack[] = $yyval->S;
					$lstack[] = $yyval->_S;
					
					// goto new state = table[STATE][NONTERMINAL]
					$stackCount = count($stack);
					$newState = $this->table[$stack[$stackCount - 2]][$stack[$stackCount - 1]];
					$stack[] = $newState;
					break;
		
				case 3:
					// accept
					return true;
			}

		}

		return true;
	}


	/* Jison generated lexer */
	var $lexer_EOF = 1;
	var $lexer_S = "";
	var $lexer_yy = "";
	var $lexer_yylineno = "";
	var $lexer_yyleng = "";
	var $yytext = "";
	var $lexer_matched = "";
	var $lexer_match = "";
	var $lexer_yylloc = array();
	var $lexer_conditionsStack = array();
	var $lexer_rules = array();
	var $lexer_conditions = array();
	var $lexer_done = false;
	var $lexer_less;
	var $lexer_more;

	function setInput($input)
	{
		$this->lexer_input = $input;
		$this->lexer_more = $this->lexer_less = $this->lexer_done = false;
		$this->lexer_yylineno = $this->lexer_yyleng = 0;
		$this->yytext = $this->lexer_matched = $this->lexer_match = '';
		$this->lexer_conditionStack = array('INITIAL');
		$this->lexer_yylloc = array(
			"first_line"=> 1,
			"first_column"=> 0,
			"last_line"=> 1,
			"last_column"=> 0
		);
	}
	
	function input()
	{
		$ch = $this->lexer_input[0];
		$this->yytext .= $ch;
		$this->lexer_yyleng++;
		$this->lexer_match .= $ch;
		$this->lexer_matched .= $ch;
		$lines = preg_match("/\n/", $ch);
		if (count($lines) > 0) $this->lexer_yylineno++;
		array_slice($this->lexer_input, 1);
		return $ch;
	}
	
	function unput($ch)
	{
		$this->lexer_input = $ch . $this->lexer_input;
		return $this;
	}
	
	function more()
	{
		$this->lexer_more = true;
		return $this;
	}
	
	function pastInput()
	{
		$past = substr($this->lexer_matched, 0, count($this->lexer_matched) - count($this->lexer_match));
		return (strlen($past) > 20 ? '...' : '') . preg_replace("/\n/", "", substr($past, -20));
	}
	
	function upcomingInput()
	{
		$next = $this->lexer_match;
		if (strlen($next) < 20) {
			$next .= substr($this->lexer_input, 0, 20 - strlen($next));
		}
		return preg_replace("/\n/", "", substr($next, 0, 20) . (strlen($next) > 20 ? '...' : ''));
	}
	
	function showPosition()
	{
		$pre = $this->pastInput();
		$c = implode(array(strlen($pre) + 1), "-");
		return $pre . $this->upcomingInput() . "\n" . $c . "^";
	}
	
	function next()
	{
		if ($this->lexer_done == true) {
			return $this->lexer_EOF;
		}
		
		if ($this->lexer_input == false) $this->lexer_input = "";
		if (empty($this->lexer_input)) $this->lexer_done = true;

		if ($this->lexer_more == false) {
			$this->yytext = '';
			$this->lexer_match = '';
		}
		
		$rules = $this->currentRules();
		for ($i = 0; $i < count($rules); $i++) {
			preg_match($this->lexer_rules[$rules[$i]], $this->lexer_input, $match);
			if ( isset($match[0]) ) {
				preg_match_all("/\n.*/", $match[0], $lines, PREG_PATTERN_ORDER);
				if (count($lines) > 1) $this->lexer_yylineno += count($lines);
				$this->lexer_yylloc = array(
					"first_line"=> $this->lexer_yylloc['last_line'],
					"last_line"=> $this->lexer_yylineno + 1,
					"first_column"=> $this->lexer_yylloc['last_column'],
					"last_column"=> $lines ? count($lines[count($lines) - 1]) - 1 : $this->lexer_yylloc['last_column'] + count($match[0])
				);
				$this->yytext .= $match[0];
				$this->lexer_match .= $match[0];
				$this->lexer_matches = $match[0];
				$this->lexer_yyleng = strlen($this->yytext);
				$this->lexer_more = false;
				$this->lexer_input = substr($this->lexer_input, strlen($match[0]), strlen($this->lexer_input));
				$this->lexer_matched .= $match[0];
				$token = $this->lexer_performAction($this->lexer_yy, $this, $rules[$i],$this->lexer_conditionStack[count($this->lexer_conditionStack) - 1]);
				
				if (empty($token) == false) {
					return $token;
				} else {
					return;
				}
			}
		}
		
		if (empty($this->lexer_input)) {
			return $this->lexer_EOF;
		} else {
			$this->parseError('Lexical error on line ' . ($this->lexer_yylineno + 1) . '. Unrecognized text.\n' . $this->showPosition(), array(
				"text"=> "",
				"token"=> null,
				"line"=> $this->lexer_yylineno
			));
		}
	}
	
	function lexer_lex()
	{
		$r = $this->next();
		if (empty($r) == false) {
			return $r;
		} else if ($this->lexer_done != true) {
			return $this->lexer_lex();
		}
	}
	
	function begin($condition)
	{
		$this->lexer_conditionStack[] = $condition;
	}
	
	function popState()
	{
		return array_pop($this->lexer_conditionStack);
	}
	
	function currentRules()
	{
		return $this->lexer_conditions[
			$this->lexer_conditionStack[
				count($this->lexer_conditionStack) - 1
			]
		]['rules'];
	}
	
	function lexer_performAction(&$yy, $yy_, $avoiding_name_collisions, $YY_START = null)
	{
		$YYSTATE = $YY_START;
		"<@@LEXER_PERFORM_ACTION@@>";
	}
}
