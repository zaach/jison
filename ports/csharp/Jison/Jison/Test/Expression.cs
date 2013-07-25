using System;
using System.Collections.Generic;

namespace jQuerySheet
{
	public class Expression : ParserValue
	{	
		public bool ValueSet = false;
		public string Type;
		
		public Expression(){}
		public Expression(Expression value)
		{
			Value = value.Value;
			Leng = value.Leng;
			Loc = value.Loc;
			LineNo = value.LineNo;
			ValueSet = value.ValueSet;
			BoolValue = value.BoolValue;
			Children = value.Children;
			DoubleValue = value.DoubleValue;
		}
		
		public Expression Clone()
		{
			return new Expression(this);
		}
		
		public Expression(string value)
		{
			Value = value;
		}
		
		public bool BoolValue;
		public bool ToBool()
		{
			ValueSet = true;
			BoolValue = Convert.ToBoolean (Value);
			Type = "bool";
			return BoolValue;
		}
		public void Set(bool value) {
			BoolValue = value;
			ValueSet = true;
			Type = "bool";
		}
		
		
		public double DoubleValue;
		public double ToDouble()
		{
			ValueSet = true;
			if (!String.IsNullOrEmpty (Value)) {
				double num;
				if (double.TryParse(Value, out num)) {
					DoubleValue = num;
				} else {
					DoubleValue = 0;
				}
				ValueSet = true;
			} else {
				DoubleValue = 0;
			}
			Type = "double";
			return DoubleValue;
		}
		public bool IsNumeric()
		{
			if (Type == "double" || DoubleValue > 0)
			{
				return true;
			}
			
			double num;
			if (double.TryParse(Value, out num))
			{
				ValueSet = true;
				Type = "double";
				return true;
			}
			
			return false;
		}
		public void Add(Expression value)
		{
			if (Type == null) {
				throw new Exception ("Type not set on left expression");
			} else if (value.Type == null) {
				throw new Exception ("Type not set on right expression");
			}
			value.ToDouble();
			DoubleValue += value.DoubleValue;
			Type = "double";
		}
		public void Set(double value) {
			DoubleValue = value;
			ValueSet = true;
			Type = "double";
		}
		
		
		public string ToString()
		{
			ValueSet = true;
			Type = "string";
			return Value;
		}
		public void Set(string value) {
			Value = value;
			ValueSet = true;
			Type = "string";
		}
		public void Concat(Expression value)
		{
			Value += value.Value;
			Type = "string";
		}
		
		
		
		
		public List<Expression> Children;
		public void Push(Expression value)
		{
			if (Children == null) {
				Children = new List<Expression>()
				{
					this
				};
			}
			
			Children.Add (value);
		}
	}
}

