using System;
using System.Collections.Generic;

namespace jQuerySheet
{
	public class Cell
	{
		public Cell ()
		{
		}

		public int Row;
		public int Col;
		public int Spreadsheet;
		public string Value;
		public Boolean HasFormula;
		public string Formula;
		public Expression Exp;
		
		public DateTime CalcLast = new DateTime();
		public int CalcCount = 0;
		
		public Stack<string> State = new Stack<string>();
		
		public Cell(int spreadsheet, int row, int col)
		{
			Spreadsheet = spreadsheet;
			Row = row;
			Col = col;
		}
		public Cell(int spreadsheet, int row, int col, string value)
		{
			Spreadsheet = spreadsheet;
			Row = row;
			Col = col;
			Value = value;
		}
		
		public Expression UpdateValue()
		{
			if (HasFormula && State.Count < 1) {
				State.Push ("Parsing");
				CalcCount++;
				var formula = new Formula ();
				var value = formula.Parse (Formula);
				State.Pop ();
				return value;
			} else {
				var exp = new Expression();
			    double num;
                if (double.TryParse(Value, out num))
                {
                    exp.Set(num);
                }
                else
                {
                    exp.Set(Value);
                }
			    return exp;
			}
		}
	}
}

