using System;
using jQuerySheet;

namespace jQuerySheet
{
	public class Test
	{
		public Test ()
		{
		}

		public static void Main()
		{
            Spreadsheet.Spreadsheets = new SpreadsheetsDictionary();
		    var spreadsheetsDictionary = new SpreadsheetDictionary();
            Spreadsheet.Spreadsheets.Add(0, spreadsheetsDictionary);
		    var row = new RowDictionary();
            spreadsheetsDictionary.Add(0, row);

		    var cellA1 = new Cell(0, 0, 0);
		    cellA1.Value = "250";
		    var cellB1 = new Cell(0, 0, 1);
            cellB1.Value = "250";
		    var cellC1 = new Cell(0, 0, 2);
            cellC1.Formula = "800 - SUM(A1:B1) + 100";
		    cellC1.HasFormula = true;

            row.Add(0, cellA1);
            row.Add(1, cellB1);
            row.Add(2, cellC1);

            //var spreadsheet = new Spreadsheet();
		    //spreadsheet.Calc();

		    var parsedCell = Spreadsheet.Spreadsheets[0][0][2];
		    var value = parsedCell.UpdateValue();
		    value = value;
		}
	}
}
;