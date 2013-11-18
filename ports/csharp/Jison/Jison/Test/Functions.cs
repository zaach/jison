using System;
using System.Collections.Generic;
using Jison;

namespace jQuerySheet
{
	public static class Functions
	{
        public static Expression Call(string fnName)
        {
			return Call(fnName, new Expression());
        }

		public static Expression Call(string fnName, Expression value)
		{
			Expression result = null;
            switch (fnName.ToUpper())
			{
				case "SUM":
                    result = Sum(value);
			        break;
			}

			return result;
		}

		public static Expression Sum(Expression value)
		{
		    if (value.Children != null)
		    {
		        double sum = 0;
				foreach (Expression child in value.Children)
		        {
		            sum += child.ToDouble();
		        }

				var firstChild = value.Children[0];
				firstChild.Set(sum);
				return firstChild;
		    }

			value.ToDouble ();
			return value;
		}
	}
}

