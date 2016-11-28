using System;

namespace Sheet
{
	public class Test
	{
		public Test ()
		{
		}

		public static void Main()
		{
            var spreadsheets = new Spreadsheets();
            var spreadsheet = spreadsheets.AddSpreadsheet();

            var row = spreadsheet.AddRow();

            var cellA1 = row.AddCell("250");
		    var cellB1 = row.AddCell("250");
		    var cellC1 = row.AddCell("800 - (SUM(A1:B1) + 100)", true);

            var cell = spreadsheet["C", 1];
		    var value = cell.UpdateValue();
            Console.Write(value.ToDouble());
		    Console.Read();
		}
	}
}
;