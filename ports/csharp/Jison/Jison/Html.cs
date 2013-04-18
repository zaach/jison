using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;


namespace Jison
{
    class Parser
    {
        public ParserSymbols Symbols;
        public Dictionary<int, ParserSymbol> Terminals;
        public Dictionary<int, ParserProduction> Productions;
        public Dictionary<int, ParserState> Table;
        public Dictionary<int, ParserAction> DefaultActions;
		public string Version = "0.4.2";
		public bool Debug = false;
        
        private const int None = 0;
        private const int Shift = 1;
        private const int Reduce = 2;
        private const int Accept = 3;

        public Parser()
        {
            //Setup Parser
            
			var symbol0 = new ParserSymbol("accept", 0);
			var symbol1 = new ParserSymbol("end", 1);
			var symbol2 = new ParserSymbol("error", 2);
			var symbol3 = new ParserSymbol("wiki", 3);
			var symbol4 = new ParserSymbol("contents", 4);
			var symbol5 = new ParserSymbol("eof", 5);
			var symbol6 = new ParserSymbol("content", 6);
			var symbol7 = new ParserSymbol("string", 7);
			var symbol8 = new ParserSymbol("lineEnd", 8);
			var symbol9 = new ParserSymbol("tag", 9);
			var symbol10 = new ParserSymbol("tagOpen", 10);
			var symbol11 = new ParserSymbol("tagClose", 11);


			Symbols = new ParserSymbols();
			Symbols.Add(symbol0);
			Symbols.Add(symbol1);
			Symbols.Add(symbol2);
			Symbols.Add(symbol3);
			Symbols.Add(symbol4);
			Symbols.Add(symbol5);
			Symbols.Add(symbol6);
			Symbols.Add(symbol7);
			Symbols.Add(symbol8);
			Symbols.Add(symbol9);
			Symbols.Add(symbol10);
			Symbols.Add(symbol11);

			Terminals = new Dictionary<int, ParserSymbol>
				{
					{2, symbol2},
					{5, symbol5},
					{7, symbol7},
					{8, symbol8},
					{9, symbol9},
					{10, symbol10},
					{11, symbol11}
				};

			var table0 = new ParserState(0);
			var table1 = new ParserState(1);
			var table2 = new ParserState(2);
			var table3 = new ParserState(3);
			var table4 = new ParserState(4);
			var table5 = new ParserState(5);
			var table6 = new ParserState(6);
			var table7 = new ParserState(7);
			var table8 = new ParserState(8);
			var table9 = new ParserState(9);
			var table10 = new ParserState(10);
			var table11 = new ParserState(11);
			var table12 = new ParserState(12);
			var table13 = new ParserState(13);

			var tableDefinition0 = new Dictionary<int, ParserAction>
				{
					{3, new ParserAction(None, ref table1)},
					{4, new ParserAction(None, ref table2)},
					{5, new ParserAction(Shift, ref table3)},
					{6, new ParserAction(None, ref table4)},
					{7, new ParserAction(Shift, ref table5)},
					{8, new ParserAction(Shift, ref table6)},
					{9, new ParserAction(Shift, ref table7)},
					{10, new ParserAction(Shift, ref table8)}
				};

			var tableDefinition1 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Accept)}
				};

			var tableDefinition2 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table1)},
					{5, new ParserAction(Shift, ref table9)},
					{6, new ParserAction(None, ref table10)},
					{7, new ParserAction(Shift, ref table5)},
					{8, new ParserAction(Shift, ref table6)},
					{9, new ParserAction(Shift, ref table7)},
					{10, new ParserAction(Shift, ref table8)}
				};

			var tableDefinition3 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table3)}
				};

			var tableDefinition4 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table4)},
					{5, new ParserAction(Reduce, ref table4)},
					{7, new ParserAction(Reduce, ref table4)},
					{8, new ParserAction(Reduce, ref table4)},
					{9, new ParserAction(Reduce, ref table4)},
					{10, new ParserAction(Reduce, ref table4)},
					{11, new ParserAction(Reduce, ref table4)}
				};

			var tableDefinition5 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table6)},
					{5, new ParserAction(Reduce, ref table6)},
					{7, new ParserAction(Reduce, ref table6)},
					{8, new ParserAction(Reduce, ref table6)},
					{9, new ParserAction(Reduce, ref table6)},
					{10, new ParserAction(Reduce, ref table6)},
					{11, new ParserAction(Reduce, ref table6)}
				};

			var tableDefinition6 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table7)},
					{5, new ParserAction(Reduce, ref table7)},
					{7, new ParserAction(Reduce, ref table7)},
					{8, new ParserAction(Reduce, ref table7)},
					{9, new ParserAction(Reduce, ref table7)},
					{10, new ParserAction(Reduce, ref table7)},
					{11, new ParserAction(Reduce, ref table7)}
				};

			var tableDefinition7 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table8)},
					{5, new ParserAction(Reduce, ref table8)},
					{7, new ParserAction(Reduce, ref table8)},
					{8, new ParserAction(Reduce, ref table8)},
					{9, new ParserAction(Reduce, ref table8)},
					{10, new ParserAction(Reduce, ref table8)},
					{11, new ParserAction(Reduce, ref table8)}
				};

			var tableDefinition8 = new Dictionary<int, ParserAction>
				{
					{4, new ParserAction(None, ref table11)},
					{6, new ParserAction(None, ref table4)},
					{7, new ParserAction(Shift, ref table5)},
					{8, new ParserAction(Shift, ref table6)},
					{9, new ParserAction(Shift, ref table7)},
					{10, new ParserAction(Shift, ref table8)},
					{11, new ParserAction(Shift, ref table12)}
				};

			var tableDefinition9 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table2)}
				};

			var tableDefinition10 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table5)},
					{5, new ParserAction(Reduce, ref table5)},
					{7, new ParserAction(Reduce, ref table5)},
					{8, new ParserAction(Reduce, ref table5)},
					{9, new ParserAction(Reduce, ref table5)},
					{10, new ParserAction(Reduce, ref table5)},
					{11, new ParserAction(Reduce, ref table5)}
				};

			var tableDefinition11 = new Dictionary<int, ParserAction>
				{
					{6, new ParserAction(None, ref table10)},
					{7, new ParserAction(Shift, ref table5)},
					{8, new ParserAction(Shift, ref table6)},
					{9, new ParserAction(Shift, ref table7)},
					{10, new ParserAction(Shift, ref table8)},
					{11, new ParserAction(Shift, ref table13)}
				};

			var tableDefinition12 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table10)},
					{5, new ParserAction(Reduce, ref table10)},
					{7, new ParserAction(Reduce, ref table10)},
					{8, new ParserAction(Reduce, ref table10)},
					{9, new ParserAction(Reduce, ref table10)},
					{10, new ParserAction(Reduce, ref table10)},
					{11, new ParserAction(Reduce, ref table10)}
				};

			var tableDefinition13 = new Dictionary<int, ParserAction>
				{
					{1, new ParserAction(Reduce, ref table9)},
					{5, new ParserAction(Reduce, ref table9)},
					{7, new ParserAction(Reduce, ref table9)},
					{8, new ParserAction(Reduce, ref table9)},
					{9, new ParserAction(Reduce, ref table9)},
					{10, new ParserAction(Reduce, ref table9)},
					{11, new ParserAction(Reduce, ref table9)}
				};

			table0.SetActions(ref tableDefinition0);

			table1.SetActions(ref tableDefinition1);

			table2.SetActions(ref tableDefinition2);

			table3.SetActions(ref tableDefinition3);

			table4.SetActions(ref tableDefinition4);

			table5.SetActions(ref tableDefinition5);

			table6.SetActions(ref tableDefinition6);

			table7.SetActions(ref tableDefinition7);

			table8.SetActions(ref tableDefinition8);

			table9.SetActions(ref tableDefinition9);

			table10.SetActions(ref tableDefinition10);

			table11.SetActions(ref tableDefinition11);

			table12.SetActions(ref tableDefinition12);

			table13.SetActions(ref tableDefinition13);

			Table = new Dictionary<int, ParserState>
				{
					{0, table0},
					{1, table1},
					{2, table2},
					{3, table3},
					{4, table4},
					{5, table5},
					{6, table6},
					{7, table7},
					{8, table8},
					{9, table9},
					{10, table10},
					{11, table11},
					{12, table12},
					{13, table13}
				};

			DefaultActions = new Dictionary<int, ParserAction>
				{
					{3, new ParserAction(Reduce, ref table3)},
					{9, new ParserAction(Reduce, ref table2)}
				};

			Productions = new Dictionary<int, ParserProduction>
				{				
					{0, new ParserProduction(symbol0)},
					{1, new ParserProduction(symbol3,1)},
					{2, new ParserProduction(symbol3,2)},
					{3, new ParserProduction(symbol3,1)},
					{4, new ParserProduction(symbol4,1)},
					{5, new ParserProduction(symbol4,2)},
					{6, new ParserProduction(symbol6,1)},
					{7, new ParserProduction(symbol6,1)},
					{8, new ParserProduction(symbol6,1)},
					{9, new ParserProduction(symbol6,3)},
					{10, new ParserProduction(symbol6,2)}
				};




            //Setup Lexer
            
			Rules = new Dictionary<int, Regex>
				{
					{0, new Regex("^(?:(<(.|\n)[^>]*?\\/>))")},
					{1, new Regex("^(?:$)")},
					{2, new Regex("^(?:(<\\/(.|\n)[^>]*?>))")},
					{3, new Regex("^(?:(<\\/(.|\n)[^>]*?>))")},
					{4, new Regex("^(?:(<(.|\n)[^>]*?>))")},
					{5, new Regex("^(?:([A-Za-z0-9 .,?;]+))")},
					{6, new Regex("^(?:([ ]))")},
					{7, new Regex("^(?:((\n\r|\r\n|[\n\r])))")},
					{8, new Regex("^(?:(.))")},
					{9, new Regex("^(?:$)")}
				};

			Conditions = new Dictionary<string, LexerConditions>
				{
					{"htmlElement", new LexerConditions(new List<int> { 0,1,2,3,4,5,6,7,8,9 }, true)},
					{"INITIAL", new LexerConditions(new List<int> { 0,3,4,5,6,7,8,9 }, true)}
				};


        }

        public static void Main()
        {
			var parser = new Parser();
            var o = parser.Parse("<b>Test</b>");
		    o = o;
		}
		
		public void Trace()
		{
			
		}

        public ParserValue ParserPerformAction(ref ParserValue thisS, ref ParserValue yy, ref int yystate, ref JList<ParserValue> ss)
		{
			var so = ss.Length - 1;


switch (yystate) {
case 1:return ss[so];
break;
case 2:return ss[so-1];
break;
case 3:
		thisS = new ParserValue("");
	
break;
case 4:
		thisS = new ParserValue("content");
	
break;
case 5:
		thisS = new ParserValue(ss[so-1].StringValue + "content");
	
break;
case 6:
		thisS = new ParserValue("string");
    
break;
case 7:
		thisS = new ParserValue("lineEnd");
    
break;
case 8:
		thisS = new ParserValue("tag");
	
break;
case 9:
		thisS = new ParserValue("open");
	
break;
case 10:
		thisS = new ParserValue("tag");
	
break;
}

            return null;
		}
		
		public ParserSymbol ParserLex()
		{
			var token = LexerLex();//end = 1
			token = (token != null ? token : Symbols["end"]);
			
			return token;
		}
		
		public void ParseError(string error, ParserError hash = null)
		{
			throw new InvalidOperationException(error);
		}

        public void LexerError(string error, LexerError hash = null)
        {
            throw new InvalidOperationException(error);
        }

        public ParserValue Parse(string input)
        {
            var stack = new JList<ParserCachedAction>
                {
                    new ParserCachedAction(new ParserAction(0, Table[0]))
                };
            var vstack = new JList<ParserValue>
                {
                    new ParserValue()
                };
            var yy = new ParserValue();
            var _yy = new ParserValue();
            var v = new ParserValue();
			int recovering = 0;
			ParserSymbol symbol = null;
            ParserAction action = null;
			string errStr = "";
			ParserSymbol preErrorSymbol = null;
            ParserState state = null;

            SetInput(input);

			while (true)
			{
				// retreive state number from top of stack
                state = stack.Last().Action.State;
                
				// use default actions if available
			    if (state != null && DefaultActions.ContainsKey(state.Index))
			    {
			        action = DefaultActions[state.Index];
			    }
			    else
			    {
			        if (symbol == null)
			        {
			            symbol = ParserLex();
			        }
			        // read action for current state and first input
			        if (state != null && state.Actions.ContainsKey(symbol.Index))
			        {
                        action = state.Actions[symbol.Index];
			        }
			        else
			        {
			            action = null;
			        }
			    }

			    if (action == null)
                {
					if (recovering > 0)
                    {
						// Report error
						var expected = new Stack<string>{};
						foreach(var p in Table[state.Index].Actions)
						{
						    expected.Push(Terminals[p.Value.Action].Name);
						}
						
						errStr = "Parse error on line " + (Yy.LineNo + 1).ToString() + ":" + '\n' +
							ShowPosition() + '\n' + 
							"Expecting " + String.Join(", ", expected) +
							", got '" +
							(symbol != null ? Terminals[symbol.Index].ToString() : "NOTHING") + "'";

					    ParseError(errStr, new ParserError(Match, state, symbol, Yy.LineNo, yy.Loc, expected));
					}
				}
				
				/*if (state.IsArray()) {
					this.parseError("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
				}*/

			    if (state == null)
			    {
			        break;
			    }
				
				switch (action.Action)
                {
				    case Shift:
                        stack.Push(new ParserCachedAction(symbol, action));
					    vstack.Push(Yy);

					    symbol = null;
					    if (preErrorSymbol == null)
                        { // normal execution/no error
                            yy = new ParserValue(Yy);
						    if (recovering > 0) recovering--;
					    } else { // error just occurred, resume old lookahead f/ before error
						    symbol = preErrorSymbol;
						    preErrorSymbol = null;
					    }
					    break;
		
				    case Reduce:
                        int len = Productions[action.State.Index].Len;
					    // perform semantic action
                        _yy = vstack[vstack.Length - len];
                        
                        if (Ranges != null)
                        {
                            Yy.Loc.Range = new ParserRange(
                                vstack[vstack.Length - len].Loc.Range.X,
                                vstack.Last().Loc.Range.Y
                            );
                        }

                        ParserValue value = ParserPerformAction(ref _yy, ref yy, ref action.State.Index, ref vstack);
					
					    if (value != null)
                        {
						    return value;
					    }
					
					    // pop off stack
					    while (len > 0) {
                            stack.Pop();
						    vstack.Pop();
                            len--;
					    }

					    vstack.Push(_yy);
                        var nextSymbol = Productions[action.State.Index].Symbol;
					    // goto new state = table[STATE][NONTERMINAL]
                        var nextState = stack.Last().Action.State;
                        //int stateIndex = nextState.Action.State.Index;
                        var nextAction = nextState.Actions[nextSymbol.Index];

                        stack.Push(new ParserCachedAction(nextSymbol, nextAction));
					
					    break;
		
				    case Accept:
					    return v;
			        }
			}
			
			return v;
		}
		
		/* Jison generated lexer */
		public ParserSymbol Eof = new ParserSymbol("Eof", 1);
        public ParserValue Yy = new ParserValue();
		public string Match = "";
		public string Matched = "";
        public Stack<string> ConditionStack;
        public Dictionary<int, Regex> Rules;
        public Dictionary<string, LexerConditions> Conditions;
		public bool Done = false;
		public bool Less;
		public bool _More;
		public string _Input;
		public int Offset;
        public Dictionary<int, ParserRange>Ranges;
        public bool Flex = false;
		
		public void SetInput(string input)
		{
			_Input = input;
			_More = Less = Done = false;
			Yy.LineNo = Yy.Leng = 0;
			Matched = Match = "";
            ConditionStack = new Stack<string>();
			ConditionStack.Push("INITIAL");

            if (Ranges != null)
            {
                Yy.Loc = new ParserLocation(1, 0, 1, 0, new ParserRange(0,0));
            } else {
                Yy.Loc = new ParserLocation(1, 0, 1, 0);
            }

			Offset = 0;
		}
		
		public string Input()
		{
            string ch = _Input[0].ToString();
			Yy.Text += ch;
			Yy.Leng++;
			Offset++;
			Match += ch;
			Matched += ch;
			Match lines = Regex.Match(ch, "/(?:\r\n?|\n).*/");
			if (lines.Success) {
				Yy.LineNo++;
				Yy.Loc.LastLine++;
			} else {
                Yy.Loc.LastColumn++;
			}

			if (Ranges != null)
			{
                Yy.Loc.Range.Y++;
			}
			
			_Input = _Input.Substring(1);
			return ch;
		}
		
		public void Unput(string ch)
		{
			int len = ch.Length;
			var lines = Regex.Split(ch, "/(?:\r\n?|\n)/");
			
			_Input = ch + _Input;
			Yy.Text = Yy.Text.Substring(0, len - 1);
			Offset -= len;
			var oldLines = Regex.Split(Match, "/(?:\r\n?|\n)/");
			Match = Match.Substring(0, Match.Length - 1);
			Matched = Matched.Substring(0, Matched.Length - 1);
			
			if ((lines.Length - 1) > 0) Yy.LineNo -= lines.Length - 1;
			var r = Yy.Loc.Range;

            Yy.Loc = new ParserLocation(
                Yy.Loc.FirstLine,
                Yy.LineNo + 1,
                Yy.Loc.FirstColumn,
                (
                    lines.Length > 0 ?
                        (
                            lines.Length == oldLines.Length ?
                                Yy.Loc.FirstColumn :
                                0
                        ) + oldLines[oldLines.Length - lines.Length].Length - lines[0].Length
                        : Yy.Loc.FirstColumn - len
                ));
			
			if (Ranges.Count > 0) {
				Yy.Loc.Range = new ParserRange(r.X, r.X + Yy.Leng - len);
			}
		}
		
		public void More()
		{
			_More = true;
		}
		
		public string PastInput()
		{
			var past = Matched.Substring(0, Matched.Length - Match.Length);
			return (past.Length > 20 ? "..." : "") + Regex.Replace(past.Substring(-20), "/\n/", "");
		}
		
		public string UpcomingInput()
		{
			var next = Match;
			if (next.Length < 20)
            {
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

        public ParserSymbol Next()
		{
			if (Done == true)
			{
			    return Eof;
			}
			
			if (String.IsNullOrEmpty(_Input))
			{
			    Done = true;
			}
	
			if (_More == false)
            {
				Yy.Text = "";
				Match = "";
			}
	
			var rules = CurrentRules();
			string match = "";
		    bool matched = false;
			int index = 0;
            Regex rule;
			for (int i = 0; i < rules.Count; i++)
            {
                rule = Rules[rules[i]];
				var tempMatch = rule.Match(_Input);
	            if (tempMatch.Success == true && (match != null || tempMatch.Length > match.Length)) {
                    match = tempMatch.Value;
	                matched = true;
	                index = i;
	                if (!Flex) {
						break;
					}
	            }
			}
			if ( matched )
            {
				Match lineCount = Regex.Match(match, "/\n.*/");

				Yy.LineNo += lineCount.Length;
				Yy.Loc.FirstLine = Yy.Loc.LastLine;
                Yy.Loc.LastLine = Yy.LineNo + 1;
                Yy.Loc.FirstColumn = Yy.Loc.LastColumn;
                Yy.Loc.LastColumn = lineCount.Length > 0 ? lineCount.Length - 1 : Yy.Loc.LastColumn + match.Length;

                Yy.Text += match;
                Match += match;
                Matched += match;
                
				//this.matches = match;
				Yy.Leng = Yy.Text.Length;
				if (Ranges != null)
				{
				    Yy.Loc.Range = new ParserRange(Offset, Offset += Yy.Leng);
				}
				_More = false;
				_Input = _Input.Substring(match.Length);
				ParserSymbol token = Symbols[LexerPerformAction(rules[index], ConditionStack.Peek())];
	
				if (Done == true && String.IsNullOrEmpty(_Input) == false)
				{
				    Done = false;
				}
	
				if (token.Index > -1) {
					return token;
				} else {
					return null;
				}
			}
			
			if (String.IsNullOrEmpty(_Input)) {
				return Symbols["EOF"];
			} else
			{
			    LexerError("Lexical error on line " + (Yy.LineNo + 1) + ". Unrecognized text.\n" + ShowPosition(), new LexerError("", -1, Yy.LineNo));
				return null;
			}
		}

        public ParserSymbol LexerLex()
		{
			var r = Next();

            if (r != null)
            {
                return r;
            } else {
                return LexerLex();
            }
		}
	
		public void Begin(string condition)
		{
			ConditionStack.Push(condition);
		}
		
		public string PopState()
		{
			return ConditionStack.Pop();
		}
		
		public List<int> CurrentRules()
		{
            var peek = ConditionStack.Peek();
            return Conditions[peek].Rules;
		}
		
		public dynamic LexerPerformAction(int avoidingNameCollisions, string Yy_Start)
		{
			

;
switch(avoidingNameCollisions) {
case 0:
        return 9;
	
break;
case 1:
		return 5;
	
break;
case 2:
		return 11;
	
break;
case 3://close
    	return 11;
	
break;
case 4://open
		return 10;
	
break;
case 5:return 7;
break;
case 6:return 7;
break;
case 7:
		return 8;
	
break;
case 8:return 7;
break;
case 9:return 5;
break;
}

			return -1;
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
        public int Leng = 0;
        public ParserLocation Loc;
        public int LineNo = 0;
        public string Text = "";

        public ParserValue()
        {
        }

        public ParserValue(ParserValue parserValue)
        {
            ValueSet = parserValue.ValueSet;
            BoolValue = parserValue.BoolValue;
            DecimalValue = parserValue.DecimalValue;
            StringValue = parserValue.StringValue;
            StackBoolValue = parserValue.StackBoolValue;
            StackDecimalValue =  parserValue.StackDecimalValue;
            StackStringValue = parserValue.StackStringValue;
            Children = parserValue.Children;
            Leng = parserValue.Leng;
            Loc = parserValue.Loc;
            LineNo = parserValue.LineNo;
            Text = parserValue.Text;
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

    class LexerConditions
    {
        public List<int> Rules;
        public bool Inclusive;

        public LexerConditions(List<int> rules, bool inclusive)
        {
            Rules = rules;
            Inclusive = inclusive;
        }
    }

    class ParserProduction
    {
        public int Len = 0;
        public ParserSymbol Symbol;

        public ParserProduction(ParserSymbol symbol)
        {
            Symbol = symbol;
        }

        public ParserProduction(ParserSymbol symbol, int len)
        {
            Symbol = symbol;
            Len = len;
        }
    }

    class ParserCachedAction
    {
        public ParserAction Action;
        public ParserSymbol Symbol;

        public ParserCachedAction(ParserAction action)
        {
            Action = action;
        }

        public ParserCachedAction(ParserSymbol symbol, ParserAction action)
        {
            Action = action;
            Symbol = symbol;
        }
    }

    class ParserAction
    {
        public int Action = 0;
        public ParserState State;
        public ParserSymbol Symbol;

        public ParserAction(int action)
        {
            Action = action;
        }

        public ParserAction(int action, ref ParserState state)
        {
            Action = action;
            State = state;
        }

        public ParserAction(int action, ParserState state)
        {
            Action = action;
            State = state;
        }

        public ParserAction(int action, ref ParserSymbol symbol)
        {
            Action = action;
            Symbol = symbol;
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

    class ParserError
    {
        public String Text;
        public ParserState State;
        public ParserSymbol Symbol;
        public int LineNo;
        public ParserLocation Loc;
        public Stack<string> Expected;

        public ParserError(String text, ParserState state, ParserSymbol symbol, int lineNo, ParserLocation loc, Stack<string> expected)
        {
            Text = text;
            State = state;
            Symbol = symbol;
            LineNo = lineNo;
            Loc = loc;
            Expected = expected;
        }
    }

    class LexerError
    {
        public String Text;
        public int Token;
        public int LineNo;

        public LexerError(String text, int token, int lineNo)
        {
            Text = text;
            Token = token;
            LineNo = lineNo;
        }
    }

    class ParserState
    {
        public int Index;
        public Dictionary<int, ParserAction> Actions = new Dictionary<int, ParserAction>();

        public ParserState(int index)
        {
            Index = index;
        }

        public void SetActions(ref Dictionary<int, ParserAction> actions)
        {
            Actions = actions;
        }
    }

    class ParserRange
    {
        public int X;
        public int Y;

        public ParserRange(int x, int y)
        {
            X = x;
            Y = y;
        }
    }

    class ParserSymbols
    {
        private Dictionary<string, ParserSymbol> SymbolsString = new Dictionary<string, ParserSymbol>();
        private Dictionary<int, ParserSymbol> SymbolsInt = new Dictionary<int, ParserSymbol>();

        public void Add(ParserSymbol symbol)
        {
            SymbolsInt.Add(symbol.Index, symbol);
            SymbolsString.Add(symbol.Name, symbol);
        }

        new public ParserSymbol this[string name]
        {
            get
            {
                return SymbolsString[name];
            }
        }

        new public ParserSymbol this[int index]
        {
            get
            {
                return SymbolsInt[index];
            }
        }
    }

    class JList<T> : List<T> where T : class
    {
        public int Length = 0;

        public void Push(T item)
        {
            Add(item);
            Length++;
        }

        public void Pop()
        {
            RemoveAt(Count - 1);
            Length = Math.Max(0, Count);
        }

        new public void Clear()
        {
            Length = 0;
            base.Clear();
        }

        new public T this[int index]
        {
            get
            {
                if (index >= Length || index < 0 || Length == 0)
                {
                    return null;
                }
                return base[index];
            }
        }
    }
}
