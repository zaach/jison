using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace jQuerySheet
{
	public class Location
	{
		public Location ()
		{
		}

		public int Sheet = -1;
		public int Row = -1;
		public int Col = -1;
		public bool IsFixed = false;
		public bool IsRemote = false;
		
		static readonly public Dictionary<string, int> Alphabet = new Dictionary<string, int>()
		{
			{"A", 0},
			{"B", 1},
			{"C", 2},
			{"D", 3},
			{"E", 4},
			{"F", 5},
			{"G", 6},
			{"H", 7},
			{"I", 8},
			{"J", 9},
			{"K", 10},
			{"L", 11},
			{"M", 12},
			{"N", 13},
			{"O", 14},
			{"P", 15},
			{"Q", 16},
			{"R", 17},
			{"S", 18},
			{"T", 19},
			{"U", 20},
			{"V", 21},
			{"W", 22},
			{"X", 23},
			{"Y", 24},
			{"Z", 25}
		};
		
		static readonly public Regex Cell = new Regex("^([A-Z]+)([0-9]+)");
		
		public static Location Parse(string id)
		{
			return new Location(id);
		}
		
		public static Location ParseRemote(string sheet, string id)
		{
			return new Location(sheet, id);
		}
		
		public static Location ParseFixed(string id)
		{
			return new Location(id, true);
		}
		
		public static Location ParseRemoteFixed(string sheet, string id)
		{
			return new Location(sheet, id, true);
		}
		
		public void ParseCellId(string id)
		{
			var match = Cell.Match(id);
			if (match.Success)
			{
				Col = Alphabet[match.Groups[1].Value];
				Row = Convert.ToInt32(match.Groups[2].Value) - 1;
			}
			Sheet = Spreadsheet.ActiveSpreadsheet;
		}
		
		public void ParseSheetId(string sheet)
		{
			sheet = sheet.Replace("sheet", "");
			Sheet = Convert.ToInt32(sheet);
		}
		
		public Location(string id)
		{
			ParseCellId(id);
		}
		
		public Location(string sheet, string id)
		{
			ParseCellId(id);
			ParseSheetId(sheet);
			IsRemote = true;
		}
		
		public Location(string id, bool remote)
		{
			ParseCellId(id);
			IsRemote = remote;
		}
		
		public Location(string sheet, string id, bool remote)
		{
			ParseCellId(id);
			ParseSheetId(sheet);
			IsRemote = remote;
		}
	}
}

