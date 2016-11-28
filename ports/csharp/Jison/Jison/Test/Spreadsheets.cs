using System;
using System.Linq;
using System.Collections.Generic;

namespace Sheet
{
	public class Spreadsheets : Dictionary<int, Spreadsheet>
	{
        public int ActiveSpreadsheet = -1;
	    public int SpreadsheetIndex = -1;

		public void Calc()
		{
			foreach (var spreadsheet in Values) {
				foreach (var row in spreadsheet.Values) {
					foreach (var cell in row) {
						cell.Value.UpdateValue();
					}
				}
			}
		}

		public DateTime CalcLast;

		public Expression UpdateCellValue(Cell cell)
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

		public Expression CellValue(int spreadsheet, int row, int col)
	    {
            Cell cell = Values.ElementAt(spreadsheet)
                .Values.ElementAt(row)
                .Values.ElementAt(col);

            var value = UpdateCellValue(cell);
            return value;
	    }

		public Expression CellValue(Location loc)
        {
            Cell cell = Values.ElementAt(loc.Sheet)
                .Values.ElementAt(loc.Row)
                .Values.ElementAt(loc.Col);

            var value = UpdateCellValue(cell);
            return value;
        }

		public Expression CellValue(Location locStart, Location locEnd)
        {
			var range = new Expression();

            for (var row = locStart.Row; row <= locEnd.Row; row++)
            {
                for (var col = locStart.Col; col <= locEnd.Col; col++)
                {
                    range.Push(
                        Values.ElementAt(locStart.Sheet)
                            .Values.ElementAt(row)
                            .Values.ElementAt(col).UpdateValue()
                    );
                }
            }

            return range;
        }

        public Spreadsheet AddSpreadsheet()
	    {
            SpreadsheetIndex++;
            var spreadsheet = new Spreadsheet(SpreadsheetIndex);
            spreadsheet.Parent = this;
            Add(SpreadsheetIndex, spreadsheet);
            return spreadsheet;
	    }
    }
}
