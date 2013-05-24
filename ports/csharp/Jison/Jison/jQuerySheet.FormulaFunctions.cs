using System;
using System.Collections.Generic;
using Jison;

namespace jQuerySheet
{
	static public class FormulaFunctions
	{
		public static ParserValue Call(string fnName, ParserValue value)
		{
			switch (fnName.ToUpper())
			{
				case "SUM": return SUM(value);
			}

			return null;
		}

		public static ParserValue SUM(ParserValue value)
		{
			return value;
		}

		public static ParserValue SUM(Stack<ParserValue> values)
		{
			Decimal sum = 0;
			foreach(ParserValue value in values) {
				value.ToDecimal();
				sum += value.DecimalValue;
			}
			return new ParserValue(sum);
		}
	}
}

