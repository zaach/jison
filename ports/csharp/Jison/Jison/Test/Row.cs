using System;
using System.Collections.Generic;

namespace Sheet
{
	public class Row: Dictionary<int, Cell>
	{
        public Spreadsheet Parent;
	    public int CellIndex = -1;

		public Row ()
		{
		}

        public Cell AddCell()
        {
            return AddCell("", false);
        }

        public Cell AddCell(string value)
        {
            return AddCell(value, false);
        }

	    public Cell AddCell(string value, bool isFormula)
	    {
            var cell = new Cell();
	        CellIndex++;
	        cell.Parent = this;
            
            if (isFormula)
            { 
                cell.Formula = value;
                cell.HasFormula = true;
            }
            else
            {
                cell.Value = value;
            }

            Add(CellIndex, cell);
	        return cell;
	    }

        public Cell this[string col]
        {
            get { return this[Location.Alphabet[col]]; }
        }
	}
}

