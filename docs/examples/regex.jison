/*
Copyright 2015 Mathew Reny

Regular expression parser for Jison Yacc.
*/

%lex

%%



[a-zA-Z0-9]  return 'TERMINAL'
"|"          return '|'
"*"          return '*'
"+"          return '+'
"?"          return '?'
"("          return '('
")"          return ')'
<<EOF>>      return 'EOF'



/lex

%start prog

%% /* language grammar */

%{
var re = {
  union: function (a, b) {
    var u = {};
    u.op = "u";
    u.expanded = false;
    u.text = a.text + "|" + b.text;
    var ac = ("u" === a.op) ? a.children : [a];
    var bc = ("u" === b.op) ? b.children : [b];
    u.children = ac.concat(bc);
    return u;
  },
  cat: function (a, b) {
    var c = {};
    c.op = "c";
    c.expanded = false;
    c.text  = ("u" === a.op) ? "(" + a.text + ")" : a.text;
    c.text += ("u" === b.op) ? "(" + b.text + ")" : b.text;
    var ac = ("c" === a.op) ? a.children : [a];
    var bc = ("c" === b.op) ? b.children : [b];
    c.children = ac.concat(bc);
    return c;
  },
  star: function (a) {
    var s = {};
    s.op = "s";
    s.expanded = false;
    s.text = ("t" === a.op) ? a.text + "*" : "(" + a.text + ")*";
    s.children = [a];
    return s;
  },
  plus: function (a) {
    var p = {};
    p.op = "p";
    p.expanded = false;
    p.text = ("t" === a.op) ? a.text + "+" : "(" + a.text + ")+";
    p.children = [a];
    return p;
  },
  question: function (a) {
    var q = {};
    q.op = "q";
    q.expanded = false;
    q.text = ("t" === a.op) ? a.text + "?" : "(" + a.text + ")?";
    q.children = [a];
    return q;
  },
  terminal: function (text) {
    var t = {};
    t.op = "t";
    t.expanded = true;
    t.text = text;
    return t;
  }
};
%}



prog: /* empty */         { yyerror("empty");      }
|     expr1 EOF           { return $1;             }
;

expr1: expr2
|      expr1 '|' expr2    { $$ = re.union($1, $3); }
;

expr2: expr3
|      expr2 expr3        { $$ = re.cat($1, $2);   }
;

expr3: expr4
|      expr3 '*'          { $$ = re.star($1);      }
|      expr3 '+'          { $$ = re.plus($1);      }
|      expr3 '?'          { $$ = re.question($1);  }
;

expr4: TERMINAL           { $$ = re.terminal($1);  }
|      '(' expr1 ')'      { $$ = $2;               }
;

