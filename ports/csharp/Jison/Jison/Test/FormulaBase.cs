using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Sheet
{
    public class FormulaBase
    {
        public Cell Parent;
        public Spreadsheet MySpreadsheet;
        public Spreadsheets MySpreadsheets;

        public void Setup(Cell cell)
        {
            Parent = cell;
            MySpreadsheet = cell.Parent.Parent;
            MySpreadsheets = MySpreadsheet.Parent;
        }
    }
}
