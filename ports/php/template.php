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
	var $lexer;
	var $debug = false;
	
	function __construct($lexer = null)
	{
		$this->lexer = (!empty($lexer) ? $lexer : new Lexer);
		
		$accept = 'accept';
		$end = 'end';
		
		$this->symbols_ = 		"<@@SYMBOLS@@>";
		$this->terminals_ = 	"<@@TERMINALS@@>";
		$this->productions_ = 	"<@@PRODUCTIONS@@>";
		$this->table = 			"<@@TABLE@@>";
		$this->defaultActions = "<@@DEFAULT_ACTIONS@@>";
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
		$token = $this->lexer->lex(); // $end = 1
		$token = (isset($token) ? $token : 1);
		
		// if token isn't its numeric value, convert
		if (!is_numeric($token)) {
			if (isset($this->symbols_[$token])) {
				$token = $this->symbols_[$token];
			}
		}
		return $token;
	}
	
	function parseError($str, $hash)
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
		
		$this->lexer->setInput($input);
		$yyloc = $this->lexer->yylloc;
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
					
					$errStr = 'Parse error on line ' . ($yylineno + 1) . ":\n" . $this->lexer->showPosition() . '\nExpecting ' . implode(', ', $expected);
			
					$this->lexer->parseError($errStr, array(
						"text"=> $this->lexer->match,
						"token"=> $symbol,
						"line"=> $this->lexer->yylineno,
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
					$yyleng = $this->lexer->yyleng;
					$yytext = $this->lexer->yytext;
					$yylineno = $this->lexer->yylineno;
					$yyloc = $this->lexer->yylloc;
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
					$vstack[] = $this->lexer->yytext;
					$lstack[] = $this->lexer->yylloc;
					$stack[] = $action[1]; // push state
					$symbol = "";
					if (empty($preErrorSymbol)) { // normal execution/no error
						$yyleng = $this->lexer->yyleng;
						$yytext = $this->lexer->yytext;
						$yylineno = $this->lexer->yylineno;
						$yyloc = $this->lexer->yylloc;
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
}

/* Jison generated lexer */
class Lexer
{
	var $EOF = 1;
	var $S = "";
	var $yy = "";
	var $yylineno = "";
	var $yyleng = "";
	var $yytext = "";
	var $matched = "";
	var $match = "";
	var $yylloc = array();
	var $conditionsStack = array();
	var $rules = array();
	var $conditions = array();
	
	function __construct()
	{
		$this->rules = 		"<@@RULES@@>";
		$this->conditions = "<@@CONDITIONS@@>";
	}
	
	function parseError($str, $hash)
	{
		throw new Exception($str);
	}
	
	function setInput($input)
	{
		$this->_input = $input;
		$this->_more = $this->_less = $this->done = false;
		$this->yylineno = $this->yyleng = 0;
		$this->yytext = $this->matched = $this->match = '';
		$this->conditionStack = array('INITIAL');
		$this->yylloc = array(
			"first_line"=> 1,
			"first_column"=> 0,
			"last_line"=> 1,
			"last_column"=> 0
		);
		return $this;
	}
	
	function input()
	{
		$ch = $this->_input[0];
		$this->yytext .= $ch;
		$this->yyleng++;
		$this->match .= $ch;
		$this->matched .= $ch;
		$lines = preg_match("/\n/", $ch);
		if (count($lines) > 0) $this->yylineno++;
		array_slice($this->_input, 1);
		return $ch;
	}
	
	function unput($ch)
	{
		$this->_input = $ch . $this->_input;
		return $this;
	}
	
	function more()
	{
		$this->_more = true;
		return $this;
	}
	
	function pastInput()
	{
		$past = substr($this->matched, 0, count($this->matched) - count($this->match));
		return (strlen($past) > 20 ? '...' : '') . preg_replace("/\n/", "", substr($past, -20));
	}
	
	function upcomingInput()
	{
		$next = $this->match;
		if (strlen($next) < 20) {
			$next .= substr($this->_input, 0, 20 - strlen($next));
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
		if ($this->done == true) {
			return $this->EOF;
		}
		
		if ($this->_input == false) $this->_input = "";
		if (empty($this->_input)) $this->done = true;

		if ($this->_more == false) {
			$this->yytext = '';
			$this->match = '';
		}
		
		$rules = $this->_currentRules();
		for ($i = 0; $i < count($rules); $i++) {
			preg_match($this->rules[$rules[$i]], $this->_input, $match);
			if ( isset($match[0]) ) {
				preg_match_all("/\n.*/", $match[0], $lines, PREG_PATTERN_ORDER);
				if (count($lines) > 1) $this->yylineno += count($lines);
				$this->yylloc = array(
					"first_line"=> $this->yylloc['last_line'],
					"last_line"=> $this->yylineno + 1,
					"first_column"=> $this->yylloc['last_column'],
					"last_column"=> $lines ? count($lines[count($lines) - 1]) - 1 : $this->yylloc['last_column'] + count($match[0])
				);
				$this->yytext .= $match[0];
				$this->match .= $match[0];
				$this->matches = $match[0];
				$this->yyleng = strlen($this->yytext);
				$this->_more = false;
				$this->_input = substr($this->_input, strlen($match[0]), strlen($this->_input));
				$this->matched .= $match[0];
				$token = $this->performAction($this->yy, $this, $rules[$i],$this->conditionStack[count($this->conditionStack) - 1]);
				
				if (empty($token) == false) {
					return $token;
				} else {
					return;
				}
			}
		}
		
		if (empty($this->_input)) {
			return $this->EOF;
		} else {
			$this->parseError('Lexical error on line ' . ($this->yylineno + 1) . '. Unrecognized text.\n' . $this->showPosition(), array(
				"text"=> "",
				"token"=> null,
				"line"=> $this->yylineno
			));
		}
	}
	
	function lex()
	{
		$r = $this->next();
		if (empty($r) == false) {
			return $r;
		} else if ($this->done != true) {
			return $this->lex();
		}
	}
	
	function begin($condition)
	{
		$this->conditionStack[] = $condition;
	}
	
	function popState()
	{
		return array_pop($this->conditionStack);
	}
	
	function _currentRules()
	{
		return $this->conditions[
			$this->conditionStack[
				count($this->conditionStack) - 1
			]
		]['rules'];
	}
	
	function performAction(&$yy, $yy_, $avoiding_name_collisions, $YY_START = null)
	{
		$YYSTATE = $YY_START;
		"<@@LEXER_PERFORM_ACTION@@>";
	}
}
