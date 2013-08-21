using System;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Linq;
//@@USING_INJECT@@

/**/namespace Jison/**/
{
	public /**/class Parser/**/
	{
		public ParserSymbols Symbols;
		public Dictionary<int, ParserSymbol> Terminals;
		public Dictionary<int, ParserProduction> Productions;
		public Dictionary<int, ParserState> Table;
		public Dictionary<int, ParserAction> DefaultActions;
		public string Version = "0.4.2";
		public bool Debug = false;

		public const int None = 0;
		public const int Shift = 1;
		public const int Reduce = 2;
		public const int Accept = 3;

		public void Trace()
		{

		}

		/**/public Parser/**/()
		{
			//Setup Parser
			//@@PARSER_INJECT@@
			
			//Setup Lexer
			//@@LEXER_INJECT@@
		}
		
		public /**/ParserValue/**/ ParserPerformAction(ref /**/ParserValue/**/ thisS, ref /**/ParserValue/**/ yy, ref int yystate, ref JList</**/ParserValue/**/> ss)
		{
			var so = ss.Count - 1;//@@ParserPerformActionInjection@@
			return null;
		}

		public ParserSymbol ParserLex()
		{
			var token = LexerLex();//end = 1

            if (token != null)
            {
                return token;
            }

			return Symbols["end"];
		}

		public void ParseError(string error, ParserError hash = null)
		{
			throw new InvalidOperationException(error);
		}

		public void LexerError(string error, LexerError hash = null)
		{
			throw new InvalidOperationException(error);
		}

		public /**/ParserValue/**/ Parse(string input)
		{
			if (Table == null) {
				throw new Exception("Empty table");
			}
			var stack = new JList<ParserCachedAction>
			{
				new ParserCachedAction(new ParserAction(0, Table[0]))
			};
			var vstack = new JList</**/ParserValue/**/>
			{
				new /**/ParserValue/**/()
			};
			var yy = new /**/ParserValue/**/();
			var _yy = new /**/ParserValue/**/();
			var v = new /**/ParserValue/**/();
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

				if (state == null || action == null)
				{
					break;
				}

				switch (action.Action)
				{
					case Shift:
						stack.Push(new ParserCachedAction(action, symbol));
						vstack.Push(Yy.Clone());

						symbol = null;
						if (preErrorSymbol == null)
						{ // normal execution/no error
							yy = Yy.Clone();
							if (recovering > 0) recovering--;
						} else { // error just occurred, resume old lookahead f/ before error
							symbol = preErrorSymbol;
							preErrorSymbol = null;
						}
					break;

					case Reduce:
						int len = Productions[action.State.Index].Len;
						// perform semantic action
						_yy = vstack[vstack.Count - len];

						if (Ranges != null)
						{
							Yy.Loc.Range = new ParserRange(
								vstack[vstack.Count - len].Loc.Range.X,
								vstack.Last().Loc.Range.Y
							);
						}

						var value = ParserPerformAction(ref _yy, ref yy, ref action.State.Index, ref vstack);

						if (value != null)
						{
							return value;
						}

						// pop off stack
						while (len > 0)
						{
							stack.Pop();
							vstack.Pop();
							len--;
						}

				        if (_yy == null)
				        {
							vstack.Push(new /**/ParserValue/**/());
				        }
				        else
				        {
				            vstack.Push(_yy.Clone());
				        }
				        var nextSymbol = Productions[action.State.Index].Symbol;
						// goto new state = table[STATE][NONTERMINAL]
						var nextState = stack.Last().Action.State;
						var nextAction = nextState.Actions[nextSymbol.Index];

						stack.Push(new ParserCachedAction(nextAction, nextSymbol));

					break;
					case Accept:
						return v;
				}
			}

			return v;
		}

		/* Jison generated lexer */
		public ParserSymbol Eof = new ParserSymbol("Eof", 1);
		public /**/ParserValue/**/ Yy = new /**/ParserValue/**/();
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
				Yy.Loc = new ParserLocation(new ParserRange(0,0));
			} else {
				Yy.Loc = new ParserLocation();
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
					) + oldLines[oldLines.Length - lines.Length].Length - lines[0].Length :
					Yy.Loc.FirstColumn - len
				)
			);

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
			return (past.Length > 20 ? "..." + Regex.Replace(past.Substring(-20), "/\n/", "") : "");
		}

		public string UpcomingInput()
		{
			var next = Match;
			if (next.Length < 20)
			{
				next += _Input.Substring(0, (next.Length > 20 ? 20 - next.Length : next.Length));
			}
			return Regex.Replace(next.Substring(0, (next.Length > 20 ? 20 - next.Length : next.Length)) + (next.Length > 20 ? "..." : ""), "/\n/", "");
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

				Yy.Leng = Yy.Text.Length;
				if (Ranges != null)
				{
					Yy.Loc.Range = new ParserRange(Offset, Offset += Yy.Leng);
				}
				_More = false;
				_Input = _Input.Substring(match.Length);
                var ruleIndex = rules[index];
                var nextCondition = ConditionStack.Peek();
                dynamic action = LexerPerformAction(ruleIndex, nextCondition);
				ParserSymbol token = Symbols[action];

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

			while (r == null)
			{
			    r = Next();
			}

		    return r;
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
			//@@LexerPerformActionInjection@@
			return -1;
		}
	}

	public class ParserLocation
	{
		public int FirstLine = 1;
		public int LastLine = 0;
		public int FirstColumn = 1;
		public int LastColumn = 0;
		public ParserRange Range;

		public ParserLocation()
		{
		}

		public ParserLocation(ParserRange range)
		{
			Range = range;
		}

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

	public class LexerConditions
	{
		public List<int> Rules;
		public bool Inclusive;

		public LexerConditions(List<int> rules, bool inclusive)
		{
			Rules = rules;
			Inclusive = inclusive;
		}
	}

	public class ParserProduction
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

	public class ParserCachedAction
	{
		public ParserAction Action;
		public ParserSymbol Symbol;

		public ParserCachedAction(ParserAction action)
		{
			Action = action;
		}

		public ParserCachedAction(ParserAction action, ParserSymbol symbol)
		{
			Action = action;
			Symbol = symbol;
		}
	}

	public class ParserAction
	{
		public int Action;
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

	public class ParserSymbol
	{
		public string Name;
		public int Index = -1;
		public IDictionary<int, ParserSymbol> Symbols = new Dictionary<int, ParserSymbol>();
		public IDictionary<string, ParserSymbol> SymbolsByName = new Dictionary<string, ParserSymbol>();

		public ParserSymbol()
		{
		}

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

	public class ParserError
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

	public class LexerError
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

	public class ParserState
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

	public class ParserRange
	{
		public int X;
		public int Y;

		public ParserRange(int x, int y)
		{
			X = x;
			Y = y;
		}
	}

	public class ParserSymbols
	{
		private Dictionary<string, ParserSymbol> SymbolsString = new Dictionary<string, ParserSymbol>();
		private Dictionary<int, ParserSymbol> SymbolsInt = new Dictionary<int, ParserSymbol>();

		public void Add(ParserSymbol symbol)
		{
			SymbolsInt.Add(symbol.Index, symbol);
			SymbolsString.Add(symbol.Name, symbol);
		}

		public ParserSymbol this[char name]
		{
			get
			{
				return SymbolsString[name.ToString()];
			}
		}

		public ParserSymbol this[string name]
		{
			get
			{
				return SymbolsString[name];
			}
		}

		public ParserSymbol this[int index]
		{
			get
			{
				if (index < 0)
				{
					return new ParserSymbol();
				}
				return SymbolsInt[index];
			}
		}
	}

	public class ParserValue
	{
		public string Text;
		public ParserLocation Loc;
		public int Leng = 0;
		public int LineNo = 0;
		
		public ParserValue()
		{
		}
		
		public ParserValue(ParserValue parserValue)
		{
			Text = parserValue.Text;
			Leng = parserValue.Leng;
			Loc = parserValue.Loc;
			LineNo = parserValue.LineNo;
		}
		
		public ParserValue Clone()
		{
			return new ParserValue(this);
		}
	}

	public class JList<T> : List<T> where T : class
	{
		public void Push(T item)
		{
			Add(item);
		}

		public void Pop()
		{
			RemoveAt(Count - 1);
		}

		new public T this[int index]
		{
			get
			{
				if (index >= Count || index < 0 || Count == 0)
				{
					return null;
				}
				return base[index];
			}
		}
	}
}