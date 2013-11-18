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
			Text = value.Text;
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
			Text = value;
		}
		
		public bool BoolValue;
		public bool ToBool()
		{
			ValueSet = true;
			BoolValue = Convert.ToBoolean (Text);
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
			if (!String.IsNullOrEmpty (Text) || DoubleValue != 0) {
				double num;
				if (double.TryParse(Text, out num)) {
					DoubleValue = num;
				} else {
					DoubleValue = (DoubleValue != 0 ? DoubleValue : 0);
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
			    Type = "double";
				return true;
			}
			
			double num;
			if (double.TryParse(Text, out num))
			{
				ValueSet = true;
				Type = "double";
				return true;
			}
			
			return false;
		}
		public void Add(Expression value)
		{
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
			return Text;
		}
		public void Set(string value) {
			Text = value;
			ValueSet = true;
			Type = "string";
		}
		public void Concat(Expression value)
		{
			Text += value.Text;
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

