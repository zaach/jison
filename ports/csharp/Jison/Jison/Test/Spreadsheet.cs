using System;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace jQuerySheet
{
	public class Spreadsheet
    {
        static public int ActiveSpreadsheet = 0;
		static public SpreadsheetsDictionary Spreadsheets;


		public SpreadsheetsDictionary Calc()
		{
			foreach (var Spreadsheet in Spreadsheets.Values) {
				foreach (var row in Spreadsheet.Values) {
					foreach (var cell in row) {
						cell.Value.UpdateValue();
					}
				}
			}

			return Spreadsheets;
		}

		public static DateTime CalcLast;

		public static Expression UpdateCellValue(Cell cell)
        {
            if (cell.HasFormula && cell.State.Count < 1)
            {
                cell.State.Push("Parsing");
				cell.CalcCount++;
				cell.CalcLast = CalcLast;
                var formula = new Formula();
                var value = formula.Parse(cell.Formula);
                cell.State.Pop();
                return value;
            }
            return cell.Exp;
        }

		public static Expression CellValue(int spreadsheet, int row, int col)
	    {
            var cell = Spreadsheets[spreadsheet][row][col];
            var value = UpdateCellValue(cell);
            return value;
	    }

		public static Expression CellValue(Location loc)
        {
            var cell = Spreadsheets[loc.Sheet][loc.Row][loc.Col];
            var value = UpdateCellValue(cell);
            return value;
        }

		public static Expression CellValue(Location locStart, Location locEnd)
        {
			var range = new Expression();

            for (var row = locStart.Row; row <= locEnd.Row; row++)
            {
                for (var col = locStart.Col; col <= locEnd.Col; col++)
                {
                    range.Push(Spreadsheets[locStart.Sheet][row][col].UpdateValue());
                }
            }

            return range;
        }
    }
}
