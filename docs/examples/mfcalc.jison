/* example with simple error recovery from bison manual */



// %{
// #include <math.h>  /* For math functions, cos(), sin(), etc. */
// #include "calc.h"  /* Contains definition of `symrec'        */
// %}
// 
// %union {
// double     val;  /* For returning numbers.                   */
// symrec  *tptr;   /* For returning symbol-table pointers      */
// }

%token    NUM        /* Simple double precision number   */
%token   VAR FNCT   /* Variable and Function            */

%type     exp

%right '='
%left '-' '+'
%left '*' '/'
%left NEG     /* Negation--unary minus */
%right '^'    /* Exponentiation        */

/* Grammar follows */

%%

/*
 The above grammar introduces only two new features of the Bison language. 
 These features allow semantic values to have various data types 
 (see section More Than One Value Type).

The %union declaration specifies the entire list of possible types; this is instead of 
defining YYSTYPE. The allowable types are now double-floats (for exp and NUM) and 
pointers to entries in the symbol table. See section The Collection of Value Types.

Since values can now have various types, it is necessary to associate a type with 
each grammar symbol whose semantic value is used. These symbols are NUM, VAR, FNCT, 
and exp. Their declarations are augmented with information about their data type 
(placed between angle brackets).

The Bison construct %type is used for declaring nonterminal symbols, just as %token 
is used for declaring token types. We have not used %type before because nonterminal 
symbols are normally declared implicitly by the rules that define them. But exp must 
be declared explicitly so we can specify its value type. 
See section Nonterminal Symbols.

Grammar Rules for mfcalc

Here are the grammar rules for the multi-function calculator. Most of them are copied 
directly from calc; three rules, those which mention VAR or FNCT, are new.
*/

input:   /* empty */
        | input line
;

line:
          '\n'
        | exp '\n'   { printf ("\t%.10g\n", $1); }
        | error '\n' { yyerrok;                  }
;

exp:      NUM                { $$ = $1;                         }
        | VAR                { $$ = $1.value.var;               }
        | VAR '=' exp        { $$ = $3; $1.value.var = $3;      }
        | FNCT '(' exp ')'   { $$ = ($1.value.fnctptr)($3);    }
        | exp '+' exp        { $$ = $1 + $3;                    }
        | exp '-' exp        { $$ = $1 - $3;                    }
        | exp '*' exp        { $$ = $1 * $3;                    }
        | exp '/' exp        { $$ = $1 / $3;                    }
        | '-' exp  %prec NEG { $$ = -$2;                        }
        | exp '^' exp        { $$ = pow ($1, $3);               }
        | '(' exp ')'        { $$ = $2;                         }
;

/* End of grammar */


%%

/*

The mfcalc Symbol Table


The multi-function calculator requires a symbol table to keep track of the names 
and meanings of variables and functions. This doesn't affect the grammar rules 
(except for the actions) or the Bison declarations, but it requires some 
additional C functions for support.

The symbol table itself consists of a linked list of records. Its definition, 
which is kept in the header `calc.h', is as follows. It provides for either 
functions or variables to be placed in the table.
*/


// /* Data type for links in the chain of symbols.      */
// struct symrec
// {
//   char *name;  /* name of symbol                     */
//   int type;    /* type of symbol: either VAR or FNCT */
//   union {
//     double var;           /* value of a VAR          */
//     double (*fnctptr)();  /* value of a FNCT         */
//   } value;
//   struct symrec *next;    /* link field              */
// };
// 
// typedef struct symrec symrec;
// 
// /* The symbol table: a chain of `struct symrec'.     */
// extern symrec *sym_table;
// 
// symrec *putsym ();
// symrec *getsym ();
// 
//
// 
// The new version of main includes a call to init_table, a function that initializes 
// the symbol table. Here it is, and init_table as well:
// 
//
//
// #include <stdio.h>
// 
// main ()
// {
//   init_table ();
//   yyparse ();
// }
// 
// yyerror (s)  /* Called by yyparse on error */
//      char *s;
// {
//   printf ("%s\n", s);
// }
// 
// struct init
// {
//   char *fname;
//   double (*fnct)();
// };
// 
// struct init arith_fncts[]
//   = {
//       "sin", sin,
//       "cos", cos,
//       "atan", atan,
//       "ln", log,
//       "exp", exp,
//       "sqrt", sqrt,
//       0, 0
//     };
// 
// /* The symbol table: a chain of `struct symrec'.  */
// symrec *sym_table = (symrec *)0;
// 
// init_table ()  /* puts arithmetic functions in table. */
// {
//   int i;
//   symrec *ptr;
//   for (i = 0; arith_fncts[i].fname != 0; i++)
//     {
//       ptr = putsym (arith_fncts[i].fname, FNCT);
//       ptr->value.fnctptr = arith_fncts[i].fnct;
//     }
// }
// 
// 
// 
// By simply editing the initialization list and adding the necessary include files, 
// you can add additional functions to the calculator.
// 
// Two important functions allow look-up and installation of symbols in the symbol table. 
// The function putsym is passed a name and the type (VAR or FNCT) of the object 
// to be installed. The object is linked to the front of the list, and a pointer 
// to the object is returned. The function getsym is passed the name of the symbol 
// to look up. If found, a pointer to that symbol is returned; otherwise zero is returned.
// 
// 
// 
// symrec *
// putsym (sym_name,sym_type)
//      char *sym_name;
//      int sym_type;
// {
//   symrec *ptr;
//   ptr = (symrec *) malloc (sizeof (symrec));
//   ptr->name = (char *) malloc (strlen (sym_name) + 1);
//   strcpy (ptr->name,sym_name);
//   ptr->type = sym_type;
//   ptr->value.var = 0; /* set value to 0 even if fctn.  */
//   ptr->next = (struct symrec *)sym_table;
//   sym_table = ptr;
//   return ptr;
// }
// 
// symrec *
// getsym (sym_name)
//      char *sym_name;
// {
//   symrec *ptr;
//   for (ptr = sym_table; ptr != (symrec *) 0;
//        ptr = (symrec *)ptr->next)
//     if (strcmp (ptr->name,sym_name) == 0)
//       return ptr;
//   return 0;
// }
// 
// 
// 
// 
// The function yylex must now recognize variables, numeric values, and the 
// single-character arithmetic operators. Strings of alphanumeric characters with 
// a leading nondigit are recognized as either variables or functions depending 
// on what the symbol table says about them.
// 
// The string is passed to getsym for look up in the symbol table. If the name 
// appears in the table, a pointer to its location and its type (VAR or FNCT) is 
// returned to yyparse. If it is not already in the table, then it is installed 
// as a VAR using putsym. Again, a pointer and its type (which must be VAR) is 
// returned to yyparse.
// 
// No change is needed in the handling of numeric values and arithmetic operators 
// in yylex.
// 
// 
// 
// 
// #include <ctype.h>
// yylex ()
// {
//   int c;
// 
//   /* Ignore whitespace, get first nonwhite character.  */
//   while ((c = getchar ()) == ' ' || c == '\t');
// 
//   if (c == EOF)
//     return 0;
// 
//   /* Char starts a number => parse the number.         */
//   if (c == '.' || isdigit (c))
//     {
//       ungetc (c, stdin);
//       scanf ("%lf", &yylval.val);
//       return NUM;
//     }
// 
//   /* Char starts an identifier => read the name.       */
//   if (isalpha (c))
//     {
//       symrec *s;
//       static char *symbuf = 0;
//       static int length = 0;
//       int i;
// 
//       /* Initially make the buffer long enough
//          for a 40-character symbol name.  */
//       if (length == 0)
//         length = 40, symbuf = (char *)malloc (length + 1);
// 
//       i = 0;
//       do
//         {
//           /* If buffer is full, make it bigger.        */
//           if (i == length)
//             {
//               length *= 2;
//               symbuf = (char *)realloc (symbuf, length + 1);
//             }
//           /* Add this character to the buffer.         */
//           symbuf[i++] = c;
//           /* Get another character.                    */
//           c = getchar ();
//         }
//       while (c != EOF && isalnum (c));
// 
//       ungetc (c, stdin);
//       symbuf[i] = '\0';
// 
//       s = getsym (symbuf);
//       if (s == 0)
//         s = putsym (symbuf, VAR);
//       yylval.tptr = s;
//       return s->type;
//     }
// 
//   /* Any other character is a token by itself.        */
//   return c;
// }
// 
// 
// 
// 
// This program is both powerful and flexible. You may easily add new functions, 
// and it is a simple job to modify this code to install predefined variables 
// such as pi or e as well.
// 
// 
// 
// Exercises
// 
// 
// - Add some new functions from `math.h' to the initialization list.
// - Add another array that contains constants and their values. Then modify 
//   init_table to add these constants to the symbol table. It will be easiest 
//   to give the constants type VAR.
// - Make the program report an error if the user refers to an uninitialized 
//   variable in any way except to store a value in it.
// - Go to the first, previous, next, last section, table of contents.
// 
//
 
