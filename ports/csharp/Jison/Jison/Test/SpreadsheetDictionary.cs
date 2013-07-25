using System;
using System.Collections.Generic;
using jQuerySheet;

namespace jQuerySheet
{
	public class SpreadsheetDictionary : Dictionary<int, RowDictionary>
	{
		public int RowIndex = -1;
		public RowDictionary ActiveRow;
		public void AddRow()
		{
			ActiveRow = new RowDictionary();
			RowIndex++;
			Add (RowIndex, ActiveRow);
	    }
	}
}

