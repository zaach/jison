using System;
using System.Collections.Generic;
using Jison;

namespace Sheet
{
	public class Expression : ParserValue
	{	
		public bool ValueSet = false;
		public string Type;
        public bool BoolValue;
        public double DoubleValue;
        public List<Expression> Children;

	    public Expression()
	    {
	    }
		
		public new Expression Clone()
		{
		    var expression = new Expression();
            expression.Text = Text;
		    if (Loc != null)
		    {
		        expression.Loc = Loc.Clone();
		    }
		    expression.Leng = Leng;
            expression.LineNo = LineNo;

		    expression.ValueSet = ValueSet;
		    expression.Type = Type;
            expression.ValueSet = ValueSet;
            expression.BoolValue = BoolValue;
		    
            if (Children != null)
		    {
		        expression.Children = new JList<Expression>();

		        foreach (var child in Children)
		        {
                    if (this != child)
                    {
                        expression.Children.Add(child.Clone());
                    }
		        }
		    }

		    expression.DoubleValue = DoubleValue;

		    return expression;
		}
		
		public Expression(string value)
		{
			Text = value;
		}
		
		public bool ToBool()
		{
			ValueSet = true;
			BoolValue = Convert.ToBoolean (Text);
			Type = "bool";
		    Text = BoolValue.ToString();
			return BoolValue;
		}
		public void Set(bool value) {
			BoolValue = value;
			ValueSet = true;
			Type = "bool";
		}
		
		public double ToDouble()
		{
		    if (Type == "double")
		    {
		        return DoubleValue;
		    }

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
		    Text = DoubleValue.ToString();
		}
		public void Set(double value) {
			DoubleValue = value;
		    Text = value.ToString();
			ValueSet = true;
			Type = "double";
		}
		
		public string ToString()
		{
			ValueSet = true;
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

