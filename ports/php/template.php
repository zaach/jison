<?php
/* Jison generated parser */

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
		//ini_set('error_reporting', E_ALL);
		//ini_set('display_errors', 1);
		
		$accept = 'accept';
		$end = 'end';
		
		//parser
		$this->symbols_ = 		"<@@SYMBOLS@@>";
		$this->terminals_ = 	"<@@TERMINALS@@>";
		$this->productions_ = 	"<@@PRODUCTIONS@@>";
		$this->table = 			"<@@TABLE@@>";
		$this->defaultActions = "<@@DEFAULT_ACTIONS@@>";
		
		//lexer
		$this->rules = 			"<@@RULES@@>";
		$this->conditions = 	"<@@CONDITIONS@@>";
	}
	
	function trace()
	{
		
	}
	
	function parser_performAction(&$thisS, $yytext, $yyleng, $yylineno, $yystate, $S, $_S, $O)
	{
		"<@@PARSER_PERFORM_ACTION@@>";
	}

	function parser_lex()
	{
		$token = $this->lexer_lex(); // $end = 1
		$token = (isset($token) ? $token : 1);
		
		// if token isn't its numeric value, convert
		if (isset($this->symbols_[$token]))
			return $this->symbols_[$token];
		
		return $token;
	}
	
	function parseError($str = "", $hash = array())
	{
		throw new Exception($str);
	}
	
	function parse($input)
	{
		$stack = array(0);
		$stackCount = 1;
		
		$vstack = array(null);
		$vstackCount = 1;
		// semantic value stack
		
		$lstack = array($this->yyloc);
		$lstackCount = 1;
		//location stack
		
		$shifts = 0;
		$reductions = 0;
		$recovering = 0;
		$TERROR = 2;
		$EOF = 1;
		
		$this->setInput($input);
		
		$yyval = (object)array();
		$recovered = false;
		
		while (true) {
			// retreive state number from top of stack
			$state = $stack[$stackCount - 1];
			// use default actions if available
			if (isset($this->defaultActions[$state])) {
				$action = $this->defaultActions[$state];		
			} else {
				if (empty($symbol)) {
					$symbol = $this->parser_lex();
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
					
					$errStr = 'Parse error on line ' . ($this->yylineno + 1) . ":\n" . $this->showPosition() . '\nExpecting ' . implode(', ', $expected);
			
					$this->parseError($errStr, array(
						"text"=> $this->match,
						"token"=> $symbol,
						"line"=> $this->yylineno,
						"loc"=> $this->yyloc,
						"expected"=> $expected
					));
				}
	
				// just recovered from another error
				if ($recovering == 3) {
					if ($symbol == $EOF) {
						$this->parseError(isset($errStr) ? $errStr : 'Parsing halted.');
					}
		
					// discard current lookahead and grab another
					$symbol = $this->parser_lex();
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
					
					array_slice($stack, 0, 2);
					$stackCount -= 2;
					
					array_slice($vstack, 0, 1);
					
					$state = $stack[$stackCount - 1];
				}
	
				$preErrorSymbol = $symbol; // save the lookahead token
				$symbol = $TERROR; // insert generic error symbol as new lookahead
				$state = $stack[$stackCount - 1];
				if (isset($this->table[$state][$TERROR])) {
					$action = $this->table[$state][$TERROR];
				}
				$recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
			}
	
			// this shouldn't happen, unless resolve defaults are off
			if (isset($action[2])) {
				$this->parseError('Parse Error: multiple actions possible at state: ' . $state . ', token: ' . $symbol);
			}
			
			switch ($action[0]) {
				case 1:
					// shift
					//$this->shiftCount++;
					$stack[] = $symbol;
					$stackCount++;
					
					$vstack[] = $this->yytext;
					$vstackCount++;
					
					$lstack[] = $this->yyloc;
					$lstackCount++;
					
					$stack[] = $action[1]; // push state
					$stackCount++;

					$symbol = "";
					if (empty($preErrorSymbol)) { // normal execution/no error
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
					$yyval->S = $vstack[$vstackCount - $len];// default to $S = $1
					// default location, uses first token for firsts, last for lasts
					$yyval->_S = array(
                        "first_line"=> 		$lstack[$lstackCount - (isset($len) ? $len : 1)]['first_line'],
                        "last_line"=> 		$lstack[$lstackCount - 1]['last_line'],
                        "first_column"=> 	$lstack[$lstackCount - (isset($len) ? $len : 1)]['first_column'],
                        "last_column"=> 	$lstack[$lstackCount - 1]['last_column']
                    );
					
					$r = $this->parser_performAction($yyval->S, $this->yytext, $this->yyleng, $this->yylineno, $action[1], $vstack, $lstack, $vstackCount - 1);
					
					if (empty($r) == false) {
						return $r;
					}
					
					// pop off stack		
					if ($len > 0) {
						$stack = array_slice($stack, 0, -1 * $len * 2);
						$stackCount -= $len * 2;
					
						$vstack = array_slice($vstack, 0, -1 * $len);
						$vstackCount -= $len;
						
						$lstack = array_slice($lstack, 0, -1 * $len);
						$lstackCount -= $len;
					}
					
					$stack[] = $this->productions_[$action[1]][0]; // push nonterminal (reduce)
					$stackCount++;
					
					$vstack[] = $yyval->S;
					$vstackCount++;
					
					$lstack[] = $yyval->_S;
					$lstackCount++;
					
					// goto new state = table[STATE][NONTERMINAL]
					$newState = $this->table[$stack[$stackCount - 2]][$stack[$stackCount - 1]];
					
					$stack[] = $newState;
					$stackCount++;
					
					break;
		
				case 3:
					// accept
					return true;
			}

		}

		return true;
	}


	/* Jison generated lexer */
	var $EOF = 1;
	var $S = "";
	var $yy = "";
	var $yylineno = "";
	var $yyleng = "";
	var $yytext = "";
	var $match = "";
	var $matched = "";
	var $matches = "";
	var $yyloc = array();
	var $conditionsStack = array();
	var $conditionStackCount = 0;
	var $rules = array();
	var $conditions = array();
	var $done = false;
	var $less;
	var $more;
	var $_input;
	
	function setInput($input)
	{
		$this->_input = $input;
		$this->more = $this->less = $this->done = false;
		$this->yylineno = $this->yyleng = 0;
		$this->yytext = $this->matched = $this->match = '';
		$this->conditionStack = array('INITIAL');
		$this->yyloc = array(
			"first_line"=> 1,
			"first_column"=> 0,
			"last_line"=> 1,
			"last_column"=> 0
		);
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
		$this->more = true;
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
		if ($this->done == true) return $this->EOF;
		
		if (empty($this->_input)) $this->done = true;

		if ($this->more == false) {
			$this->yytext = '';
			$this->match = '';
		}
		
		$rules = $this->_currentRules();
		for ($i = 0, $j = count($rules); $i < $j; $i++) {
			preg_match($this->rules[$rules[$i]], $this->_input, $match);
			if ( isset($match[0]) ) {
				$matchCount = strlen($match[0]);
				$lineCount = preg_match("/\n.*/", $match[0], $lines);
				
				if ($lineCount > 1) $this->yylineno += $lineCount;
				$this->yyloc = array(
					"first_line"=> $this->yyloc['last_line'],
					"last_line"=> $this->yylineno + 1,
					"first_column"=> $this->yyloc['last_column'],
					"last_column"=> $lines ? count($lines[$lineCount - 1]) - 1 : $this->yyloc['last_column'] + $matchCount
				);
				$this->yytext .= $match[0];
				$this->match .= $match[0];
				$this->matches = $match[0];
				$this->yyleng = strlen($this->yytext);
				$this->more = false;
				$this->_input = substr($this->_input, $matchCount, strlen($this->_input));
				$this->matched .= $match[0];
				$token = $this->lexer_performAction($this->yy, $this, $rules[$i], $this->conditionStack[$this->conditionStackCount]);
				
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
	
	function lexer_lex()
	{
		$r = $this->next();
		
		while (empty($r) && $this->done == false) {
			$r = $this->next();
		}
		
		return $r;
	}
	
	function begin($condition)
	{
		$this->conditionStackCount++;
		$this->conditionStack[] = $condition;
	}
	
	function popState()
	{
		$this->conditionStackCount--;
		return array_pop($this->conditionStack);
	}
	
	function _currentRules()
	{
		return $this->conditions[
			$this->conditionStack[
				$this->conditionStackCount
			]
		]['rules'];
	}
	
	function lexer_performAction(&$yy, $yy_, $avoiding_name_collisions, $YY_START = null)
	{
		$YYSTATE = $YY_START;
		"<@@LEXER_PERFORM_ACTION@@>";
	}
}
