using System;
using System.Dynamic;
using System.Runtime;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json.Converters;


namespace Jison
{
    class Parser
    {
        public JObject Symbols;
		public JObject Terminals;
		public JArray Productions;
        public List<List<ParserAction>> Table;
		public JObject DefaultActions;
		public string Version = "0.3.12";
		public bool Debug = false;
		
		public Parser()
		{
			//parser
			Symbols = JObject.Parse("{\"error\":2,\"html\":3,\"contents\":4,\"EOF\":5,\"content\":6,\"TAG\":7,\"WORD\":8,\"CHAR\":9,\"$accept\":0,\"$end\":1}");
            Terminals = JObject.Parse("{2:\"error\",5:\"EOF\",7:\"TAG\",8:\"WORD\",9:\"CHAR\"}");
            Productions = JArray.Parse("[0,[3,2],[4,1],[4,2],[6,1],[6,1],[6,1]]");
            var table = JArray.Parse("[{3:1,4:2,6:3,7:[1,4],8:[1,5],9:[1,6]},{1:[3]},{5:[1,7],6:8,7:[1,4],8:[1,5],9:[1,6]},{5:[2,2],7:[2,2],8:[2,2],9:[2,2]},{5:[2,4],7:[2,4],8:[2,4],9:[2,4]},{5:[2,5],7:[2,5],8:[2,5],9:[2,5]},{5:[2,6],7:[2,6],8:[2,6],9:[2,6]},{1:[2,1]},{5:[2,3],7:[2,3],8:[2,3],9:[2,3]}]");
            var stateI = 0;
            foreach (JObject state in table.Children()) {
                Table[stateI] = new List<ParserAction>();
                foreach (JToken symbol in state.Children()) {
                    Table[stateI][((int)((JProperty)symbol).Name)];
                    var o = 0;
                }
                stateI++;
            }
            DefaultActions = JObject.Parse("{7:[2,1]}");
			
			//lexer
			//"<@@RULES@@>";
            var rules = JArray.Parse(@"['^(?:<(.|\\n)*?>+)','^(?:(\\w|\\d)+)','^(?:(.|\\n|\\s))','^(?:$)']");
            foreach(JValue rule in rules)
            {
                Rules.Add(rule.Value<string>());
            }
            
			Conditions = JObject.Parse("{\"INITIAL\":{\"rules\":[0,1,2,3],\"inclusive\":true}}");
			Options = JObject.Parse("{}");
		}
		
		public static void Main() {
			var parser = new Parser();
            var o = parser.Parse("Test");
		}
		
		public void Trace()
		{
			
		}

        public ParserValue ParserPerformAction(ParserYY THIS, ParserYY yy, int _yy, Stack<ParserYY> yystate, int _S)
		{
            ParserValue value = new ParserValue();
            return value;
		}
		
		public int ParserLex()
		{
			var token = LexerLex();//end = 1
			token = token ?? 1;
			
			// if token isn't its numeric value, convert
			if ( token > -1 && Symbols[token]) {
				return Symbols[token];
			}
			
			return token;
		}
		
		public void ParseError(string error, Dictionary<string, dynamic> hash = null)
		{
			throw new System.InvalidOperationException(error);
		}

        public ParserValue Parse(string input)
		{
            Stack<int> stack = new Stack<int>();
            Stack<ParserYY> vstack = new Stack<ParserYY>();
            ParserYY yy = new ParserYY();
            ParserYY _yy = new ParserYY();
            ParserValue v = new ParserValue();
			int shifts = 0;
			int reductions = 0;
			int recovering = 0;
			int TERROR = 2;
			
			SetInput(input);

			int symbol = -1;
			ParserAction action = null;
			string errStr = "";
			int preErrorSymbol = -1;
            JToken defaultActions;

			while (true)
			{
				// retreive state number from top of stack
				int state = (stack.Count > 0 ? stack.Last() : -1);
                
				// use default actions if available
				if (state > -1) {
					defaultActions = DefaultActions[state];
				} else {
					if (symbol < 0) {
						symbol = ParserLex();
					}
					// read action for current state and first input
					if (symbol > 0 && symbol > 0) {
						action = Table[state][symbol];
					} else {
						action = null;
					}
				}
				
				if (action == null) {
					if (recovering > 0) {
						// Report error
						string[] expected = new string[]{};
						foreach(var item in Table[state]) {
							//TODO: populate expected here
						}
						
						errStr = "Parse error on line " + (_YY.LineNo + 1).ToString() + ":" + '\n' +
							ShowPosition() + '\n' + 
							"Expecting " + String.Join(", ", expected) +
							", got '" +
							(symbol > 0 ? Terminals[symbol].ToString() : "NOTHING") + "'";
						
						ParseError(errStr, new Dictionary<string, dynamic>() {
							{"text", Match},
							{"token", symbol},
							{"line", _YY.LineNo},
							{"loc", yy.Loc},
							{"expected", expected}
						});

					}
					
					// just recovered from another error
					if (recovering == 3) {
						if (symbol == EOF) {
							ParseError(String.IsNullOrEmpty(errStr) ? errStr : "Parsing halted.");
						}
	
						// discard current lookahead and grab another
						yy = _YY;
						symbol = ParserLex();
					}
					
					// try to recover from error
					while (true) {
						// check for error recovery rule in this state
						if (Table[state] != null && Table[state][TERROR] == null) {
							goto End;
						}
						if (state == 0) {
							ParseError(errStr ?? "Parsing halted.");
						}
						
						stack.Pop();
                        stack.Pop();
						vstack.Pop();
                        state = stack.Last();
					}
					
					preErrorSymbol = symbol; // save the lookahead token
					symbol = TERROR; // insert generic error symbol as new lookahead
					state = stack.Last();
					if (Table[state] != null && Table[state][TERROR] != null) {
						action = Table[state][TERROR];
					}
					recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
				}
				End:;
				
				/*if (type.IsArray()) {
					this.parseError("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
				}*/
				
				switch (action.Operation) {
				    case 1:
					    // shift
					    stack.Push(symbol);
					    vstack.Push(_YY);
					
					    stack.Push(action.State[0]); // push state

					    symbol = -1;
					    if (preErrorSymbol > -1) { // normal execution/no error
                            yy = _YY;
						    if (recovering > 0) recovering--;
					    } else { // error just occurred, resume old lookahead f/ before error
						    symbol = preErrorSymbol;
						    preErrorSymbol = -1;
					    }
					    break;
		
				    case 2:
					    // reduce
                        int len = Productions[action.State[0]].Children().ElementAt(1).Value<int>();
					    // perform semantic action
                        _yy = new ParserYY();
                        _yy.S = vstack.ElementAt(vstack.Count - len).S;
                        //yyval; yytext; yyleng; yylineno; action.State[0]; vstack; lstack; vstack.Count - 1;
					
					    ParserValue value = ParserPerformAction(_yy, yy, action.State[0], vstack, vstack.Count - 1);
					
					    if (value.ValueSet) {
						    return value;
					    }
					
					    // pop off stack
					    if (len > 0) {
                            stack.Pop();
                            stack.Pop();
						    vstack.Pop();
					    }
					
					    stack.Push(Productions[action.State[0]].Children().ElementAt(0).Value<int>()); // push nonterminal (reduce)
					    vstack.Push(yy);
					
					    // goto new state = table[STATE][NONTERMINAL]
					    dynamic newState = Table[stack.ElementAt(stack.Count - 2)][stack.ElementAt(stack.Count - 1)];
					
					    stack.Push(newState);
					
					    break;
		
				    case 3:
					    // accept
					    return v;
			        }
			}
			
			return v;
		}
		
		/* Jison generated lexer */
		public int EOF = 1;
		public string S = "";
        public ParserYY _YY = new ParserYY();
		public string YY = "";
		public int YYLineNo = 0;
		public int YYLeng = 0;
		public ParserYYVal YYVal;
		public string Match = "";
		public string Matched = "";
        public ParserLocation YYLoc;
        public Stack<dynamic> ConditionStack = new Stack<dynamic>() { };
        public List<string> Rules = new List<string>();
		public JObject Conditions;
		public bool Done = false;
		public bool Less;
		public bool _More;
		public string _Input;
		public JObject Options;
		public dynamic Offset;
		
		
		public void SetInput(string input)
		{
			_Input = input;
			_More = Less = Done = false;
			_YY.LineNo = _YY.Leng = 0;
			Matched = Match = "";
            _YY.Val = new ParserYYVal("", 1, 0, 1, 0);
			ConditionStack = new Stack<dynamic>();
			ConditionStack.Push("INITIAL");
            _YY.Loc = new ParserLocation(1, 0, 1, 0);
            if (Options["range"] != null)
            {
                //TODO: not yet implemented
                _YY.Loc = new ParserLocation(1, 0, 1, 0);
            }
            else {
                _YY.Loc = new ParserLocation(1, 0, 1, 0);
            }
			Offset = 0;
		}
		
		public string Input()
		{
            string ch = _Input[0].ToString();
			_YY.Text += ch;
			_YY.Leng++;
			Offset++;
			Match += ch;
			Matched += ch;
			Match lines = Regex.Match(ch, "/(?:\r\n?|\n).*/");
			if (lines.Success) {
				_YY.LineNo++;
				_YY.Loc.LastLine++;
			} else {
                _YY.Loc.LastLine++;
			}
			if (Options["ranges"] != null) _YY.Loc.Range.Values[1]++;
			
			_Input = _Input.Substring(1);
			return ch;
		}
		
		public void Unput(string ch)
		{
			int len = ch.Length;
			var lines = Regex.Split(ch, "/(?:\r\n?|\n)/");
			
			_Input = ch + _Input;
			_YY.Text = _YY.Text.Substring(0, len - 1);
			//$this->yylen -= $len;
			Offset -= len;
			var oldLines = Regex.Split(Match, "/(?:\r\n?|\n)/");
			Match = Match.Substring(0, Match.Length - 1);
			Matched = Matched.Substring(0, Matched.Length - 1);
			
			if ((lines.Length - 1) > 0) _YY.LineNo -= lines.Length - 1;
			var r = YYLoc.Range;

            _YY.Loc.FirstLine = _YY.Loc.FirstLine;
            _YY.Loc.LastLine = _YY.LineNo + 1;
            _YY.Loc.FirstColumn = _YY.Loc.FirstColumn;
            _YY.Loc.LastColumn = (lines.Length > 0 ?
                    (lines.Length == oldLines.Length ?
                        _YY.Loc.FirstColumn : 0) +
                        oldLines[oldLines.Length - lines.Length].Length - lines[0].Length
                : _YY.Loc.FirstColumn - len);
			
			if (Options["ranges"] != null) {
				_YY.Loc.Range = new ParserRange(r.Values[0], r.Values[0] + _YY.Leng - len);
			}
		}
		
		public dynamic More()
		{
			_More = true;
			return this;
		}
		
		public string PastInput()
		{
			var past = Matched.Substring(0, Matched.Length - Match.Length);
			return (past.Length > 20 ? "..." : "") + Regex.Replace(past.Substring(-20), "/\n/", "");
		}
		
		public string UpcomingInput()
		{
			var next = Match;
			if (next.Length < 20) {
				next += _Input.Substring(0, 20 - next.Length);
			}
			return Regex.Replace(next.Substring(0, 20) + (next.Length > 20 ? "..." : ""), "/\n/", "");
		}
		
		public string ShowPosition()
		{
			var pre = PastInput();
	
			var c = "";
			for(var i = 0; i < pre.Length; i++) {
				c += "-";
			}
	
			return pre + UpcomingInput() + '\n' + c + "^";
		}
		
		public int Next()
		{
			if (Done == true) return EOF;
			
			if (String.IsNullOrEmpty(_Input)) Done = true;
	
			if (_More == false) {
				_YY.Text = "";
				Match = "";
			}
	
			var rules = CurrentRules();
			string match = "";
			int index = 0;
            string rule;
			for (int i = 0; i < rules.Count; i++) {
                rule = Rules[rules[i].Value<int>()];
				var tempMatch = Regex.Match(_Input, rule);
	            if (tempMatch.Success == true && (match != null || tempMatch.Length > match.Length)) {
                    match = tempMatch.Value;
	                index = i;
	                if (Options["flex"] != null) {
						if (Options["flex"].Value<bool>() == false) break;
					}
	            }
			}
			if ( !String.IsNullOrEmpty(match) ) {
				Match lineCount = Regex.Match(match, "/\n.*/");
	
				_YY.LineNo += lineCount.Length;
				_YY.Loc.FirstLine = _YY.Loc.LastLine;
                _YY.Loc.LastLine = _YY.LineNo + 1;
                _YY.Loc.FirstColumn = _YY.Loc.LastColumn;
                _YY.Loc.LastColumn = lineCount.Length > 0 ? lineCount.Length - 1 : _YY.Loc.LastColumn + match.Length;
				
				_YY.Text += match[0];
				Match += match[0];
				//this.matches = match;
				_YY.Leng = _YY.Text.Length;
				if (Options["ranges"] != null) {
					//TODO: YYLoc.Range = new int[] {Offset, Offset += YYLeng};
				}
				_More = false;
				_Input = _Input.Substring(match.Length);
				Matched += match[0];
				var token = LexerPerformAction(YY, this, rules[index], ConditionStack.Peek());
	
				if (Done == true && String.IsNullOrEmpty(_Input) == false) Done = false;
	
				if (String.IsNullOrEmpty(token) == false) {
					return token;
				} else {
					return -1;
				}
			}
			
			if (String.IsNullOrEmpty(_Input)) {
				return EOF;
			} else {
                ParseError("Lexical error on line " + (_YY.LineNo + 1) + ". Unrecognized text.\n" + ShowPosition(), new Dictionary<string, dynamic>() {
					{"text", ""},
					{"token", null},
					{"line", _YY.LineNo}
				});
				return -1;
			}
		}
		
		public dynamic LexerLex()
		{
			var r = Next();
			
			while (r > -1 && Done == false) {
				r = Next();
			}
			
			return r;
		}
	
		public void Begin(dynamic condition)
		{
			ConditionStack.Push(condition);
		}
		
		public dynamic PopState()
		{
			return ConditionStack.Pop();
		}
		
		public JArray CurrentRules()
		{
            var peek = ConditionStack.Peek();
            return Conditions[peek]["rules"];
		}
		
		public dynamic LexerPerformAction(dynamic yy, dynamic yy_, dynamic avoiding_name_collisions, dynamic YY_START = null)
		{
			//dynamic YYSTATE = YY_START;
			//"<@@LEXER_PERFORM_ACTION@@>";
			return null;
		}
		
		static dynamic[] Slice(dynamic[] source, int start, int end = 0)
		{
		    dynamic[] dest = new dynamic[(source.Length - start) + end];
		    Array.Copy(source, 0, dest, 0, (source.Length - start) + end);
		    return dest;
		}
	}

    class ParserRange
    {
        public List<int> Values;

        public ParserRange(int start, int end)
        {
            Values = new List<int>() { start, end };
        }
    }

    class ParserLocation
    {
        public int FirstLine;
        public int LastLine;
        public int FirstColumn;
        public int LastColumn;
        public ParserRange Range;

        public ParserLocation(int firstLine, int lastLine, int firstColumn, int lastColumn)
        {
            FirstLine = firstLine;
            LastLine = lastLine;
            FirstColumn = firstColumn;
            LastColumn = lastColumn;
        }

        public ParserLocation(int firstLine, int lastLine, int firstColumn, int lastColumn, ParserRange range)
        {
            FirstLine = firstLine;
            LastLine = lastLine;
            FirstColumn = firstColumn;
            LastColumn = lastColumn;
            Range = range;
        }
    }

    class ParserAction
    {
        public int Operation;
        public Dictionary<int, int> State;
    }

    class ParserYY
    {
        public string Text = "";
        public string S = "";
        public ParserLocation _S;
        public int Leng = 0;
        public ParserLocation Loc;
        public int LineNo = 0;
        public ParserYYVal Val;
    }

    class ParserYYVal
    {
        public string S;
        public ParserLocation _S;
        public ParserValue Value;

        public ParserYYVal(string s, int firstLine, int lastLine, int firstColumn, int lastColumn)
        {
            S = s;
            _S = new ParserLocation(firstLine, lastLine, firstColumn, lastColumn);
        }

        public void SetValue(bool value)
        {
            Value.SetValue(value);
        }

        public void SetValue(decimal value)
        {
            Value.SetValue(value);
        }

        public void SetValue(string value)
        {
            Value.SetValue(value);
        }

        public void SetValue(Stack<bool> value)
        {
            Value.SetValue(value);
        }

        public void SetValue(Stack<decimal> value)
        {
            Value.SetValue(value);
        }

        public void SetValue(Stack<string> value)
        {
            Value.SetValue(value);
        }
    }

    class ParserValue
    {
        public bool ValueSet = false;
        public bool BoolValue = false;
        public decimal DecimalValue;
        public string StringValue;
        public Stack<bool> StackBoolValue;
        public Stack<decimal> StackDecimalValue;
        public Stack<string> StackStringValue;
        public Stack<ParserValue> Children = new Stack<ParserValue>();

        public void SetValue(bool value)
        {
            ValueSet = true;
            BoolValue = value;
        }

        public void SetValue(decimal value)
        {
            ValueSet = true;
            DecimalValue = value;
        }

        public void SetValue(string value)
        {
            ValueSet = true;
            StringValue = value;
        }

        public void SetValue(Stack<bool> value)
        {
            ValueSet = true;
            StackBoolValue = value;
        }

        public void SetValue(Stack<decimal> value)
        {
            ValueSet = true;
            StackDecimalValue = value;
        }

        public void SetValue(Stack<string> value)
        {
            ValueSet = true;
            StackStringValue = value;
        }

        public void AppendChildren(ParserValue value)
        {
            Children.Push(value);
        }
    }
}
