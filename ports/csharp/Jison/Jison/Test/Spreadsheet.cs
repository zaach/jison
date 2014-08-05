using System;
using System.Collections.Generic;

namespace Sheet
{
	public class Spreadsheet : Dictionary<int, Row>
	{
	    public Spreadsheets Parent;
        public int Index;
		public int RowIndex = -1;
		public Row AddRow()
		{
			var row = new Row();
			RowIndex++;
		    row.Parent = this;
            Add(RowIndex, row);
            return row;
		}

        public Cell this[string colString, int rowInt]
        {
            get {
                var row = this[rowInt - 1];

                var colInt = Location.Alphabet[colString];
                var cell = row[colInt];
                return cell;
            }
        }

        public Cell this[int colInt, int rowInt]
        {
            get
            {
                var row = this[rowInt];
                var cell = row[colInt];
                return cell;
            }
        }

        public Spreadsheet(int index)
            : base() {
                Index = index;
        }

        public Location Parse(string id)
        {
            return new Location(this, id);
        }

        public Location ParseRemote(string sheet, string id)
        {
            return new Location(sheet, id);
        }

        public Location ParseFixed(string id)
        {
            return new Location(id, true);
        }

        public Location ParseRemoteFixed(string sheet, string id)
        {
            return new Location(sheet, id, true);
        }
	}
}

