﻿using System;
using System.Collections;
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
    class ParserAction
    {
        public int Action = 0;
        public int State = 0;

        public ParserAction(int action)
        {
            Action = action;
        }

        public ParserAction(int action, int state)
        {
            Action = action;
            State = state;
        }
    }

    class ParserSymbol
    {
        public string Name;
        public int Index;
        public IDictionary<int, ParserSymbol> Symbols = new Dictionary<int, ParserSymbol>();
        public IDictionary<string, ParserSymbol> SymbolsByName = new Dictionary<string, ParserSymbol>();

        public ParserSymbol(string name, int index)
        {
            Name = name;
            Index = index;
        }

        public void AddAction(ParserSymbol p)
        {
            Symbols.Add(p.Index, p);
            SymbolsByName.Add(p.Name, p);
        }
    }

    class Parser
    {
        public IDictionary<int, ParserSymbol> ParserActions = new Dictionary<int, ParserSymbol>();
        public IDictionary<int, int> Symbols;
		public IDictionary<int, string> Terminals;
        public IDictionary<int, ParserProduction> Productions = new Dictionary<int, ParserProduction>();
        public IList<IDictionary<int,ParserAction>> Table = new List<IDictionary<int, ParserAction>>();
        public IDictionary<int, ParserSymbol> DefaultActions;
		public string Version = "0.3.12";
		public bool Debug = false;
		
		public Parser()
		{
            //@@INJECT@@

            var accept = new ParserSymbol("accept", 0);
            var end = new ParserSymbol("end", 1);
            var error = new ParserSymbol("error", 2);
            var wiki = new ParserSymbol("wiki", 3);
            var contents = new ParserSymbol("contents", 4);
            var EOF = new ParserSymbol("EOF", 5);
            var content = new ParserSymbol("content", 6);
            var CONTENT = new ParserSymbol("CONTENT", 7);
            var LINE_END = new ParserSymbol("LINE_END", 8);
            var HTML_TAG_INLINE = new ParserSymbol("HTML_TAG_INLINE", 9);
            var HTML_TAG_OPEN = new ParserSymbol("HTML_TAG_OPEN", 10);
            var HTML_TAG_CLOSE = new ParserSymbol("HTML_TAG_CLOSE", 11);

            ParserActions = new Dictionary<int, ParserSymbol>() {
                {error.Index, error},
                {wiki.Index, wiki},
                {contents.Index, contents},
                {EOF.Index, EOF},
                {content.Index, content},
                {CONTENT.Index, CONTENT},
                {LINE_END.Index, LINE_END},
                {HTML_TAG_INLINE.Index, HTML_TAG_INLINE},
                {HTML_TAG_OPEN.Index, HTML_TAG_OPEN},
                {HTML_TAG_CLOSE.Index, HTML_TAG_CLOSE}
            };

            Rules = new Dictionary<int, Regex>() {
                {0, new Regex("^(?:(<(.|\n)[^>]*?\\/>))")},
                {1, new Regex("^(?:$)")},
                {2, new Regex("^(?:(<\\/(.|\n)[^>]*?>))")},
                {3, new Regex("^(?:(<(.|\n)[^>]*?>))")},
                {4, new Regex("^(?:(<\\/(.|\n)[^>]*?>))")},
                {5, new Regex("^(?:([A-Za-z0-9 .,?;]+))")},
                {6, new Regex("^(?:([ ]))")},
                {7, new Regex("^(?:((\n\r|\r\n|[\n\r])))")},
                {8, new Regex("^(?:(.))")},
                {9, new Regex("^(?:$)")}
            };

            Conditions.Add("htmlElement", new ParserConditions(new List<int> { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 }, true));
            Conditions.Add("INITIAL", new ParserConditions(new List<int> {0, 1, 2, 3, 4, 5, 6, 7, 8, 9}, true));

            Table.Add(new Dictionary<int, ParserAction>() {
                {3, new ParserAction(1)},
                {4, new ParserAction(2)},
                {5, new ParserAction(1, 3)},
                {6, new ParserAction(4)},
                {7, new ParserAction(1, 5)},
                {8, new ParserAction(1, 6)},
                {9, new ParserAction(1, 7)},
                {10, new ParserAction(1, 8)}
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {3, new ParserAction(3)}
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 1)},
                {5, new ParserAction(1, 9)},
                {6, new ParserAction(10)},
                {7, new ParserAction(1, 5)},
                {8, new ParserAction(1, 6)},
                {9, new ParserAction(1, 7)},
                {10, new ParserAction(1, 8)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 3)}
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 4)},
                {5, new ParserAction(2, 4)},
                {7, new ParserAction(2, 4)},
                {8, new ParserAction(2, 4)},
                {9, new ParserAction(2, 4)},
                {10, new ParserAction(2, 4)},
                {11, new ParserAction(2, 4)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 6)},
                {5, new ParserAction(2, 6)},
                {7, new ParserAction(2, 6)},
                {8, new ParserAction(2, 6)},
                {9, new ParserAction(2, 6)},
                {10, new ParserAction(2, 6)},
                {11, new ParserAction(2, 6)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 7)},
                {5, new ParserAction(2, 7)},
                {7, new ParserAction(2, 7)},
                {8, new ParserAction(2, 7)},
                {9, new ParserAction(2, 7)},
                {10, new ParserAction(2, 7)},
                {11, new ParserAction(2, 7)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 8)},
                {5, new ParserAction(2, 8)},
                {7, new ParserAction(2, 8)},
                {8, new ParserAction(2, 8)},
                {9, new ParserAction(2, 8)},
                {10, new ParserAction(2, 8)},
                {11, new ParserAction(2, 8)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {4, new ParserAction(11)},
                {6, new ParserAction(4)},
                {7, new ParserAction(1, 5)},
                {8, new ParserAction(1, 6)},
                {9, new ParserAction(1, 7)},
                {10, new ParserAction(1, 8)},
                {11, new ParserAction(1, 12)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 2)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 5)},
                {5, new ParserAction(2, 5)},
                {7, new ParserAction(2, 5)},
                {8, new ParserAction(2, 5)},
                {9, new ParserAction(2, 5)},
                {10, new ParserAction(2, 5)},
                {11, new ParserAction(2, 5)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {6, new ParserAction(10)},
                {7, new ParserAction(1, 5)},
                {8, new ParserAction(1, 6)},
                {9, new ParserAction(1, 7)},
                {10, new ParserAction(1, 9)},
                {11, new ParserAction(1, 13)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 10)},
                {5, new ParserAction(2, 10)},
                {7, new ParserAction(2, 10)},
                {8, new ParserAction(2, 10)},
                {9, new ParserAction(2, 10)},
                {10, new ParserAction(2, 10)},
                {11, new ParserAction(2, 10)},
            });

            Table.Add(new Dictionary<int, ParserAction>() {
                {1, new ParserAction(2, 9)},
                {5, new ParserAction(2, 9)},
                {7, new ParserAction(2, 9)},
                {8, new ParserAction(2, 9)},
                {9, new ParserAction(2, 9)},
                {10, new ParserAction(2, 9)},
                {11, new ParserAction(2, 9)},
            });


            /*{
             * 3:1,
             * 4:2,
             * 5:[1,3],6:4,7:[1,5],8:[1,6],9:[1,7],10:[1,8]},{1:[3]},{1:[2,1],5:[1,9],6:10,7:[1,5],8:[1,6],9:[1,7],10:[1,8]},{1:[2,3]},{1:[2,4],5:[2,4],7:[2,4],8:[2,4],9:[2,4],10:[2,4],11:[2,4]},{1:[2,6],5:[2,6],7:[2,6],8:[2,6],9:[2,6],10:[2,6],11:[2,6]},{1:[2,7],5:[2,7],7:[2,7],8:[2,7],9:[2,7],10:[2,7],11:[2,7]},{1:[2,8],5:[2,8],7:[2,8],8:[2,8],9:[2,8],10:[2,8],11:[2,8]},{4:11,6:4,7:[1,5],8:[1,6],9:[1,7],10:[1,8],11:[1,12]},{1:[2,2]},{1:[2,5],5:[2,5],7:[2,5],8:[2,5],9:[2,5],10:[2,5],11:[2,5]},{6:10,7:[1,5],8:[1,6],9:[1,7],10:[1,8],11:[1,13]},{1:[2,10],5:[2,10],7:[2,10],8:[2,10],9:[2,10],10:[2,10],11:[2,10]},{1:[2,9],5:[2,9],7:[2,9],8:[2,9],9:[2,9],10:[2,9],11:[2,9]}*/
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
            return null;
		}
		
		public int ParserLex()
		{
			var token = LexerLex();//end = 1
			token = (token != 0 ? token : 1);
			
			// if token isn't its numeric value, convert
			if ( token > -1 && ParserActions.ContainsKey(token)) {
                return ParserActions[token].Index;
			}
			
			return token;
		}
		
		public void ParseError(string error, Dictionary<string, dynamic> hash = null)
		{
			throw new System.InvalidOperationException(error);
		}

        public ParserValue Parse(string input)
		{
            var stack = new Stack<ParserSymbol>();
            Stack<ParserYY> vstack = new Stack<ParserYY>();
            ParserYY yy = new ParserYY();
            ParserYY _yy = new ParserYY();
            ParserValue v = new ParserValue();
			int shifts = 0;
			int reductions = 0;
			int recovering = 0;
			int TERROR = 2;
			int symbol = -1;
            ParserSymbol action = null;
			string errStr = "";
			int preErrorSymbol = -1;
            ParserSymbol defaultActions;

            SetInput(input);

			while (true)
			{
				// retreive state number from top of stack
                ParserSymbol state = (stack.Count > 0 ? stack.Last() : null);
                
				// use default actions if available
				if (state != null) {
					action = DefaultActions[state.Index];
				} else {
					if (symbol < 0) {
						symbol = ParserLex();
					}
					// read action for current state and first input
					if (state != null && state.Symbols.ContainsKey(symbol)) {
                        action = state.Symbols[symbol];
					} else {
						action = null;
					}
				}
				
				if (action == null) {
					if (recovering > 0) {
						// Report error
						string[] expected = new string[]{};
						foreach(var item in state.Symbols) {
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
						if (state != null && state.Symbols.ContainsKey(TERROR)) {
							goto End;
						}
						if (state == null) {
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
					if (state != null && state.Symbols.ContainsKey(TERROR)) {
                        action = state.Symbols[TERROR];
					}
					recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
				}
				End:;
				
				/*if (type.IsArray()) {
					this.parseError("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
				}*/
				
				switch (action.Index) {
				    case 1:
					    // shift
					    stack.Push(ParserActions[symbol]);
					    vstack.Push(_YY);
					
					    stack.Push(action.Symbols[1]); // push state

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
                        int len = Productions[action.Symbols[1].Index].Len;
					    // perform semantic action
                        _yy = new ParserYY();
                        _yy.S = vstack.ElementAt(vstack.Count - len).S;
                        //yyval; yytext; yyleng; yylineno; action.State[0]; vstack; lstack; vstack.Count - 1;

                        ParserValue value = ParserPerformAction(_yy, yy, action.Symbols[0].Index, vstack, vstack.Count - 1);
					
					    if (value.ValueSet) {
						    return value;
					    }
					
					    // pop off stack
					    if (len > 0) {
                            stack.Pop();
                            stack.Pop();
						    vstack.Pop();
					    }
					
					    stack.Push(ParserActions[Productions[action.Symbols[1].Index].Nonterminal]); // push nonterminal (reduce)
					    vstack.Push(yy);
					
					    // goto new state = table[STATE][NONTERMINAL]
					    dynamic newState = ParserActions[stack.ElementAt(stack.Count - 2).Index].Symbols[stack.ElementAt(stack.Count - 1).Index];
					
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
        public Stack<string> ConditionStack;
        public IDictionary<int, Regex> Rules = new Dictionary<int, Regex>();
		public IDictionary<string, ParserConditions> Conditions = new Dictionary<string, ParserConditions>();
		public bool Done = false;
		public bool Less;
		public bool _More;
		public string _Input;
		public dynamic Offset;
        public int[,] Ranges = new int[,]{};
        public bool Flex = true;
		
		public void SetInput(string input)
		{
			_Input = input;
			_More = Less = Done = false;
			_YY.LineNo = _YY.Leng = 0;
			Matched = Match = "";
            _YY.Val = new ParserYYVal("", 1, 0, 1, 0);
            ConditionStack = new Stack<string>();
			ConditionStack.Push("INITIAL");
            _YY.Loc = new ParserLocation(1, 0, 1, 0);
            if (Ranges.Length > 0)
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

			if (Ranges.Length > 0) _YY.Loc.Range.Values[1]++;
			
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
			
			if (Ranges.Length > 0) {
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
            for (var i = 0; i < pre.Length; i++)
            {
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
            Regex rule;
			for (int i = 0; i < rules.Count; i++) {
                rule = Rules[rules[i]];
				var tempMatch = rule.Match(_Input);
	            if (tempMatch.Success == true && (match != null || tempMatch.Length > match.Length)) {
                    match = tempMatch.Value;
	                index = i;
	                if (!Flex) {
						break;
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
				if (Ranges.Length > 0) {
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
		
		public int LexerLex()
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
		
		public List<int> CurrentRules()
		{
            var peek = ConditionStack.Peek();
            return Conditions[peek].Rules;
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

    /*class ParserAction
    {
        public int Action;
        public IDictionary<int, ParserAction> Actions = new Dictionary<int, ParserAction>();

        public ParserAction(int action)
        {
            Action = action;
        }

        public ParserAction(int action1, int action2)
        {
            Actions.Add(0, new ParserAction(action1));
            Actions.Add(1, new ParserAction(action2));
        }
    }*/

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
            Value = new ParserValue(value);
        }

        public void SetValue(decimal value)
        {
            Value = new ParserValue(value);
        }

        public void SetValue(string value)
        {
            Value = new ParserValue(value);
        }

        public void SetValue(Stack<bool> value)
        {
            Value = new ParserValue(value);
        }

        public void SetValue(Stack<decimal> value)
        {
            Value = new ParserValue(value);
        }

        public void SetValue(Stack<string> value)
        {
            Value = new ParserValue(value);
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

        public ParserValue()
        {
            
        }

        public ParserValue(bool value)
        {
            ValueSet = true;
            BoolValue = value;
        }

        public ParserValue(decimal value)
        {
            ValueSet = true;
            DecimalValue = value;
        }

        public ParserValue(string value)
        {
            ValueSet = true;
            StringValue = value;
        }

        public ParserValue(Stack<bool> value)
        {
            ValueSet = true;
            StackBoolValue = value;
        }

        public ParserValue(Stack<decimal> value)
        {
            ValueSet = true;
            StackDecimalValue = value;
        }

        public ParserValue(Stack<string> value)
        {
            ValueSet = true;
            StackStringValue = value;
        }

        public void AppendChildren(ParserValue value)
        {
            Children.Push(value);
        }
    }

    class ParserConditions
    {
        public List<int> Rules;
        public bool Inclusive;
        public ParserConditions(List<int> rules, bool inclusive)
        {
            Rules = rules;
            Inclusive = inclusive;
        }
    }

    class ParserProduction
    {
        public int Len;
        public int Nonterminal;

        public ParserProduction(int len, int nonterminal)
        {
            Len = len;
            Nonterminal = nonterminal;
        }
    }
}