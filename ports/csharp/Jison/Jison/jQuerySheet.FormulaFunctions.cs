using System;
using System.Collections.Generic;
using Jison;

namespace jQuerySheet
{
	static public class FormulaFunctions
	{
        public static ParserValue Call(string fnName)
        {
            return Call(fnName, new ParserValue());
        }

		public static ParserValue Call(string fnName, ParserValue value)
		{
		    ParserValue result = null;
            switch (fnName.ToUpper())
			{
				case "SUM":
                    result = Sum(value);
			        break;
			}

			return result;
		}

		public static ParserValue Sum(ParserValue value)
		{
		    if (value.IsPushed)
		    {
		        double sum = 0;
		        foreach (ParserValue child in value.Children)
		        {
		            sum += child.ToDouble();
		        }
		        return new ParserValue(sum);
		    }

		    return new ParserValue(value.ToDouble());
		}
	}
}

