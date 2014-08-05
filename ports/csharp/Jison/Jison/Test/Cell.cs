using System;
using System.Collections.Generic;

namespace Sheet
{
	public class Cell
	{
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
	    public Row Parent;

        public Cell()
        {
        }

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
				var formula = new Formula();
                formula.Setup(this);
				var value = formula.Parse (Formula);
				State.Pop ();
				return value;
			}

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

