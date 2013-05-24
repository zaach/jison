using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Jison;
using System.Text.RegularExpressions;

namespace Jison
{
    class Formula : Parser
    {
        public List<Spreadsheet> Spreadsheets = new List<Spreadsheet>();
        public Type Functions;
        public string SpreadsheetsType = "cell";

        public Formula()
        {
            Functions = Type.GetType("FormulaFunctions");
        }

        private ParserValue UpdateCellValue(SpreadsheetCell cell)
        {
            if (cell.HasFormula && cell.State.Count < 1)
            {
                cell.State.Push("Parsing");
                var parser = new Parser();
                var value = parser.Parse(cell.Formula);
                cell.State.Pop();
                return value;
            }
            return cell.ParserValue;
        }

        private Dictionary<int[], SpreadsheetCell> CellRangeValue(string start, string end)
        {
            var _start = new SpreadsheetCellLocation(start);
            var _end = new SpreadsheetCellLocation(end);
            var range = new Dictionary<int[], SpreadsheetCell>();
            
            for (var row = _start.Row; row < _end.Row; row++)
            {
                for (var col= _start.Col; col < _end.Col; col++)
                {
                    range.Add(new int[]{row, col}, new SpreadsheetCell());
                }
            }

            return range;
        }

        private ParserValue CallFunction(string methodName, ParserValue args)
        {
            var m = Functions.GetMethod(methodName);
            var t = typeof (FormulaFunctions);
            if (m != null)
            {
                ParserValue result = new ParserValue();
                Func<ParserValue, ParserValue> fn = (Func<ParserValue, ParserValue>)Delegate.CreateDelegate(Functions, args, m);

                return fn(args);
            }
            return null;
        }
    }

    internal class Spreadsheet
    {
//        SpreadsheetFunction.
    }

    internal class SpreadsheetCell
    {
        public int Row;
        public int Cell;
        public int Spreadsheet;
        public string Value;
        public ParserValue ParserValue;
        public Boolean HasFormula;
        public string Formula;

        public DateTime CalcLast;
        public int CalcCount;

        public Stack<string> State;

    }

    public class FormulaFunctions
    {
        public static ParserValue SUM(ParserValue value)
        {
            return null;
        }
    }

    public class FormulaVariables
    {

    }

    public class SpreadsheetCellLocation
    {
        public int Row = -1;
        public int Col = -1;
        static readonly Regex Cell = new Regex("^([A-Z]+)([0-9]+)$");

        public SpreadsheetCellLocation(string id )
        {
            var match = Cell.Match(id);
            if (match.Success)
            {
                Col = Convert.ToInt32(match.Groups[0].Value);
                Row = Convert.ToInt32(match.Groups[1].Value);
            }
        }
    }
}
