/*
   Copyright (C) 2001-2012, 2014-2017 Free Software Foundation, Inc.
   Written by Keisuke Nishida, Roger While, Simon Sobisch, Edwart Hart

   This file is part of GnuCOBOL.

   The GnuCOBOL compiler is free software: you can redistribute it
   and/or modify it under the terms of the GNU General Public License
   as published by the Free Software Foundation, either version 3 of the
   License, or (at your option) any later version.

   GnuCOBOL is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with GnuCOBOL.  If not, see <http://www.gnu.org/licenses/>.
*/


%option 8bit
%option case-insensitive
%option never-interactive
%option nodefault

%option noyy_scan_buffer
%option noyy_scan_bytes
%option noyy_scan_string

%option noyyget_extra
%option noyyset_extra
%option noyyget_leng
%option noyyget_text
%option noyyget_lineno
%option noyyset_lineno
%option noyyget_in
%option noyyset_in
%option noyyget_out
%option noyyset_out
%option noyyget_lval
%option noyyset_lval
%option noyyget_lloc
%option noyyset_lloc
%option noyyget_debug
%option noyyset_debug
%{

#undef	YY_READ_BUF_SIZE
#define	YY_READ_BUF_SIZE	32768
#undef	YY_BUF_SIZE
#define	YY_BUF_SIZE		32768

#define	YY_SKIP_YYWRAP
static int yywrap (void) {
    return 1;
}

#define YY_INPUT(buf,result,max_size)				\
	{							\
		if (fgets (buf, (int)max_size, yyin) == NULL) { \
			result = YY_NULL;			\
		} else {					\
			result = strlen (buf);			\
		}						\
	}

#define	YY_USER_INIT						\
	if (!plexbuff) {					\
		plexsize = COB_MINI_BUFF;			\
		plexbuff = cobc_malloc (plexsize);		\
	}							\
	if (!picbuff1) {					\
		pic1size = COB_MINI_BUFF;			\
		picbuff1 = cobc_malloc (pic1size);		\
	}							\
	if (!picbuff2) {					\
		pic2size = COB_MINI_BUFF;			\
		picbuff2 = cobc_malloc (pic2size);		\
	}

#include "config.h"

#include <ctype.h>
#include <limits.h>

#ifdef	HAVE_UNISTD_H
#include <unistd.h>
#else
#define	YY_NO_UNISTD_H	1
#endif

#define	COB_IN_SCANNER	1
#include "cobc.h"
#include "tree.h"

/* ignore unused functions here as flex generates unused ones */
#ifdef	__GNUC__
#if	defined (__clang__) || __GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 4)
#pragma GCC diagnostic ignored "-Wunused-function"
#endif
#endif

#define YYSTYPE			cb_tree
#include "parser.h"

#define RETURN_TOK(expr)			\
	do {					\
		last_yylval = yylval;		\
		last_token = (expr);		\
		return last_token;		\
	} ONCE_COB

/* CONSTANT (78 level) structure */
struct cb_level_78 {
	struct cb_level_78	*next;		/* Next in chain */
	struct cb_level_78	*globnext;	/* Continued next in chain */
	struct cb_level_78	*last;		/* Last in chain */
	struct cb_field		*fld78;		/* Pointer to field */
	struct cb_program	*prog;		/* Program where defined */
	cob_u32_t		name_len;	/* Length of name */
	cob_u32_t		not_const;	/* Invalid usage check */
	cob_u32_t		chk_const;	/* Check global level use */
};

struct cb_top_level_78 {
	struct cb_top_level_78	*next;
	struct cb_level_78	*lev78ptr;
};

/* Local variables */
static cb_tree			last_yylval;
static int			last_token;
static struct cb_level_78	*top78ptr = NULL;
static struct cb_level_78	*const78ptr = NULL;
static struct cb_level_78	*lev78ptr = NULL;
static struct cb_level_78	*globlev78ptr = NULL;
static char			*plexbuff = NULL;
static char			*picbuff1 = NULL;
static char			*picbuff2 = NULL;
static size_t			plexsize;
static size_t			pic1size;
static size_t			pic2size;
static unsigned int		last_token_is_dot = 0;
static unsigned int		integer_is_label = 0;
static unsigned int		inside_bracket = 0;
static unsigned int		literal_error;
static char			err_msg[COB_MINI_BUFF];

/* Function declarations */
static void	read_literal (const char, const char *);
static int	scan_x (const char *, const char *);
static int	scan_z (const char *, const char *);
static int	scan_h (const char *, const char *);
static int	scan_b (const char *, const char *);
static int	scan_o (const char *, const char *);
static int	scan_numeric (const char *);
static int	scan_floating_numeric (const char *);
static void	scan_picture (const char *);
static void	count_lines (const char *);
static void	scan_define_options (const char *);
static void	scan_options (const char *, const unsigned int);

%}

%s DECIMAL_IS_PERIOD DECIMAL_IS_COMMA
%x PICTURE_STATE FUNCTION_STATE

%%

%{
	if (likely (current_program)) {
		if (current_program->decimal_point == '.') {
			BEGIN DECIMAL_IS_PERIOD;
		} else {
			BEGIN DECIMAL_IS_COMMA;
		}
	}

	if (cobc_repeat_last_token) {
		cobc_repeat_last_token = 0;
		yylval = last_yylval;
	        return last_token;
	}

	/* We treat integer literals immediately after '.' as labels;
	   that is, they must be level numbers or section names. */
	if (last_token_is_dot) {
		integer_is_label = 1;
		last_token_is_dot = 0;
	} else {
		integer_is_label = 0;
	}
%}


<*>^[ ]?"#DEFLIT".*\n {
	scan_define_options (yytext);
}

<*>^[ ]?"#OPTION".*\n {
	scan_options (yytext, 1);
}

<*>^[ ]?"#DEFOFF".*\n {
	scan_options (yytext, 2);
}

<*>^[ ]?"#DEFENV".*\n {
	scan_options (yytext, 3);
}

<*>\n {
	cb_source_line++;
}

^"#LINE"[ ]?[0-9]+" ".* {
	/* Line directive */
	char		*p1;
	char		*p2;

	p1 = strchr (yytext, '"');
	if (p1) {
		p2 = cobc_strdup (p1 + 1);
		p1 = strrchr (p2, '"');
		if (p1) {
			*p1 = 0;
			cb_source_file = cobc_parse_strdup (p2);
			cb_source_line = (int)strtol (yytext + 5, NULL, 10) - 1;
		}
		cobc_free (p2);
	}
}

^"#".* {
	/* Ignore */
}

"PIC" |
"PICTURE" {
	BEGIN PICTURE_STATE;
}

"FUNCTION" {
	if (cobc_in_repository || cobc_cs_check == CB_CS_EXIT) {
		yylval = NULL;
	        RETURN_TOK (FUNCTION);
	}
	BEGIN FUNCTION_STATE;
}

[\'\"] {
	/* String literal */
	cobc_force_literal = 0;
	read_literal (yytext[0], "");
	RETURN_TOK (LITERAL);
}

X\'[^\'\n]*\' |
X\"[^\"\n]*\" {
	/* X string literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_x (yytext + 2, "X"));
}

N[\'\"] {
	/* N national string literal */
	cobc_force_literal = 0;
	/* TODO: national string - needs different handling */
	read_literal (yytext [1], "N");
	RETURN_TOK (LITERAL);
}

NX\'[^\'\n]*\' |
NX\"[^\"\n]*\" {
	/* NX string literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_x (yytext + 3, "NX"));
}

Z\'[^\'\n]*\' |
Z\"[^\"\n]*\" {
	/* Z string literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_z (yytext + 2, "Z"));
}

L\'[^\'\n]*\' |
L\"[^\"\n]*\" {
	/* L string literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_z (yytext + 2, "L"));
}

H\'[^\'\n]*\' |
H\"[^\"\n]*\" {
	/* H hexdecimal/numeric literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_h (yytext + 2, "H"));
}

B\'[^\'\n]*\' |
B\"[^\"\n]*\" {
	/* B boolean/numeric literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_b (yytext + 2, "B"));
}

BX\'[^\'\n]*\' |
BX\"[^\"\n]*\" {
	/* BX boolean hexadecimal string literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_x (yytext + 3, "BX"));
}

B#[0-9]* {
	/*
	  To avoid subtle silent errors, such as B#021, this rule (and the ones
	  following) here admit some invalid literals which emit errors when
	  they are processed.
	*/
	/* ACUCOBOL binary numeric literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_b (yytext + 2, "B#"));
}

O#[0-9]* {
	/* ACUCOBOL octal numeric literal */
	cobc_force_literal = 0;
	RETURN_TOK (scan_o (yytext + 2, "O#"));
}

X#[0-9A-Za-z]* |
H#[0-9A-Za-z]* {
	/* ACUCOBOL hexadecimal numeric literal */
	char type[3] = "x#";
	type[0] = yytext [0];
	cobc_force_literal = 0;
	RETURN_TOK (scan_h (yytext + 2, type));
}

\( {
	inside_bracket++;
	RETURN_TOK (TOK_OPEN_PAREN);
}

\) {
	if (inside_bracket > 0) {
		inside_bracket--;
	}
	RETURN_TOK (TOK_CLOSE_PAREN);
}

[0-9]+ {
	cobc_force_literal = 0;
	if (integer_is_label) {
		yylval = cb_build_reference (yytext);
		if (!cobc_in_procedure) {
			if (!strcmp (yytext, "66")) {
				/* Level number 66 */
				RETURN_TOK (SIXTY_SIX);
			} else if (!strcmp (yytext, "78")) {
				/* Level number 78 */
				RETURN_TOK (SEVENTY_EIGHT);
			} else if (!strcmp (yytext, "88")) {
				/* Level number 88 */
				RETURN_TOK (EIGHTY_EIGHT);
			}
		}

		/* Integer label or level number */
		RETURN_TOK (WORD);
	}
	/* Numeric literal or referenced integer label
	remark: all transformations/checks are postponed:
	literals to tree.c,
	integer label to typeck.c (cb_build_section_name)
	*/
	yylval = cb_build_numeric_literal (0, yytext, 0);
	RETURN_TOK (LITERAL);
}

[+-][0-9]+ {
	/* Numeric literal (signed) */
	RETURN_TOK (scan_numeric (yytext));
}

<*>[ ]+ {
	/* Ignore */
}

<*>;+ {
	if (inside_bracket) {
		RETURN_TOK (SEMI_COLON);
	}
	/* Ignore */
}

<DECIMAL_IS_PERIOD>[+-]?[0-9]*\.[0-9]+E[+-]?[0-9]+ {
	/* Numeric floating point literal */
	RETURN_TOK (scan_floating_numeric (yytext));
}

<DECIMAL_IS_PERIOD>[+-]?[0-9]*\.[0-9]+E[+-]?[0-9]*\.[0-9]+ {
	/* Invalid numeric floating point literal */
	RETURN_TOK (scan_floating_numeric (yytext));
}

<DECIMAL_IS_PERIOD>[+-]?[0-9]*\.[0-9]+ {
	/* Numeric literal */
	RETURN_TOK (scan_numeric (yytext));
}

<DECIMAL_IS_PERIOD>,+ {
	if (inside_bracket) {
		RETURN_TOK (COMMA_DELIM);
	}
	/* Ignore */
}

<DECIMAL_IS_COMMA>[+-]?[0-9]*,[0-9]+E[+-]?[0-9]+ {
	/* Numeric floating point literal */
	RETURN_TOK (scan_floating_numeric (yytext));
}

<DECIMAL_IS_COMMA>[+-]?[0-9]*,[0-9]+E[+-]?[0-9]*,[0-9]+ {
	/* Invalid numeric floating point literal */
	RETURN_TOK (scan_floating_numeric (yytext));
}

<DECIMAL_IS_COMMA>[+-]?[0-9]*,[0-9]+ {
	/* Numeric literal */
	RETURN_TOK (scan_numeric (yytext));
}

<DECIMAL_IS_COMMA>,{2,} {
	unput (',');
}

<DECIMAL_IS_COMMA>, {
	if (inside_bracket) {
		RETURN_TOK (COMMA_DELIM);
	}
	/* Ignore */
}

"END"[ ,;\n]+"PROGRAM" {
	cobc_force_literal = 1;
	count_lines (yytext);
	RETURN_TOK (END_PROGRAM);
}

"END"[ ,;\n]+"FUNCTION" {
	cobc_force_literal = 1;
	count_lines (yytext);
	RETURN_TOK (END_FUNCTION);
}

"PICTURE"[ ,;\n]+"SYMBOL" {
	count_lines (yytext);
	RETURN_TOK (PICTURE_SYMBOL);
}

"FROM"[ ,;\n]+"CRT" {
	count_lines (yytext);
	RETURN_TOK (FROM_CRT);
}

"SCREEN"[ ,;\n]+"CONTROL" {
	count_lines (yytext);
	RETURN_TOK (SCREEN_CONTROL);
}

"EVENT"[ ,;\n]+"STATUS" {
	count_lines (yytext);
	RETURN_TOK (EVENT_STATUS);
}

"READY"[ ,;\n]+"TRACE" {
	count_lines (yytext);
	RETURN_TOK (READY_TRACE);
}

"RESET"[ ,;\n]+"TRACE" {
	count_lines (yytext);
	RETURN_TOK (RESET_TRACE);
}

"GREATER"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n]+"TO"[ ,;\n] |
"GREATER"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n] |
"GREATER"[ ,;\n]+"THAN"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n]+"TO"[ ,;\n] |
"GREATER"[ ,;\n]+"THAN"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (GREATER_OR_EQUAL);
}

"GREATER"[ ,;\n]+"THAN"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (GREATER);
}

"LESS"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n]+"TO"[ ,;\n] |
"LESS"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n] |
"LESS"[ ,;\n]+"THAN"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n]+"TO"[ ,;\n] |
"LESS"[ ,;\n]+"THAN"[ ,;\n]+"OR"[ ,;\n]+"EQUAL"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (LESS_OR_EQUAL);
}

"LESS"[ ,;\n]+"THAN"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (LESS);
}

"EQUAL"[ ,;\n]+"TO"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EQUAL);
}

"THEN"[ ,;\n]+"REPLACING"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (REPLACING);
}

"LINES"[ ,;\n]+"AT"[ ,;\n]+"TOP"[ ,;\n] |
"LINES"[ ,;\n]+"TOP"[ ,;\n] |
"AT"[ ,;\n]+"TOP"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (TOP);
}

"LINES"[ ,;\n]+"AT"[ ,;\n]+"BOTTOM"[ ,;\n] |
"LINES"[ ,;\n]+"BOTTOM"[ ,;\n] |
"AT"[ ,;\n]+"BOTTOM"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (BOTTOM);
}

"WITH"[ ,;\n]+"NO"[ ,;\n]+"ADVANCING" |
"NO"[ ,;\n]+"ADVANCING" {
	count_lines (yytext);
	RETURN_TOK (NO_ADVANCING);
}

"ON"[ ,;\n]+"NEXT"[ ,;\n]+"PAGE"[ ,;\n] |
"NEXT"[ ,;\n]+"PAGE"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NEXT_PAGE);
}

"NOT"[ ,;\n]+"ON"[ ,;\n]+"SIZE"[ ,;\n]+"ERROR"[ ,;\n] |
"NOT"[ ,;\n]+"SIZE"[ ,;\n]+"ERROR"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_SIZE_ERROR);
}

"ON"[ ,;\n]+"SIZE"[ ,;\n]+"ERROR"[ ,;\n] |
"SIZE"[ ,;\n]+"ERROR"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (SIZE_ERROR);
}

"NOT"[ ,;\n]+"ON"[ ,;\n]+"ESCAPE"[ ,;\n] |
"NOT"[ ,;\n]+"ESCAPE"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_ESCAPE);
}

"NOT"[ ,;\n]+"ON"[ ,;\n]+"EXCEPTION"[ ,;\n] |
"NOT"[ ,;\n]+"EXCEPTION"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_EXCEPTION);
}

"ON"[ ,;\n]+"ESCAPE"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (ESCAPE);
}

"ON"[ ,;\n]+"EXCEPTION"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EXCEPTION);
}

"NOT"[ ,;\n]+"ON"[ ,;\n]+"OVERFLOW"[ ,;\n] |
"NOT"[ ,;\n]+"OVERFLOW"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_OVERFLOW);
}

"NOT"[ ,;\n]+"AT"[ ,;\n]+"END"[ ,;\n] |
"NOT"[ ,;\n]+"END"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_END);
}

"AT"[ ,;\n]+"END"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (END);
}

"ON"[ ,;\n]+"OVERFLOW"[ ,;\n] |
"OVERFLOW"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (TOK_OVERFLOW);
}

"NOT"[ ,;\n]+"AT"[ ,;\n]+"END-OF-PAGE"[ ,;\n] |
"NOT"[ ,;\n]+"AT"[ ,;\n]+"EOP"[ ,;\n] |
"NOT"[ ,;\n]+"END-OF-PAGE"[ ,;\n] |
"NOT"[ ,;\n]+"EOP"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_EOP);
}

"AT"[ ,;\n]+"END-OF-PAGE"[ ,;\n] |
"AT"[ ,;\n]+"EOP"[ ,;\n] |
"END-OF-PAGE"[ ,;\n] |
"EOP"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EOP);
}

"NOT"[ ,;\n]+"INVALID"[ ,;\n]+"KEY"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_INVALID_KEY);
}

"NOT"[ ,;\n]+"INVALID"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NOT_INVALID_KEY);
}

"INVALID"[ ,;\n]+"KEY"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (INVALID_KEY);
}

"INVALID"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (INVALID_KEY);
}

"NO"[ ,;\n]+"DATA"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (NO_DATA);
}

"WITH"[ ,;\n]+"DATA"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (DATA);
}

"UPON"[ ,;\n]+"ENVIRONMENT-NAME" {
	count_lines (yytext);
	RETURN_TOK (UPON_ENVIRONMENT_NAME);
}

"UPON"[ ,;\n]+"ENVIRONMENT-VALUE" {
	count_lines (yytext);
	RETURN_TOK (UPON_ENVIRONMENT_VALUE);
}

"UPON"[ ,;\n]+"ARGUMENT-NUMBER" {
	count_lines (yytext);
	RETURN_TOK (UPON_ARGUMENT_NUMBER);
}

"UPON"[ ,;\n]+"COMMAND-LINE" {
	count_lines (yytext);
	RETURN_TOK (UPON_COMMAND_LINE);
}

"AFTER"[ ,;\n]+"EXCEPTION"[ ,;\n]+"CONDITION"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EXCEPTION_CONDITION);
}

"EXCEPTION"[ ,;\n]+"CONDITION"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EXCEPTION_CONDITION);
}

"AFTER"[ ,;\n]+"EC"[ ,;\n] {
	count_lines (yytext);
	RETURN_TOK (EC);
}

"LENGTH"[ ,;\n]+"OF"[ ,;\n] {
	count_lines (yytext);
	/* FIXME: check with "lookup_register ("LENGTH OF") != NULL"
	          if we actually want to do this,
			  otherwise return 2 (!) WORD tokens (by adding a que
			  of tokens to be returned)
	*/
	RETURN_TOK (LENGTH_OF);
}

"SWITCH"[ ]+([0-9][0-9]?|[A-Z])[ ,;\n] {
	/* ACUCOBOL extension: switch-names with space and with letter */
	char suffix[3] = "";
	char name[10] = "";

	unput (yytext[yyleng-1]); /* unput seperator */
	/* FIXME: move the code for filling "name" here and first
	          check with "lookup_system_name (name) != NULL"
	          if we actually want to do this,
			  otherwise return 2 (!) WORD tokens (by adding a que
			  of tokens to be returned)
	*/
	if (cobc_in_procedure) {
		 /* unput characters */
		yylval = cb_build_reference ("SWITCH");
		if (isdigit((unsigned char)yytext[yyleng-3])) {
			unput (yytext[yyleng-2]);
			unput (yytext[yyleng-3]);
		} else {
			unput (yytext[yyleng-2]);
		}
	} else {
		 /* we need to return a single word, reverted later in parser.y */
		if (yytext[yyleng-3] == ' ' && isdigit((unsigned char)yytext[yyleng-2])) {
			/* SWITCH 0  to SWITCH 9 */
			suffix[0] = yytext[yyleng-2];
		} else if (isdigit((unsigned char)yytext[yyleng-3])) {
			/* SWITCH 00 to SWITCH 99 */
			suffix[0] = yytext[yyleng-3];
			suffix[1] = yytext[yyleng-2];
		} else {
			suffix[0] = yytext[yyleng-2];
		}
		strncpy(name, yytext, 6);
		strcat(name, "_");
		strcat(name, suffix);
		yylval = cb_build_reference (name);
	}
	RETURN_TOK (WORD);
}

[A-Z0-9\x80-\xFF]([_A-Z0-9\x80-\xFF-]*[A-Z0-9\x80-\xFF]+)? {
	struct cb_level_78		*p78;
	struct cb_intrinsic_table	*cbp;
	struct cobc_reserved		*resptr;
	struct cb_text_list		*tlp;
	cb_tree				x;
	cb_tree				l;
	struct cb_program		*program;

	cb_check_word_length ((unsigned int)yyleng, yytext);

	/* Check Intrinsic FUNCTION name without keyword */
	if ((cobc_in_procedure && (functions_are_all || cb_intrinsic_list ||
	     current_program->function_spec_list)) || cobc_in_repository) {
		cbp = lookup_intrinsic (yytext, 0);
		if (cbp) {
			if (cobc_in_repository) {
				yylval = cb_build_alphanumeric_literal (yytext, (size_t)yyleng);
				RETURN_TOK (FUNCTION_NAME);
			}
			if (functions_are_all) {
				yylval = cb_build_reference (yytext);
				RETURN_TOK ((enum yytokentype)(cbp->token));
			}
			for (tlp = cb_intrinsic_list; tlp; tlp = tlp->next) {
				if (!strcasecmp (yytext, tlp->text)) {
					yylval = cb_build_reference (yytext);
					RETURN_TOK ((enum yytokentype)(cbp->token));
				}
			}
			l = current_program->function_spec_list;
			for (; l; l = CB_CHAIN(l)) {
				x = CB_VALUE (l);
				if (!strcasecmp (yytext,
						 (char *)(CB_LITERAL(x)->data))) {
					yylval = cb_build_reference (yytext);
					RETURN_TOK ((enum yytokentype)(cbp->token));
				}
			}
		}
	}

	/* Bail early for (END) PROGRAM-ID when not a literal */
	if (unlikely (cobc_force_literal)) {
		/* Force PROGRAM-ID / END PROGRAM */
		cobc_force_literal = 0;
		if (cb_fold_call) {
			yylval = cb_build_reference (yytext);
			RETURN_TOK (PROGRAM_NAME);
		} else {
			yylval = cb_build_alphanumeric_literal (yytext, (size_t)yyleng);
			RETURN_TOK (LITERAL);
		}
	}

	/* Check reserved word */
	resptr = lookup_reserved_word (yytext);
	if (resptr != NULL) {
		if (resptr->nodegen) {
			/* Save location for terminator checking */
			/* Misuse comment tree to mark statement */
			yylval = cb_build_comment (NULL);
		} else {
			yylval = NULL;
		}
		RETURN_TOK (resptr->token);
	}

	/* New user-defined word in REPOSITORY entry */
	if (cobc_in_repository) {
		yylval = cb_build_reference (yytext);
		RETURN_TOK (WORD);
	}

	/* Direct recursive reference in function */
	if (current_program->prog_type == CB_FUNCTION_TYPE
		   && !functions_are_all
		   && !strcasecmp (yytext, current_program->orig_program_id)) {
		yylval = cb_build_reference (yytext);
		RETURN_TOK (USER_FUNCTION_NAME);
	}

	/* Check prototype names */
	for (l = current_program->user_spec_list; l; l = CB_CHAIN (l)) {
		x = CB_VALUE (l);
		if (!strcasecmp (yytext, CB_PROTOTYPE (x)->name)) {
			yylval = cb_build_reference (yytext);
			RETURN_TOK (USER_FUNCTION_NAME);
		}
	}
	if (cobc_allow_program_name) {
		for (l = current_program->program_spec_list; l; l = CB_CHAIN (l)) {
			x = CB_VALUE (l);
			if (!strcasecmp (yytext, CB_PROTOTYPE (x)->name)) {
				yylval = cb_build_reference (yytext);
				RETURN_TOK (PROGRAM_NAME);
			}
		}
	}

	/* Check user programs */
	if (cobc_in_id) {
		program = cb_find_defined_program_by_name (yytext);
		if (program) {
			yylval = cb_build_reference (yytext);
			RETURN_TOK (PROGRAM_NAME);
		}
	}

	/* User word */

	/* Check local, global and source global CONSTANT (78) items */

	for (p78 = top78ptr; p78; p78 = p78->globnext) {
		if (strcasecmp (yytext, p78->fld78->name) == 0) {
			if (unlikely (non_const_word)) {
				if (p78->prog == current_program) {
					cb_error (_("a constant may not be used here - '%s'"), yytext);
					yylval = cb_error_node;
					RETURN_TOK (WORD);
				}
				if (p78->chk_const) {
					p78->not_const = 1;
				}
				break;
			}
			if (p78->chk_const && p78->not_const) {
				break;
			}
			yylval = CB_VALUE (p78->fld78->values);
			RETURN_TOK (LITERAL);
		}
	}

	yylval = cb_build_reference (yytext);

	/* Special name handling */
	if (CB_WORD_COUNT (yylval) > 0 && CB_WORD_ITEMS (yylval)) {
		x = CB_VALUE (CB_WORD_ITEMS (yylval));
		if (CB_SYSTEM_NAME_P (x)) {
			RETURN_TOK (MNEMONIC_NAME);
		} else if (CB_CLASS_NAME_P (x)) {
			RETURN_TOK (CLASS_NAME);
		}
	}

	RETURN_TOK (WORD);
}

"<=" {
	yylval = NULL;
	RETURN_TOK (LESS_OR_EQUAL);
}

">=" {
	yylval = NULL;
	RETURN_TOK (GREATER_OR_EQUAL);
}

"<>" {
	yylval = NULL;
	RETURN_TOK (NOT_EQUAL);
}

"**" {
	yylval = NULL;
	RETURN_TOK (EXPONENTIATION);
}

"."([ \n]*".")* {
	if (last_token_is_dot || strlen (yytext) > 1) {
		cb_warning (COBC_WARN_FILLER, _("ignoring redundant ."));
	}

	if (!last_token_is_dot) {
		last_token_is_dot = 1;
		yylval = NULL;
		RETURN_TOK (TOK_DOT);
	}
}

"&" {
	yylval = NULL;
	RETURN_TOK (TOK_AMPER);
}

":" {
	yylval = NULL;
	RETURN_TOK (TOK_COLON);
}

"=" {
	yylval = NULL;
	RETURN_TOK (TOK_EQUAL);
}

"/" {
	yylval = NULL;
	RETURN_TOK (TOK_DIV);
}

"*" {
	yylval = NULL;
	RETURN_TOK (TOK_MUL);
}

"+" {
	yylval = NULL;
	RETURN_TOK (TOK_PLUS);
}

"-" {
	yylval = NULL;
	RETURN_TOK (TOK_MINUS);
}

"<" {
	yylval = NULL;
	RETURN_TOK (TOK_LESS);
}

">" {
	yylval = NULL;
	RETURN_TOK (TOK_GREATER);
}

. {
	int	c;

	cb_error (_("invalid symbol '%s' - skipping word"), yytext);
	while ((c = input ()) != EOF) {
		if (c == '\n' || c == ' ') {
			break;
		}
	}
	if (c != EOF) {
		unput (c);
	}
}


<PICTURE_STATE>{
  "IS" {
	/* Ignore */
  }
  [^ \n;]+ {
	BEGIN INITIAL;
	scan_picture (yytext);
	RETURN_TOK (PICTURE);
  }
}

<FUNCTION_STATE>{
  [A-Z0-9-]+ {
	struct cb_intrinsic_table	*cbp;
	cb_tree				l;
	cb_tree				x;

	BEGIN INITIAL;
	yylval = cb_build_reference (yytext);
	for (l = current_program->user_spec_list; l; l = CB_CHAIN(l)) {
		x = CB_VALUE (l);
		if (!strcasecmp (yytext, CB_PROTOTYPE (x)->name)) {
			RETURN_TOK (USER_FUNCTION_NAME);
		}
	}
	cbp = lookup_intrinsic (yytext, 0);
	if (cbp) {
		RETURN_TOK ((enum yytokentype)(cbp->token));
	}
	RETURN_TOK (FUNCTION_NAME);
  }
  . {
	yylval = NULL;
	RETURN_TOK (yytext[0]);
  }
}

<<EOF>> {
	struct cb_level_78	*p78;
	struct cb_level_78	*p782;

	/* At EOF - Clear variables */
	for (p78 = lev78ptr; p78; ) {
		p782 = p78->next;
		cobc_free (p78);
		p78 = p782;
	}
	for (p78 = globlev78ptr; p78; ) {
		p782 = p78->next;
		cobc_free (p78);
		p78 = p782;
	}
	for (p78 = const78ptr; p78; ) {
		p782 = p78->next;
		cobc_free (p78);
		p78 = p782;
	}
	top78ptr = NULL;
	last_token_is_dot = 0;
	integer_is_label = 0;
	inside_bracket = 0;
	lev78ptr = NULL;
	globlev78ptr = NULL;
	cobc_force_literal = 0;
	yyterminate ();
}

%%

static void
error_literal (const char *type, const char *literal)
{
	char		lit_out[39];

	if (!literal_error) {
#if 0 /* national literal, check for different truncation and wcslen
		 or not show it at all */
		if (strcmp (type, "national") == 0) {
			cb_error (_("invalid national literal"), lit_out);
		} else {
#endif
		/* snip literal for output, if too long */
			strncpy (lit_out, literal, 38);
			if (strlen (literal) > 38) {
				strcpy (lit_out + 35, "...");
			} else {
				lit_out[38] = '\0';
			}
			if (strcmp (type, "") == 0) {
				cb_error (_("invalid literal: '%s'"), lit_out);
			} else if (strcmp (type, "hex") == 0) {
				cb_error (_("invalid hexadecimal literal: '%s'"), lit_out);
			} else if (strcmp (type, "num") == 0) {
				cb_error (_("invalid numeric literal: '%s'"), lit_out);
			} else if (strcmp (type, "float") == 0) {
				cb_error (_("invalid floating-point literal: '%s'"), lit_out);
			} else {
				cb_error (_("invalid %s literal: '%s'"), type, lit_out);
			}
#if 0 /* national literal */
		}
#endif
	}
	literal_error++;
	cb_error ("%s", err_msg);
}

static void
read_literal (const char mark, const char *type)
{
	size_t		i;
	int		c;

	literal_error = 0;

	i = 0;
	/* read until a not-escaped mark is found (see break)
	   or (unliky) we reach EOF */
	/* NO early exit possible as the literal has to be consumed */
	while ((c = input ()) != EOF) {
		if (!literal_error) {
			if (unlikely (i == plexsize)) {
				plexsize *= 2;
				if (unlikely (plexsize > (cb_lit_length + 1))) {
					plexsize = cb_lit_length + 1;
				}
				plexbuff = cobc_realloc (plexbuff, plexsize);
			}
			plexbuff[i] = (cob_u8_t)c;
		}
		if (c == mark && (c = input ()) != (int)mark) {
			if (c == '-') {
				/* Free format continuation ("a"- 'b'- ) */
				/* Hack it as concatenation */
				unput ('&');
			} else {
				unput (c);
			}
			break;
		}
		/* check literal size here as we have to adjust and check
		   for (escaped) mark before checking the max length */
		if (unlikely (i++ == cb_lit_length)) {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal length exceeds %d characters"),
				cb_lit_length);
			plexbuff[cb_lit_length] = 0; /* ensure valid C-string for error message */
			error_literal ("", plexbuff);
		}
	}
	/* FIXME: COBOL 2014 allows this (and needs it for DYNAMIC LENGTH items),
	   while other versions do not allow this at all
	   --> add a compiler support configuration for "OK" => zero length,
	   "warning" => current implementation, "error" (for example in cobol2002),
	   "ignore" => assume a space without warning; make sure zero length items
	   work everywhere (should do as we support zero lengths via ODO items already)
	*/

	if (!i) {
		cb_warning (COBC_WARN_FILLER,
			_("alphanumeric literal has zero length; a SPACE will be assumed"));
		plexbuff[i++] = ' ';
	} else if (i > cb_lit_length) {
		i = cb_lit_length;
	}

	/* build literal with given size */
	plexbuff[i] = 0;
	if (type[0] != 'N') {
		yylval = cb_build_alphanumeric_literal (plexbuff, i);
	} else {
		if (cb_verify (cb_national_literals, _("national literal"))) {
			CB_UNFINISHED (_("national literal"));
		}
		yylval = cb_build_national_literal (plexbuff, i);
	}
}

static int
scan_x (const char *text, const char *type)
{
	char		*p;
	char		*e;
	char		*dst;
	size_t		currlen;
	size_t		result_len;
	int			high = 1;
	int			c;
	cob_u64_t	val = 0;

	literal_error = 0;

	/* Remark:
	   The standard allows for 8,191 (normal/national/boolean) character positions */

	/* currlen includes the terminating quote 
	   and has to be adjusted according to type */

	currlen = strlen (text);
	currlen--;
	if (unlikely (currlen + 1 > plexsize)) {
		plexsize = currlen + 1;
		plexbuff = cobc_realloc (plexbuff, plexsize);
	}
	memcpy (plexbuff, text, currlen);
	if (likely(type[0] == 'X')) {
		result_len = currlen / 2; /* characters, two half-bytes (hex) = 1 byte */
	} else if (type[0] == 'B') {
		if (!cb_verify (cb_hexadecimal_boolean, _("hexadecimal-boolean literal"))) {
			goto error; /* early exit possible as complete literal is consumed */
		}
		result_len = currlen * 4; /* boolean characters B -> 1110 */
		/* GnuCOBOL currently only support 64 bit booleans */
		if (unlikely (result_len > 64)) {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal length %d exceeds %d characters"),
				  (int) result_len, 64);
			error_literal (type, plexbuff);
			goto error;
		}
	} else {
		if (!cb_verify (cb_national_hex_literals, _("hexadecimal-national literal"))) {
			goto error; /* early exit possible as complete literal is consumed */
		}
		CB_UNFINISHED (_("national literal"));
		result_len = currlen / (2 * COB_NATIONAL_SIZE); /* national characters */
	}
	if (unlikely (result_len > cb_lit_length)) {
		snprintf (err_msg, COB_MINI_MAX,
			_("literal length %d exceeds %d characters"),
			  (int) result_len, cb_lit_length);
		error_literal (type, plexbuff);
		goto error;
	}

	p = (char *)text;
	e = (char *)p + currlen;
	dst = plexbuff;

	if (unlikely(type[0] == 'B')) {
		/* hexadecimal-boolean */
		for (; *p != *e; p++) {
			c = (int) *p;
			if ('0' <= c && c <= '9') {
				val = (val << 4) + (c - '0');
			} else if ('A' <= c && c <= 'F') {
				val = (val << 4) + (c - 'A' + 10);
			} else if ('a' <= c && c <= 'f') {
				val = (val << 4) + (c - 'a' + 10);
			} else {
				snprintf (err_msg, COB_MINI_MAX,
					_("literal contains invalid character '%c'"), c);
				if (likely (literal_error == 0)) {
					memcpy (plexbuff, text, currlen + 1);
					plexbuff[currlen] = 0;
				}
				error_literal (type, plexbuff);
				/* By not breaking immediately, we detect any following
					invalid chars
				*/
				continue;
			}
		}
		if (unlikely (literal_error != 0)) {
			goto error;
		}
		sprintf ((char *)plexbuff, CB_FMT_LLU, val);
		yylval = cb_build_numeric_literal (0, (const void *)plexbuff, 0);

	} else {

		/* hexadecimal */
		for (; *p != *e; p++) {
			c = (int) *p;
			if ('0' <= c && c <= '9') {
				c = c - '0';
			} else if ('A' <= c && c <= 'F') {
				c = c - 'A' + 10;
			} else if ('a' <= c && c <= 'f') {
				c = c - 'a' + 10;
			} else {
				snprintf (err_msg, COB_MINI_MAX,
					_("literal contains invalid character '%c'"), c);
				if (likely (literal_error == 0)) {
					memcpy (plexbuff, text, currlen + 1);
					plexbuff[currlen] = 0;
				}
				error_literal (type, plexbuff);
				/* By not breaking immediately, we detect any following
					invalid chars
				*/
				continue;
			}
			if (likely (literal_error == 0)) {
				if (high) {
					*dst = (cob_u8_t)(c << 4);
				} else {
					*dst++ += (cob_u8_t)c;
				}
			}
			high = 1 - high;
		}

		if (!high) {
			/* This is non-standard behaviour */
			snprintf (err_msg, COB_MINI_MAX,
				_("literal does not have an even number of digits"));
			if (likely (literal_error == 0)) {
				memcpy (plexbuff, text, currlen + 1);
				plexbuff[currlen] = 0;
			}
			error_literal (type, plexbuff);
		}
		if (unlikely (literal_error != 0)) {
			goto error;
		}
		if (type [0] != 'N') {
			yylval = cb_build_alphanumeric_literal (plexbuff, (size_t)(dst - plexbuff));
		} else {
			yylval = cb_build_national_literal (plexbuff, (size_t)(dst - plexbuff));
		}
	}

	RETURN_TOK (LITERAL);

error:
	yylval = cb_error_node;
	RETURN_TOK (LITERAL);
}

static int
scan_z (const char *text, const char *type)
{
	size_t		currlen;

	literal_error = 0;

	/* currlen includes the terminating quote */
	currlen = strlen (text);
	if (unlikely ((currlen - 1) > cb_lit_length)) {
		currlen--;
		snprintf (err_msg, COB_MINI_MAX,
			_("literal length %d exceeds %d characters"),
			  (int) currlen, cb_lit_length);
		error_literal (type, text);
		yylval = cb_error_node;
		RETURN_TOK (LITERAL);
	}
	if (unlikely (currlen > plexsize)) {
		plexsize = currlen;
		plexbuff = cobc_realloc (plexbuff, plexsize);
	}
	memcpy (plexbuff, text, currlen);
	plexbuff[currlen - 1] = 0;

	/* Count is correct here as the trailing quote is now a null */
	yylval = cb_build_alphanumeric_literal (plexbuff, currlen);
	if (type[0] == 'L') {
		CB_LITERAL(yylval)->llit = 1;
	}
	RETURN_TOK (LITERAL);
}

static int
scan_h (const char *text, const char *type)
{
	size_t		currlen;
	char		*p;
	cob_u64_t	val = 0;
	int		c;

	literal_error = 0;

	if (type[1] == '#' &&
		!cb_verify (cb_acu_literals, _("ACUCOBOL numeric literal"))) {
		goto error; /* early exit possible as complete literal is consumed */
	}

	/* currlen can include the terminating quote */
	currlen = strlen (text);
	memcpy (plexbuff, text, currlen + 1);
	if (type[1] != '#') {
		currlen--;
		plexbuff[currlen] = 0;
	}
	if (unlikely (currlen > 16)) {
		snprintf (err_msg, COB_MINI_MAX,
			_("literal length %d exceeds %d characters"),
			  (int) currlen,  16);
		error_literal ("hex", plexbuff);
		goto error;
	}

	for (p = plexbuff; *p != 0; p++) {
		c = (int) *p;
		if ('0' <= c && c <= '9') {
			c = c - '0';
		} else if ('A' <= c && c <= 'F') {
			c = c - 'A' + 10;
		} else if ('a' <= c && c <= 'f') {
			c = c - 'a' + 10;
		} else {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal contains invalid character '%c'"), c);
			error_literal (type, plexbuff);
			/* By not breaking immediately, we detect any following
				invalid chars
			*/
			continue;
		}

		val = (val << 4) + c;
	}

	if (type[1] == '#') {
		/* limit for ACUCOBOL literals: UINT_MAX */
		if (val > UINT_MAX) {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal exceeds limit %u"), UINT_MAX);
			error_literal (type, plexbuff);
		}
	}

	if (literal_error) {
		goto error;
	}

	/* Duplication? */
	sprintf ((char *)plexbuff, CB_FMT_LLU, val);
	yylval = cb_build_numeric_literal (0, (const void *)plexbuff, 0);

	RETURN_TOK (LITERAL);

error:
	yylval = cb_error_node;
	RETURN_TOK (LITERAL);
}

static int
scan_b (const char *text, const char *type)
{
	/* FIXME: COBOL 2014 allows up to 8,192 boolean characters
	          COBOL 2002 allows up to   160 boolean characters
	          --> both identical to "literal-length" maximum
	          GnuCOBOL currently only supports 64 boolean characters,
	   check if it works to concatenate after 64 characters, similar to read_literal()
	*/

	size_t		currlen;
	char		*p;
	cob_u64_t	val = 0;
	int		c;

	literal_error = 0;

	/* currlen can include the terminating quote */
	currlen = strlen (text);

	if (type[1] == 0) {
		if (!cb_verify (cb_numeric_boolean, _("numeric boolean literal"))) {
			goto error; /* early exit possible as complete literal is consumed */
		}
	} else {
		if (!cb_verify (cb_acu_literals, _("ACUCOBOL numeric literal"))) {
			goto error; /* early exit possible as complete literal is consumed */
		}
	};
	if (unlikely (currlen >= plexsize)) {
		currlen = plexsize - 1;
	}
	memcpy (plexbuff, text, currlen + 1);
	if (type[1] == 0) {
		currlen--;
	}
	plexbuff[currlen] = 0;
	if (unlikely (currlen > 64)) {
		snprintf (err_msg, COB_MINI_MAX,
			_("literal length %d exceeds %d characters"),
			  (int) currlen, 64);
		error_literal (type, plexbuff);
		goto error;
	}

	for (p = plexbuff; *p != 0; p++) {
		c = (int) *p;
		if (c == '0') {
			c = 0;
		} else if (c == '1') {
			c = 1;
		} else {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal contains invalid character '%c'"), c);
			error_literal (type, plexbuff);
			continue;
		}

		val = (val << 1) + c;
	}
	if (type[1] == '#') {
		/* limit for ACUCOBOL literals: UINT_MAX */
		if (val > UINT_MAX) {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal exceeds limit %u"), UINT_MAX);
			error_literal (type, plexbuff);
		}
	}

	if (literal_error) {
		goto error;
	}

	sprintf ((char *)plexbuff, CB_FMT_LLU, val);
	/* FIXME: we should likely build a boolean literal ... */
	yylval = cb_build_numeric_literal (0, (const void *)plexbuff, 0);

	RETURN_TOK (LITERAL);

 error:
	yylval = cb_error_node;
	RETURN_TOK (LITERAL);
}

static int
scan_o (const char *text, const char *type)
{
	size_t		currlen;
	char		*p;
	cob_u64_t	val = 0;
	int		c;

	literal_error = 0;

	if (!cb_verify (cb_acu_literals, _("ACUCOBOL numeric literal"))) {
		goto error; /* early exit possible as complete literal is consumed */
	}

	currlen = strlen (text);
	memcpy (plexbuff, text, currlen + 1);
	if (unlikely (currlen > 22)) {
		snprintf (err_msg, COB_MINI_MAX,
			  _("literal length %d exceeds %d characters"),
			  (int) currlen, 22);
		error_literal (type, plexbuff);
		goto error;
	}

	for (p = plexbuff; *p != 0; p++) {
		c = (int) *p;
		if (!('0' <= c && c <= '7')) {
			snprintf (err_msg, COB_MINI_MAX,
				_("literal contains invalid character '%c'"), c);
			error_literal (type, plexbuff);
			continue;
		}

		c = c - '0';
		val = (val << 3) + c;
	}
	/* limit for ACUCOBOL literals: UINT_MAX */
	if (val > UINT_MAX) {
		snprintf (err_msg, COB_MINI_MAX,
			_("literal exceeds limit %u"), UINT_MAX);
		error_literal (type, plexbuff);
	}

	if (literal_error) {
		goto error;
	}

	sprintf ((char *)plexbuff, CB_FMT_LLU, val);
	yylval = cb_build_numeric_literal (0, (const void *)plexbuff, 0);

	RETURN_TOK (LITERAL);

 error:
	yylval = cb_error_node;
	RETURN_TOK (LITERAL);
}

static int
get_sign (const char sign)
{
	if (sign == '+') {
		return 1;
	} else if (sign == '-') {
		return -1;
	} else {
		return 0;
	}
}

#define INCREMENT_IF_SIGNED(text, sign) \
	do {				\
		if (sign) {		\
			(text)++;	\
		}			\
	} ONCE_COB

static int
scan_numeric (const char *text)
{
	char		*p = (char *)text;
	char		*s;
	int 		sign;
	int 		scale;

	/* Get sign */
	sign = get_sign (*p);
	INCREMENT_IF_SIGNED (p, sign);

	/* Get decimal point */
	s = strchr (p, current_program->decimal_point);
	if (s) {
		scale = (int)strlen (s) - 1;
		/* Remove decimal point */
		/* Moves trailing null */
		memmove (s, s + 1, (size_t)(scale + 1));
	} else {
		scale = 0;
	}

	/* Note that leading zeroes are not removed from the literal. */

	if (unlikely (strlen (p) > COB_MAX_DIGITS)) {
		/* Absolute limit */
		snprintf (err_msg, COB_MINI_MAX,
			  _("literal length %d exceeds maximum of %d digits"),
			  (int) strlen (p), COB_MAX_DIGITS);
		error_literal ("num", text);
		yylval = cb_error_node;
	} else if (unlikely (strlen (p) > cb_numlit_length)) {
		snprintf (err_msg, COB_MINI_MAX,
			  _("literal length %d exceeds %d digits"),
			  (int) strlen (p), cb_numlit_length);
		error_literal ("num", text);
		yylval = cb_error_node;
	} else {
		yylval = cb_build_numeric_literal (sign, p, scale);
	}
	RETURN_TOK (LITERAL);
}

static int
all_zeroes (const char *str)
{
	int	i;

	for (i = 0; str[i] != '\0'; ++i) {
		if (str[i] != '0') {
			return 0;
		}
	}

	return 1;
}

static int
significand_is_zero (const char *int_part, const char *dec_part)
{
	return all_zeroes (int_part)
		&& all_zeroes (dec_part);
}

static int
scan_floating_numeric (const char *text)
{
	size_t		sig_int_len;
	size_t		sig_dec_len;
	int		sig_sign;
	int		exp_sign;
	int		scale;
	int		exponent;
	int		n;
	char		significand_str[37] = { '\0' };
	char		*significand_pos;
	char		significand_dec[36] = { '\0' };
	char		significand_int[36] = { '\0' };
	char		exponent_str[8] = { '\0' };
	char		*exponent_pos;

	char		result[128] = { '\0' };

	literal_error = 0;

	/* Separate into significand and exponent */
	n = sscanf (text, "%36[0-9.,+-]%*1[Ee]%7[0-9.,+-]",
		    significand_str, exponent_str);
	/* We check the return for silencing warnings,
		this should never happen as the flex rule ensures this */
	if (n == 0) {
		yylval = cb_error_node;
		RETURN_TOK (LITERAL);
	}

	/* Get signs and adjust string positions accordingly */
	significand_pos = &significand_str[0];
	sig_sign = get_sign (*significand_pos);
	INCREMENT_IF_SIGNED (significand_pos, sig_sign);

	exponent_pos = &exponent_str[0];
	exp_sign = get_sign (*exponent_pos);
	INCREMENT_IF_SIGNED (exponent_pos, exp_sign);

	/* Separate into integer and decimal */
	n = sscanf (significand_pos, "%35[0-9]%*1[.,]%35[0-9]",
		    significand_int, significand_dec);
	if (n == 0) { /* no integer part, copy after decimal-point */
		significand_int[0] = 0;
		strncpy (significand_dec, significand_pos + 1, 35);
		significand_dec[35] = 0;
	} else {
	/* silencing some warnings */
		significand_int[35] = significand_dec[35] = 0;
	}

	/* Validation */
	sig_int_len = strlen (significand_int);
	sig_dec_len = strlen (significand_dec);
	if (sig_int_len + sig_dec_len > 34U) {
		snprintf (err_msg, COB_MINI_MAX,
			_("significand has more than 34 digits"));
		error_literal ("float", text);
	}
	if (strchr (exponent_pos, current_program->decimal_point)) {
		snprintf (err_msg, COB_MINI_MAX,
			_("exponent has decimal point"));
		error_literal ("float", text);
		exponent = 0;
	} else {
		if (strlen (exponent_pos) > 4) {
			snprintf (err_msg, COB_MINI_MAX,
				_("exponent has more than 4 digits"));
			error_literal ("float", text);
		}
		n = sscanf (exponent_pos, "%d", &exponent);
		/* We check the return for silencing warnings,
		   this should never happen as the flex rule ensures this */
		if (n == 0) {
			yylval = cb_error_node;
			RETURN_TOK (LITERAL);
		}

		if (exp_sign == -1) {
			exponent = -exponent;
		}

		if (!(-78 <= exponent && exponent <= 76)) {
			snprintf (err_msg, COB_MINI_MAX,
				_("exponent not between -78 and 76"));
			error_literal ("float", text);
		}
	}

	if (significand_is_zero (significand_int, significand_dec)) {
		if (sig_sign == -1) {
			snprintf (err_msg, COB_MINI_MAX,
				_("significand of 0 must be positive"));
			error_literal ("float", text);
		}
		if (exponent != 0) {
			snprintf (err_msg, COB_MINI_MAX,
				_("exponent of 0 must be 0"));
			error_literal ("float", text);
		}
		if (exp_sign == -1) {
			snprintf (err_msg, COB_MINI_MAX,
				_("exponent of 0 must be positive"));
			error_literal ("float", text);
		}
	}

	if (literal_error) {
		yylval = cb_error_node;
		RETURN_TOK (LITERAL);
	}

	/* Determine scale */
	/* Base scale is decimal part of the significant */
	scale = (int)sig_dec_len;
	/* Adjust according to exponent */
	if (exponent < 0) {
		/* Decimals; power down by scale difference */
		exponent = -exponent;
		scale += exponent;
		result[0] = 0;
		if (exponent > (int)sig_int_len) {
			n = exponent - (int)sig_int_len;
			for (; n; --n) {
				strcat (result, "0");
			}
		}
		strcat (result, significand_int);
		strcat (result, significand_dec);
	} else if (exponent > 0) {
		/* No decimals; power up by scale difference */
		strcpy (result, significand_int);
		strcat (result, significand_dec);
		if (exponent >= scale) {
			n = exponent - scale;
			for (; n; --n) {
				strcat (result, "0");
			}
			scale = 0;
		} else {
			scale -= exponent;
		}
	} else {
		/* Exponent is 0; take as is */
		strcpy (result, significand_int);
		strcat (result, significand_dec);
	}

	yylval = cb_build_numeric_literal (sig_sign, result,
					   scale);
	RETURN_TOK (LITERAL);
}

static void
scan_picture (const char *text)
{
	unsigned char			*p;

	/* Scan a PICTURE clause */
	/* Normalize the input */
	for (p = (unsigned char *)text; *p; p++) {
		/* unput trailing '.' or ',' */
		if (p[1] == 0 && (*p == '.' || *p == ',')) {
			unput (*p);
			*p = 0;
			break;
		}
		*p = (unsigned char)toupper (*p);
	}

	yylval = cb_build_picture (text);
}

static void
count_lines (const char *text)
{
	const char	*p;

	/* Count newlines in text */
	for (p = text; *p; p++) {
		if (*p == '\n') {
			cb_source_line++;
		}
	}
}

static void
cb_add_const_var (const char *name, cb_tree value)
{
	cb_tree			x;
	struct cb_level_78	*p78;
	struct cb_field		*f;


	/* Add an inline constant */
	x = cb_build_constant (cb_build_reference (name), value);
	f = CB_FIELD (x);
	f->flag_item_78 = 1;
	f->flag_is_global = 1;
	f->flag_internal_constant = 1;
	f->level = 1;
	(void)cb_validate_78_item (f, 1);

	/* Add constant item */
	p78 = cobc_malloc (sizeof(struct cb_level_78));
	p78->fld78 = f;
	p78->prog = NULL;
	p78->name_len = (cob_u32_t)strlen (f->name);
	/* RXWRXW - Check this */
	p78->chk_const = 0;
	if (!const78ptr) {
		p78->last = p78;
	} else {
		p78->last = const78ptr->last;
	}
	p78->next = const78ptr;
	p78->globnext = const78ptr;
	const78ptr = p78;
	if (globlev78ptr) {
		globlev78ptr->last->globnext = const78ptr;
	} else if (lev78ptr) {
		lev78ptr->last->globnext = const78ptr;
	} else {
		top78ptr = const78ptr;
	}
}

static void
scan_options (const char *text, const unsigned int optype)
{
	COB_UNUSED (text);
	COB_UNUSED (optype);
}

static void
scan_define_options (const char *text)
{
	char				*p;
	char				*s;
	char				*var;
	const struct cb_level_78	*p78;
	char				*q;
	unsigned char			*t;
	cb_tree				x;
	size_t				size;
	int				scale;
	int				sign, override;

	/* Scan a source inline define */
	p = cobc_strdup (text);

	q = &p[strlen(p)-1];
	while(q != p 
	   && (isspace(*q) || *q == '\n' || *q == '\r'))
		q--;
	q = q - 7;
	if (memcmp(q,"OVERRIDE",8) == 0) {
		override = 1;
		while (q[-1] == ' ') q--;
		strcpy(q,"\n");
	} else {
		override = 0;
	}

	/* Ignore first part */
	s = strtok (p, " ");

	/* Variable name */
	s = strtok (NULL, " \n");
	if (!s) {
		cobc_free (p);
		return;
	}

	/* Check for already defined constant */
	if (!override) {
		for (p78 = top78ptr; p78; p78 = p78->globnext) {
			if (strcasecmp (s, p78->fld78->name) == 0) {
				cobc_free (p);
				return;
			}
		}
	}

	var = cobc_strdup (s);

	/* Value */
	s = strtok (NULL, "\n");
	if (!s) {
		cb_error (_("invalid CONSTANT: %s"), var);
		goto freevar;
	}

	if (*s == '"' || *s == '\'') {
		/* Alphanumeric literal */
		sign = *s;
		size = strlen (s);
		q = s + size - 1;
		if (q == s || *q != sign) {
			cb_error (_("invalid alphanumeric CONSTANT: %s"), s);
			goto freevar;
		}
		if (size < 3) {
			cb_error (_("empty alphanumeric CONSTANT: %s"), s);
			goto freevar;
		}
		*q = 0;
		size -= 2;
		x = cb_build_alphanumeric_literal (s + 1, size);
	} else {
		/* Get sign */
		sign = get_sign (*s);
		INCREMENT_IF_SIGNED (s, sign);

		/* Get decimal point */
		scale = 0;
		q = strchr (s, '.');
		if (q) {
			scale = (int)strlen (q) - 1;
			if (scale < 1) {
				cb_error (_("invalid numeric CONSTANT: %s"), s);
				goto freevar;
			}
			/* Remove decimal point */
			memmove (q, q + 1, (size_t)(scale + 1));
		}
		for (t = (unsigned char *)s; *t; ++t) {
			if (*t < '0' || *t  > '9') {
				cb_error (_("invalid numeric CONSTANT: %s"), s);
				goto freevar;
			}
		}
		if (strlen (s) > COB_MAX_DIGITS) {
			cb_error (_("invalid numeric CONSTANT: %s"), s);
			goto freevar;
		}

		x = cb_build_numeric_literal (sign, s, scale);
	}
	/* Add to constant list */
	cb_add_const_var (var, x);

freevar:
	cobc_free (p);
	cobc_free (var);
}

#undef INCREMENT_IF_SIGNED

/* Global functions */

void
ylex_clear_all (void)
{
	/* Clear buffers after parsing all source elements */
	if (picbuff2) {
		cobc_free (picbuff2);
		picbuff2 = NULL;
	}
	if (picbuff1) {
		cobc_free (picbuff1);
		picbuff1 = NULL;
	}
	if (plexbuff) {
		cobc_free (plexbuff);
		plexbuff = NULL;
	}
	plexsize = 0;
	pic1size = 0;
	pic2size = 0;
}

void
ylex_call_destroy (void)
{
	/* Release flex buffers */
	(void)yylex_destroy ();
	const78ptr = NULL;
}

void
cb_unput_dot (void)
{
	unput ('.');
}

void
cb_reset_78 (void)
{
	struct cb_level_78	*p78;
	struct cb_level_78	*p782;

	/* Remove constant (78 level) items for current program */
	for (p78 = lev78ptr; p78; ) {
		p782 = p78->next;
		cobc_free (p78);
		p78 = p782;
	}
	lev78ptr = NULL;
	for (p78 = globlev78ptr; p78; p78 = p78->next) {
		p78->not_const = 0;
	}
	if (globlev78ptr) {
		top78ptr = globlev78ptr;
	} else {
		top78ptr = const78ptr;
	}
}

void
cb_reset_global_78 (void)
{
	struct cb_level_78	*p78;
	struct cb_level_78	*p782;

	/* Remove constant (78 level) items for top program */
	for (p78 = globlev78ptr; p78; ) {
		p782 = p78->next;
		cobc_free (p78);
		p78 = p782;
	}
	globlev78ptr = NULL;
	top78ptr = const78ptr;
}

void
cb_add_78 (struct cb_field *f)
{
	struct cb_level_78	*p78;

	/* Add a constant (78 level) item */
	p78 = cobc_malloc (sizeof(struct cb_level_78));
	p78->fld78 = f;
	p78->prog = current_program;
	p78->name_len = (cob_u32_t)strlen (f->name);
	if (f->flag_is_global) {
		if (!globlev78ptr) {
			p78->last = p78;
		} else {
			p78->last = globlev78ptr->last;
		}
		p78->last->globnext = const78ptr;
		p78->next = globlev78ptr;
		p78->globnext = globlev78ptr;
		p78->chk_const = 1;
		globlev78ptr = p78;
		if (lev78ptr) {
			lev78ptr->last->globnext = globlev78ptr;
		} else {
			top78ptr = globlev78ptr;
		}
	} else {
		if (!lev78ptr) {
			p78->last = p78;
		} else {
			p78->last = lev78ptr->last;
		}
		if (globlev78ptr) {
			p78->last->globnext = globlev78ptr;
		} else {
			p78->last->globnext = const78ptr;
		}
		p78->next = lev78ptr;
		p78->globnext = lev78ptr;
		lev78ptr = p78;
		top78ptr = lev78ptr;
	}
}

struct cb_field *
check_level_78 (const char *name)
{
	const struct cb_level_78	*p78;

	/* Check against a current constant (78 level) */
	for (p78 = lev78ptr; p78; p78 = p78->next) {
		if (strcasecmp (name, p78->fld78->name) == 0) {
			return p78->fld78;
		}
	}
	/* Check against a global constant (78 level) */
	for (p78 = globlev78ptr; p78; p78 = p78->next) {
		if (strcasecmp (name, p78->fld78->name) == 0) {
			return p78->fld78;
		}
	}
	return NULL;
}

/*
  Find program with the program-name name in defined_prog_list. If it is not
  there, return NULL.
*/
struct cb_program *
cb_find_defined_program_by_name (const char *name)
{
	int	(*cmp_func)(const char *, const char *);
	cb_tree	l;
	cb_tree	x;

	if (cb_fold_call) {
		cmp_func = &strcasecmp;
	} else {
		cmp_func = &strcmp;
	}

	for (l = defined_prog_list; l; l = CB_CHAIN (l)) {
		x = CB_VALUE (l);
		if ((*cmp_func)(name, CB_PROGRAM (x)->program_name) == 0) {
			return CB_PROGRAM (x);
		}
	}

	return NULL;
}

struct cb_program *
cb_find_defined_program_by_id (const char *orig_id)
{
	cb_tree	l;
	cb_tree	x;

	for (l = defined_prog_list; l; l = CB_CHAIN (l)) {
		x = CB_VALUE (l);
		if (strcmp (orig_id, CB_PROGRAM (x)->orig_program_id) == 0) {
			return CB_PROGRAM (x);
		}
	}

	return NULL;
}
