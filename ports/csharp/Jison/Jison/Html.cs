using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;


namespace Jison
{
    class Parser
    {
        public JList<ParserSymbol> Symbols = new JList<ParserSymbol>();
        public Dictionary<int, ParserSymbol> Terminals;
        public JList<ParserProduction> Productions = new JList<ParserProduction>();
        public JList<Dictionary<int, ParserAction>> Table = new JList<Dictionary<int, ParserAction>>();
        public IDictionary<int, ParserAction> DefaultActions = new Dictionary<int, ParserAction>();
		public string Version = "0.3.12";
		public bool Debug = false;
		
		public Parser()
		{
        			var symbol0 = new ParserSymbol("accept", 0);
			Symbols.Push(symbol0);
			var symbol1 = new ParserSymbol("end", 1);
			Symbols.Push(symbol1);
			var symbol2 = new ParserSymbol("error", 2);
			Symbols.Push(symbol2);
			var symbol3 = new ParserSymbol("wiki", 3);
			Symbols.Push(symbol3);
			var symbol4 = new ParserSymbol("contents", 4);
			Symbols.Push(symbol4);
			var symbol5 = new ParserSymbol("EOF", 5);
			Symbols.Push(symbol5);
			var symbol6 = new ParserSymbol("content", 6);
			Symbols.Push(symbol6);
			var symbol7 = new ParserSymbol("CONTENT", 7);
			Symbols.Push(symbol7);
			var symbol8 = new ParserSymbol("LINE_END", 8);
			Symbols.Push(symbol8);
			var symbol9 = new ParserSymbol("HTML_TAG_INLINE", 9);
			Symbols.Push(symbol9);
			var symbol10 = new ParserSymbol("HTML_TAG_OPEN", 10);
			Symbols.Push(symbol10);
			var symbol11 = new ParserSymbol("HTML_TAG_CLOSE", 11);
			Symbols.Push(symbol11);

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
				{9, new Regex("^(?:$)")}};

			Conditions.Add("htmlElement", new ParserConditions(new List<int> { 0,1,2,3,4,5,6,7,8,9 }, true));
			Conditions.Add("INITIAL", new ParserConditions(new List<int> { 0,3,4,5,6,7,8,9 }, true));

			Terminals = new Dictionary<int, ParserSymbol>(){
				{2,symbol2},
				{5,symbol5},
				{7,symbol7},
				{8,symbol8},
				{9,symbol9},
				{10,symbol10},
				{11,symbol11}};

			Table.Push(new Dictionary<int, ParserAction>() {
				{3, new ParserAction(-1,1)},
				{4, new ParserAction(-1,2)},
				{5, new ParserAction(1,3)},
				{6, new ParserAction(-1,4)},
				{7, new ParserAction(1,5)},
				{8, new ParserAction(1,6)},
				{9, new ParserAction(1,7)},
				{10, new ParserAction(1,8)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(3)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,1)},
				{5, new ParserAction(1,9)},
				{6, new ParserAction(-1,10)},
				{7, new ParserAction(1,5)},
				{8, new ParserAction(1,6)},
				{9, new ParserAction(1,7)},
				{10, new ParserAction(1,8)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,3)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,4)},
				{5, new ParserAction(2,4)},
				{7, new ParserAction(2,4)},
				{8, new ParserAction(2,4)},
				{9, new ParserAction(2,4)},
				{10, new ParserAction(2,4)},
				{11, new ParserAction(2,4)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,6)},
				{5, new ParserAction(2,6)},
				{7, new ParserAction(2,6)},
				{8, new ParserAction(2,6)},
				{9, new ParserAction(2,6)},
				{10, new ParserAction(2,6)},
				{11, new ParserAction(2,6)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,7)},
				{5, new ParserAction(2,7)},
				{7, new ParserAction(2,7)},
				{8, new ParserAction(2,7)},
				{9, new ParserAction(2,7)},
				{10, new ParserAction(2,7)},
				{11, new ParserAction(2,7)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,8)},
				{5, new ParserAction(2,8)},
				{7, new ParserAction(2,8)},
				{8, new ParserAction(2,8)},
				{9, new ParserAction(2,8)},
				{10, new ParserAction(2,8)},
				{11, new ParserAction(2,8)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{4, new ParserAction(-1,11)},
				{6, new ParserAction(-1,4)},
				{7, new ParserAction(1,5)},
				{8, new ParserAction(1,6)},
				{9, new ParserAction(1,7)},
				{10, new ParserAction(1,8)},
				{11, new ParserAction(1,12)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,2)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,5)},
				{5, new ParserAction(2,5)},
				{7, new ParserAction(2,5)},
				{8, new ParserAction(2,5)},
				{9, new ParserAction(2,5)},
				{10, new ParserAction(2,5)},
				{11, new ParserAction(2,5)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{6, new ParserAction(-1,10)},
				{7, new ParserAction(1,5)},
				{8, new ParserAction(1,6)},
				{9, new ParserAction(1,7)},
				{10, new ParserAction(1,8)},
				{11, new ParserAction(1,13)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,10)},
				{5, new ParserAction(2,10)},
				{7, new ParserAction(2,10)},
				{8, new ParserAction(2,10)},
				{9, new ParserAction(2,10)},
				{10, new ParserAction(2,10)},
				{11, new ParserAction(2,10)}});

			Table.Push(new Dictionary<int, ParserAction>() {
				{1, new ParserAction(2,9)},
				{5, new ParserAction(2,9)},
				{7, new ParserAction(2,9)},
				{8, new ParserAction(2,9)},
				{9, new ParserAction(2,9)},
				{10, new ParserAction(2,9)},
				{11, new ParserAction(2,9)}});

			DefaultActions.Add(3, new ParserAction(2,3));
			DefaultActions.Add(9, new ParserAction(2,2));


			Productions.Push(new ParserProduction(symbol0));
			Productions.Push(new ParserProduction(symbol3,1));
			Productions.Push(new ParserProduction(symbol3,2));
			Productions.Push(new ParserProduction(symbol3,1));
			Productions.Push(new ParserProduction(symbol4,1));
			Productions.Push(new ParserProduction(symbol4,2));
			Productions.Push(new ParserProduction(symbol6,1));
			Productions.Push(new ParserProduction(symbol6,1));
			Productions.Push(new ParserProduction(symbol6,1));
			Productions.Push(new ParserProduction(symbol6,3));
			Productions.Push(new ParserProduction(symbol6,2));

		}
		
		public static void Main() {
			var parser = new Parser();
            var o = parser.Parse("Test");
		    o = o;
		}
		
		public void Trace()
		{
			
		}

        public ParserValue ParserPerformAction(ParserValue thisS, ParserValue yy, int yystate, JList<ParserValue> SS)
		{
			var SO = SS.Length - 1;


switch (yystate) {
case 1:return SS[SO];
break;
case 2:return SS[SO-1];
break;
case 3:
		return new ParserValue("");
	
break;
case 4:thisS = SS[SO];
break;
case 5:
		
		SS[SO-1].StringValue += SS[SO].StringValue;
		thisS = SS[SO-1];
	
break;
case 6:
		thisS = SS[SO];
    
break;
case 7:
		thisS = SS[SO];
    
break;
case 8:
		thisS = SS[SO];
	
break;
case 9:
		thisS = SS[SO-2];
	
break;
case 10:
		thisS = SS[SO];
	
break;
}

            return null;
		}
		
		public int ParserLex()
		{
			var token = LexerLex();//end = 1
			token = (token != 0 ? token : 1);
			
			// if token isn't its numeric value, convert
			if ( token > -1 && Symbols[token] != null) {
                return token;
			}
			
			return token;
		}
		
		public void ParseError(string error, Dictionary<string, dynamic> hash = null)
		{
			throw new System.InvalidOperationException(error);
		}

        public ParserValue Parse(string input)
        {
            var stack = new JList<ParserSymbol>();
            stack.Push(new ParserSymbol("", 0));
            var vstack = new JList<ParserValue>();
            vstack.Push(new ParserValue());
            var lstack = new JList<ParserLocation>();

            var yy = new ParserValue();
            var _yy = new ParserValue();
            var v = new ParserValue();
			int recovering = 0;
			int TERROR = 2;
			int symbol = -1;
            ParserAction action = null;
			string errStr = "";
			int preErrorSymbol = -1;
            ParserSymbol state = null;

            SetInput(input);

			while (true)
			{
				// retreive state number from top of stack
                state = stack.Last();
                
				// use default actions if available
			    if (state != null && DefaultActions.ContainsKey(state.Index))
			    {
			        action = DefaultActions[state.Index];
			    }
			    else
			    {
			        if (symbol <= 0)
			        {
			            symbol = ParserLex();
			        }
			        // read action for current state and first input
			        if (Table[state.Index] != null && Table[state.Index].ContainsKey(symbol))
			        {
                        var t = Table[state.Index];
                       action = t[symbol];

			        }
			        else
			        {
			            action = null;
			        }
			    }

			    if (action == null) {
					if (recovering > 0) {
						// Report error
						string[] expected = new string[]{};
						foreach(var p in Table[state.Index]) {
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
					if (state != null && Table[state.Index].ContainsKey(TERROR)) {
                        action = Table[state.Index][TERROR];
					}
					recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
				}
				End:;
				
				/*if (type.IsArray()) {
					this.parseError("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
				}*/

			    if (state == null)
			    {
			        break;
			    }
				
				switch (action.Action) {
				    case 1:
					    // shift
					    stack.Push(Symbols[symbol]);
					    vstack.Push(_YY);
                        stack.Push(Symbols[action.State]);

					    symbol = -1;
					    if (preErrorSymbol == -1) { // normal execution/no error
                            yy = new ParserValue(_YY);
						    if (recovering > 0) recovering--;
					    } else { // error just occurred, resume old lookahead f/ before error
						    symbol = preErrorSymbol;
						    preErrorSymbol = -1;
					    }
					    break;
		
				    case 2:
					    // reduce
                        int len = Productions[action.Action].Len;
					    // perform semantic action
                        _yy = vstack[vstack.Length - len];
                        //yyval; yytext; yyleng; yylineno; action.State[0]; vstack; lstack; vstack.Count - 1;

                        ParserValue value = ParserPerformAction(_yy, yy, action.State, vstack);
					
					    if (value != null) {
						    return value;
					    }
					
					    // pop off stack
					    if (len > 0) {
                            stack.Pop();
                            stack.Pop();
						    vstack.Pop();
					    }
					
					    stack.Push(Productions[action.State].Symbol); // push nonterminal (reduce)
					    vstack.Push(yy);
					
					    // goto new state = table[STATE][NONTERMINAL]
				        var tableIndex = stack[stack.Length - 2].Index;
				        int stateIndex = stack[stack.Length - 1].Index;

					    dynamic newState = Symbols[Table[tableIndex][stateIndex].State];
					
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
        public ParserValue _YY = new ParserValue();
		public string YY = "";
		public int YYLineNo = 0;
		public int YYLeng = 0;
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
        public bool Flex = false;
		
		public void SetInput(string input)
		{
			_Input = input;
			_More = Less = Done = false;
			_YY.LineNo = _YY.Leng = 0;
			Matched = Match = "";
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
		    bool matched = false;
			int index = 0;
            Regex rule;
			for (int i = 0; i < rules.Count; i++) {
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
			if ( matched ) {
				Match lineCount = Regex.Match(match, "/\n.*/");
	
				_YY.LineNo += lineCount.Length;
				_YY.Loc.FirstLine = _YY.Loc.LastLine;
                _YY.Loc.LastLine = _YY.LineNo + 1;
                _YY.Loc.FirstColumn = _YY.Loc.LastColumn;
                _YY.Loc.LastColumn = lineCount.Length > 0 ? lineCount.Length - 1 : _YY.Loc.LastColumn + match.Length;

                _YY.Text += match;
                Match += match;
                Matched += match;
                
				//this.matches = match;
				_YY.Leng = _YY.Text.Length;
				if (Ranges.Length > 0) {
					//TODO: YYLoc.Range = new int[] {Offset, Offset += YYLeng};
				}
				_More = false;
				_Input = _Input.Substring(match.Length);
				var token = LexerPerformAction(YY, this, rules[index], ConditionStack.Peek());
	
				if (Done == true && String.IsNullOrEmpty(_Input) == false) Done = false;
	
				if (token != null) {
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

            if (r > -1)
            {
                return r;
            } else {
                return LexerLex();
            }
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
		
		public dynamic LexerPerformAction(dynamic yy, dynamic yy_, int avoiding_name_collisions, dynamic YY_START = null)
		{
			

;
switch(avoiding_name_collisions) {
case 0:
		//A tag that doesn't need to track state

		//A non-valid html tag, return "<" put the rest back into the parser
		return 7;
	
break;
case 1:
		//A tag that was left open, and needs to close
		
		return 7;
	
break;
case 2:
		//A tag that is open and we just found the close for it
		
		return 7;
	
break;
case 3:
		//An tag open

    	//A non-valid html tag, return the first character in the stack and put the rest back into the parser
		
		return 7;
	
break;
case 4:
		//A tag that was not opened, needs to be ignored
		
		return 7;
	
break;
case 5:return 7;
break;
case 6:return 7;
break;
case 7:
		
		return 7;
	
break;
case 8:return 7;
break;
case 9:return 5;
break;
}

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

        public string S = "";
        public ParserLocation _S;
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
            S = parserValue.S;
            _S = parserValue._S;
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

    class ParserAction
    {
        public int Action = -1;
        public int State = -1;

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

    internal class JList<T> : List<T> where T : class
    {
        public int Length = 0;

        new public void Push(T item)
        {
            Length++;
            base.Add(item);
        }

        new public void Pop()
        {
            Length--;
            Length = Math.Max(0, Length);
            base.RemoveAt(Length);
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
                if (index >= Length || Length == 0)
                {
                    return null;
                }
                return base[index];
            }
        }
    }
}
