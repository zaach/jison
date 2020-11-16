/*
   Copyright (C) 2001-2012, 2014-2017 Free Software Foundation, Inc.
   Written by Keisuke Nishida, Roger While, Simon Sobisch, Dave Pitts

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
%option prefix="pp"

%option stack

%option noyy_top_state
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
static int ppwrap (void) {
	return 1;
}

#define	PPLEX_BUFF_LEN		512
#define YY_INPUT(buf,result,max_size)	result = ppinput (buf, max_size);
#define	ECHO				fputs (yytext, yyout)

#define	YY_USER_INIT							\
	if (!plexbuff1) {						\
		plexbuff1 = cobc_malloc ((size_t)COB_SMALL_BUFF);	\
	}								\
	if (!plexbuff2) {						\
		plexbuff2 = cobc_malloc ((size_t)COB_SMALL_BUFF);	\
	}								\
	requires_listing_line = 1;					\
	comment_allowed = 1;

#include "config.h"

#ifdef	HAVE_UNISTD_H
#include <unistd.h>
#else
#define	YY_NO_UNISTD_H	1
#endif
#include <ctype.h>
#include <sys/stat.h>
#include <sys/types.h>

#define	COB_IN_PPLEX	1
#include "cobc.h"
#include "ppparse.h"

/* ignore unused functions here as flex generates unused ones */
#ifdef	__GNUC__
#if	defined (__clang__) || __GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 4)
#pragma GCC diagnostic ignored "-Wunused-function"
#endif
#endif

#define PLEX_COND_DEPTH		16

struct copy_info {
	struct copy_info	*next;
	struct list_files       *containing_files;
	const char		*file;
	char			*dname;
	struct cb_replace_list	*replacing;
	YY_BUFFER_STATE		buffer;
	int			line;
	int			quotation_mark;
	int			source_format;
};

struct plex_stack {
	unsigned int		cmd;
	unsigned int		skip;
	unsigned int		cond;
	int			line;
};

/* Global variables */


/* Local variables */
static char			*plexbuff1 = NULL;
static char			*plexbuff2 = NULL;
static struct list_files	*old_list_file = NULL;
static size_t			newline_count = 0;
static size_t			within_comment = 0;
static size_t			inside_bracket = 0;
static size_t			consecutive_quotation = 0;
static size_t			need_continuation = 0;
static size_t			buffer_overflow = 0;
static size_t			comment_allowed;
static unsigned int		plex_skip_input = 0;
static unsigned int		plex_nest_depth = 0;
static int			quotation_mark = 0;
static int			listing_line = 0;
static int			requires_listing_line;
static int			requires_new_line = 0;

static char	msg[PPLEX_BUFF_LEN];

static struct cb_replace_list	*current_replace_list = NULL;
static struct cb_replace_list	*save_current_replace = NULL;
static struct cb_replace_list	*base_replace_list = NULL;

static struct cb_text_list	*text_queue = NULL;

static struct copy_info		*copy_stack = NULL;

static struct plex_stack	plex_cond_stack[PLEX_COND_DEPTH];

/* Function declarations */
static int	ppinput			(char *, const size_t);
static void	ppecho			(const char *, const cob_u32_t,
					 const int);
static void	switch_to_buffer	(const int, const char *,
					 const YY_BUFFER_STATE);
static void	check_listing		(const char *, const unsigned int);
static void	skip_to_eol		(void);
static void display_finish		(void);
static void	set_print_replace_list	(struct cb_replace_list *list);
static void	get_new_listing_file	(void);

%}

WORD		[_0-9A-Z\x80-\xFF-]+
NUMRIC_LITERAL	[+-]?[0-9,.]*[0-9]
ALNUM_LITERAL	\"[^\"\n]*\"|\'[^\'\n]*\'
SET_PAREN_LIT	\([^()\n]*\)
DEFNUM_LITERAL	[+-]?[0-9]*[\.]*[0-9]+

%x CALL_DIRECTIVE_STATE
%x COPY_STATE
%x PSEUDO_STATE
%x SOURCE_DIRECTIVE_STATE
%x DEFINE_DIRECTIVE_STATE
%x ON_OFF_DIRECTIVE_STATE
%x SET_DIRECTIVE_STATE
%x TURN_DIRECTIVE_STATE
%x IF_DIRECTIVE_STATE
%x ELSE_DIRECTIVE_STATE
%x ENDIF_DIRECTIVE_STATE
%x ALNUM_LITERAL_STATE
%x CONTROL_STATEMENT_STATE
%x DISPLAY_DIRECTIVE_STATE

%%

%{
%}

<*>"*>".*		{
	/* 2002+: inline comment */
	#if	0	/* RXWRXW - Directive state */
	if (YY_START != DIRECTIVE_STATE && YY_START != SET_DIRECTIVE_STATE) {
		ppecho (" ", 0, 1);
	}
	#endif
}

^[ ]*">>"[ ]?"DEFINE"	{
	/* 2002+: definition of compiler constants display message during compilation */
	/* Define here to preempt next debug rule below */
	BEGIN DEFINE_DIRECTIVE_STATE;
	return DEFINE_DIRECTIVE;
}

^[ ]*">>"[ ]?"DISPLAY"[ ]+ {
	/* OpenCOBOL/GnuCOBOL 1.0 extension: display message during compilation */
	msg[0] = 0;
	BEGIN DISPLAY_DIRECTIVE_STATE;
}

^[ ]*">>D"		{
	/* 2002 (only) floating debug line */
	/* Remove line if debugging lines not activated */
	/* Otherwise ignore the directive part of the line */
	(void) cb_verify (cb_debugging_mode, _("debugging indicator"));
	if (!cb_flag_debugging_line) {
		skip_to_eol ();
	}
}

^[ ]*">>"[ ]?"PAGE"	{
	/* 2002+: listing directive for page eject with optional comment
	   Note: processed in cobc.c */
	skip_to_eol ();
}

^[ ]*">>"[ ]?"LISTING"	{
	/* 2002+: listing directive for (de-)activating the listing,
	   ON implied for empty value
	   Note: further checks in ppparse.y, processed in cobc.c */
	BEGIN ON_OFF_DIRECTIVE_STATE;
	return LISTING_DIRECTIVE;
}

^[ ]*">>"[ ]?"SOURCE"	{
	/* 2002+: directive for setting source format */
	BEGIN SOURCE_DIRECTIVE_STATE;
	return SOURCE_DIRECTIVE;
}

^[ ]*">>"[ ]?"SET"	{
	/* OpenCOBOL/GnuCOBOL 2.0 extension: MF SET directive in 2002+ style format */
	BEGIN SET_DIRECTIVE_STATE;
	return SET_DIRECTIVE;
}

^[ ]*">>"[ ]?"TURN"	{
	/* 2002+: directive for (de-)activating exception checks */
	BEGIN TURN_DIRECTIVE_STATE;
	return TURN_DIRECTIVE;
}

^[ ]*">>"[ ]?"IF"	{
	/* 2002+: conditional compilation */
	BEGIN IF_DIRECTIVE_STATE;
	return IF_DIRECTIVE;
}
^[ ]*">>"[ ]?"ELIF" |
^[ ]*">>"[ ]?"ELSE-IF"	{
	/* OpenCOBOL extension: conditional compilation combined ELSE IF,
	   2002+ style format */
	BEGIN IF_DIRECTIVE_STATE;
	return ELIF_DIRECTIVE;
}
^[ ]*">>"[ ]?"ELSE"	{
	/* 2002+: conditional compilation */
	BEGIN ELSE_DIRECTIVE_STATE;
	return ELSE_DIRECTIVE;
}
^[ ]*">>"[ ]?"END-IF"	{
	/* 2002+: conditional compilation */
	BEGIN ENDIF_DIRECTIVE_STATE;
	return ENDIF_DIRECTIVE;
}

^[ ]*">>"[ ]?"LEAP-SECOND"	{
	/* 2002+: more then 60 seconds per minute (currently always set to off),
	          OFF implied for empty value */
	BEGIN ON_OFF_DIRECTIVE_STATE;
	return LEAP_SECOND_DIRECTIVE;
}

^[ ]*">>"[ ]?"CALL-CONVENTION"	{
	/* 2002+: convention for CALL/CANCEL */
	BEGIN CALL_DIRECTIVE_STATE;
	return CALL_DIRECTIVE;
}

^[ ]*">>"[ ]*\n		{
	/* empty 2002+ style directive */
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
			_("ignoring empty directive"));
	unput ('\n');
}

^[ ]*">>"[ ]*[_0-9A-Z-]+	{
	/* unknown 2002+ style directive */
	char	*s;

	s = strchr (yytext, '>');
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
			_("ignoring invalid directive: '%s'"), s);
	skip_to_eol ();
}
^[ ]*">>"		{
	/* unknown 2002+ style directive */
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
			_("ignoring invalid directive"));
	skip_to_eol ();
}

^[ ]*"$DISPLAY"[ ]+"VCS"[ ]+"="[ ]+	{
	/* MF extension: include @(#)text\0 in the object file */
	/* we just add a warning for now, maybe implement it later */
	CB_PENDING (_("VCS directive"));
	skip_to_eol ();
}

^[ ]*"$DISPLAY"[ ]+		{
	/* MF extension: display message during compilation */
	msg[0] = 0;
	BEGIN DISPLAY_DIRECTIVE_STATE;
}

^[ ]*"$SET"		{
	/* MF extension: SET directive */
	BEGIN SET_DIRECTIVE_STATE;
	return SET_DIRECTIVE;
}

^[ ]*"$IF"		{
	/* MF extension: conditional compilation */
	BEGIN IF_DIRECTIVE_STATE;
	return IF_DIRECTIVE;
}
^[ ]*"$ELIF" |
^[ ]*"$ELSE-IF"		{
	/* OpenCOBOL/GnuCOBOL 2.0 extension: conditional compilation combined ELSE IF,
	   MF style format */
	BEGIN IF_DIRECTIVE_STATE;
	return ELIF_DIRECTIVE;
}
^[ ]*"$ELSE"		{
	/* MF extension: conditional compilation */
	BEGIN ELSE_DIRECTIVE_STATE;
	return ELSE_DIRECTIVE;
}
^[ ]*"$END"		{
	/* MF extension: conditional compilation */
	BEGIN ENDIF_DIRECTIVE_STATE;
	return ENDIF_DIRECTIVE;
}

^[ ]*"$"[_0-9A-Z-]+	{
	/* unknown MF style directive */
	char	*s;

	s = strchr (yytext, '$');
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
			_("ignoring invalid directive: '%s'"), s);
	skip_to_eol ();
}

^......"$"		{
	/* Allow $ in column 7 for acucomment in fixed format */
	if (cb_source_format == CB_FORMAT_FREE) {
		cb_plex_warning (COBC_WARN_FILLER, newline_count,
			_("spurious '$' detected - ignored"));
		skip_to_eol ();
	}
}

^[ ]*"$"		{
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
		_("spurious '$' detected - ignored"));
	skip_to_eol ();
}

"PROCESS"		{
	cb_plex_warning (COBC_WARN_FILLER, newline_count,
		_("PROCESS statement ignored"));
	skip_to_eol ();
}

"COPY"			{
	yy_push_state (COPY_STATE);
	if (cb_src_list_file) {
		get_new_listing_file ();
	}
	return COPY;
}

"INCLUDE"		{
	/* Note: ++INCLUDE/-INC (include only the data records,
	   must be specified in column 8/1) are not implemented yet */
	yy_push_state (COPY_STATE);
	if (cb_src_list_file) {
		get_new_listing_file ();
	}
	return COPY;
}

"REPLACE"		{
	yy_push_state (COPY_STATE);
	return REPLACE;
}

^[ ]*"*CONTROL"		|
^[ ]*"*CBL"		{
	BEGIN CONTROL_STATEMENT_STATE;
	return CONTROL_STATEMENT;
}

"ID"[ ,;]+"DIVISION" |
"IDENTIFICATION"[ ,;]+"DIVISION" {
	/* Allow comment sentences/paragraphs */
	comment_allowed = 1;
	ppecho (yytext, 0, (int)yyleng);
}

"PROGRAM-ID"	{
	/* Allow comment sentences/paragraphs */
	comment_allowed = 1;
	ppecho (yytext, 0, (int)yyleng);
}

"DIVISION"	{
	/* Disallow comment sentences/paragraphs */
	comment_allowed = 0;
	ppecho (yytext, 0, (int)yyleng);
}

"SECTION"	{
	/* Disallow comment sentences/paragraphs */
	comment_allowed = 0;
	ppecho (yytext, 0, (int)yyleng);
}

^[ ]*"EJECT"([ ]*\.)? |
^[ ]*"SKIP1"([ ]*\.)? |
^[ ]*"SKIP2"([ ]*\.)? |
^[ ]*"SKIP3"([ ]*\.)?	{
	/* These words can either be a listing-directive statement,
	   a reserved word, or a user-defined word...
	   some implementations (dis-)allow the (optional) "."
	   some start column 8+ some column 12+
	   We ignore the detailed rules and just do the parsing. */
	if (cb_verify (cb_listing_statements, yytext)) {
		/* handle as listing-directive statement */
		skip_to_eol();
		return LISTING_STATEMENT;
	} else if (cb_listing_statements == CB_SKIP) {
		/* handle later (normal reserved / user defined word) */
		ECHO;
		check_listing (yytext, 0);
	} else {
		/* Ignore */
	}
}

^[ ]*"TITLE"	{
	/* This word can either be a listing-directive statement,
	   a reserved word, or a user-defined word...
	   some implementations (dis-)allow the (optional) "."
	   some start column 8+ some column 12+,
	   most limit the literal length (we cut in cobc.c)
	   We ignore the detailed rules and just do the parsing. */
	if (cb_verify (cb_title_statement, yytext)) {
		/* handle as listing-directive statement */
		BEGIN ALNUM_LITERAL_STATE;
		return TITLE_STATEMENT;
	} else if (cb_title_statement == CB_SKIP) {
		/* handle later (normal reserved / user defined word) */
		ECHO;
		check_listing (yytext, 0);
	} else {
		/* Ignore */
	}
}

"WITH"[ ,;]+"DEBUGGING"[ ,;]+"MODE" |
"DEBUGGING"[ ,;]+"MODE"	{
	/* Pick up early - Also activates debugging lines */
	cb_verify (cb_debugging_mode, "DEBUGGING MODE");
	cb_flag_debugging_line = 1;
	ppecho (yytext, 0, (int)yyleng);
}

[,;]?\n		{
	ppecho ("\n", 0, 1);
	cb_source_line++;
}

[;]?[ ]+	{
	ppecho (" ", 1U, 1);
}

[,]?[ ]+	{
	if (inside_bracket) {
		ppecho (", ", 0, 2);
	} else {
		ppecho (" ", 1U, 1);
	}
}

"("		{
	inside_bracket++;
	ppecho ("(", 0, 1);
}

")"		{
	if (inside_bracket) {
		inside_bracket--;
	}
	ppecho (")", 0, 1);
}

{WORD} |
{NUMRIC_LITERAL} |
{ALNUM_LITERAL} |
.		{
	ppecho (yytext, 0, (int)yyleng);
}

<CALL_DIRECTIVE_STATE,
SOURCE_DIRECTIVE_STATE,
DEFINE_DIRECTIVE_STATE,
ON_OFF_DIRECTIVE_STATE,
SET_DIRECTIVE_STATE,
TURN_DIRECTIVE_STATE,
IF_DIRECTIVE_STATE,
ELSE_DIRECTIVE_STATE,
ENDIF_DIRECTIVE_STATE,
ALNUM_LITERAL_STATE,
CONTROL_STATEMENT_STATE>{
  \n			{
	BEGIN INITIAL;
	unput ('\n');
	return TERMINATOR;
  }
  [ ,;]+		{ /* ignore */ }
  "." {
	return DOT;
  }
}

<DISPLAY_DIRECTIVE_STATE>{
  \n			{
	BEGIN INITIAL;
	display_finish();
  }

  {ALNUM_LITERAL} {
	yytext[yyleng - 1] = 0;
	strncat (msg, yytext + 1, (size_t)(PPLEX_BUFF_LEN - 1));
  }

  [x21-\xFF]	|
  [ #A-Z0-9\x80-\xFF]+ {
	strncat (msg, yytext, (size_t)(PPLEX_BUFF_LEN - 1));
  }
}

<ON_OFF_DIRECTIVE_STATE>{
  "ON"			{ return ON; }
  "OFF"			{ return OFF; }
}

<SOURCE_DIRECTIVE_STATE>{
  "FORMAT"		{ return FORMAT; }
  "IS"			{ return IS; }
  "FIXED"		{ return FIXED; }
  "FREE"		{ return FREE; }
  "VARIABLE"		{ return VARIABLE; }
}

<CALL_DIRECTIVE_STATE>{
  "COBOL"		{ return COBOL; }
  "EXTERN"		{ return TOK_EXTERN; }
  "STDCALL"		{ return STDCALL; }
  "STATIC"		{ return STATIC; }
}

<CONTROL_STATEMENT_STATE>{
  "SOURCE"		{ return SOURCE; }
  "NOSOURCE"	{ return NOSOURCE; }
  "LIST"		{ return LIST; }
  "NOLIST"		{ return NOLIST; }
  "MAP"			{ return MAP; }
  "NOMAP"		{ return NOMAP; }
}

<DEFINE_DIRECTIVE_STATE>{
  /* OpenCOBOL/GnuCOBOL 2.0 extension: MF $SET CONSTANT in 2002+ style as
     >> DEFINE CONSTANT var [AS] literal  archaic extension:
     use plain  >> DEFINE var [AS] literal  for conditional compilation and
     use        01 CONSTANT with/without FROM clause  for constant definitions */
  "CONSTANT"		{
	return CONSTANT;
  }
  "AS"			{
	return AS;
  }
  "OFF"			{
	return OFF;
  }
  "OVERRIDE"		{
	return OVERRIDE;
  }
  "PARAMETER"		{
	return PARAMETER;
  }
  {NUMRIC_LITERAL} |
  {ALNUM_LITERAL}	{
	pplval.s = cobc_plex_strdup (yytext);
	return LITERAL;
  }
  {WORD}		{
	pplval.s = cobc_plex_strdup (yytext);
	return VARIABLE_NAME;
  }
}

<SET_DIRECTIVE_STATE>{
  "CONSTANT"		{
	return CONSTANT;
  }
  "SOURCEFORMAT"	{
	return SOURCEFORMAT;
  }
  "FOLDCOPYNAME" |
  "FOLD-COPY-NAME"	{
	return FOLDCOPYNAME;
  }
  "NOFOLDCOPYNAME" |
  "NOFOLD-COPY-NAME"	{
	return NOFOLDCOPYNAME;
  }
  /*"AS"			{ - not available with MF compilers -
	return AS;
  }*/
  "OVERRIDE"		{
	  /* not valid, only in for error checking as it would
	     result in a variable name otherwise */
	  return OVERRIDE;
  }
  {DEFNUM_LITERAL} |
  {ALNUM_LITERAL}	{
	pplval.s = cobc_plex_strdup (yytext);
	return LITERAL;
  }
  {SET_PAREN_LIT}	{
	yytext[yyleng - 1] = 0;
	pplval.s = cobc_plex_strdup (yytext + 1);
	return LITERAL;
  }
  {WORD}		{
	pplval.s = cobc_plex_strdup (yytext);
	return VARIABLE_NAME;
  }
}

<TURN_DIRECTIVE_STATE>{
  "ON"			{
	return ON;
  }
  "OFF"			{
	return OFF;
  }
  "WITH"		{
	return WITH;
  }
  "LOCATION"		{
	return LOCATION;
  }
  "CHECKING"		{
	return CHECKING;
  }
  {DEFNUM_LITERAL} |
  {ALNUM_LITERAL}	{
	pplval.s = cobc_plex_strdup (yytext);
	return LITERAL;
  }
  {SET_PAREN_LIT}	{
	yytext[yyleng - 1] = 0;
	pplval.s = cobc_plex_strdup (yytext + 1);
	return LITERAL;
  }
  {WORD}		{
	pplval.s = cobc_plex_strdup (yytext);
	return VARIABLE_NAME;
  }
}

<CALL_DIRECTIVE_STATE,
SOURCE_DIRECTIVE_STATE,
ON_OFF_DIRECTIVE_STATE,
ELSE_DIRECTIVE_STATE,
ENDIF_DIRECTIVE_STATE>{
  {NUMRIC_LITERAL} |
  {ALNUM_LITERAL}	{
	return LITERAL;
  }
  {WORD}		{
	return GARBAGE;
  }
}

<IF_DIRECTIVE_STATE>{
  "IS"			{ return IS; }
  "NOT"			{ return NOT; }
  "EQUAL"		{ return EQUAL; }
  "TO"			{ return TO; }
  "OR"			{ return OR; }
  "GREATER"		{ return GREATER; }
  "LESS"		{ return LESS; }
  "THAN"		{ return THAN; }
  "DEFINED"		{ return DEFINED; }
  "SET"			{ return SET; }
  ">="			{ return GE; }
  ">"			{ return GT; }
  "<="			{ return LE; }
  "<>"			{ return NE; }
  "<"			{ return LT; }
  "="			{ return EQ; }
  {NUMRIC_LITERAL} |
  {ALNUM_LITERAL}	{
	pplval.s = cobc_plex_strdup (yytext);
	return LITERAL;
  }
  {WORD}		{
	pplval.s = cobc_plex_strdup (yytext);
	return VARIABLE_NAME;
  }
}

<ALNUM_LITERAL_STATE>{
  {ALNUM_LITERAL}	{
	return LITERAL;
  }
}

<COPY_STATE>{
  [,;]?\n		{
	ECHO;
	check_listing (yytext, 0);
	cb_source_line++;
  }
  [,;]?[ ]+		{ /* ignore */ }
  \. 			{
	  yy_pop_state ();
	  return DOT;
  }
  "=="			{ yy_push_state (PSEUDO_STATE); return EQEQ; }
  "("			{ return '('; }
  ")"			{ return ')'; }
  "BY"			{ return BY; }
  "IN"			{ return IN; }
  "OF"			{ return OF; }
  "OFF"			{ return OFF; }
  "SUPPRESS"		{ return SUPPRESS; }
  "PRINTING"		{ return PRINTING; }
  "REPLACING"		{ return REPLACING; }
  "LEADING"		{ return LEADING; }
  "TRAILING"		{ return TRAILING; }
  "ALSO"		{ return ALSO; }
  "LAST"		{ return LAST; }
  {WORD} |
  {NUMRIC_LITERAL} |
  {ALNUM_LITERAL} |
  .			{ pplval.s = cobc_plex_strdup (yytext); return TOKEN; }
}

<PSEUDO_STATE>{
  [,;]?\n		{
	ECHO;
	check_listing (yytext, 0);
	cb_source_line++;
  }

  [,;]?[ ]+		{
	pplval.s = cobc_plex_strdup (" ");
	return TOKEN;
  }

  "=="			{
	yy_pop_state ();
	return EQEQ;
  }

  {WORD} |
  {NUMRIC_LITERAL} |
  {ALNUM_LITERAL} |
  .			{
	pplval.s = cobc_plex_strdup (yytext);
	return TOKEN;
  }
}


<<EOF>> {
	struct copy_info *current_copy_info = copy_stack;

	yy_delete_buffer (YY_CURRENT_BUFFER);

	/* Terminate at the end of all input */
	if (current_copy_info->next == NULL) {
		/* Check dangling IF/ELSE */
		for (; plex_nest_depth > 0; --plex_nest_depth) {
			cb_source_line = plex_cond_stack[plex_nest_depth].line;
			cb_error (_("IF/ELIF/ELSE directive without matching END-IF"));
		}
		plex_nest_depth = 0;
		cobc_free (current_copy_info->dname);
		cobc_free (current_copy_info);
		listing_line = 0;
		requires_listing_line = 1;
		requires_new_line = 0;
		need_continuation = 0;
		buffer_overflow = 0;
		within_comment = 0;
		newline_count = 0;
		inside_bracket = 0;
		comment_allowed = 1;
		current_replace_list = NULL;
		base_replace_list = NULL;
		save_current_replace = NULL;
		text_queue = NULL;
		copy_stack = NULL;
		quotation_mark = 0;
		consecutive_quotation = 0;
		yyterminate ();
	}

	/* Close the current file */
	fclose (ppin);
	ppin = NULL;

	if (current_copy_info->containing_files) {
		cb_current_file = current_copy_info->containing_files;
	}

	/* Switch to previous buffer */
	switch_to_buffer (current_copy_info->line, current_copy_info->file,
			  current_copy_info->buffer);

	/* Restore variables */
	current_replace_list = current_copy_info->replacing;
	quotation_mark = current_copy_info->quotation_mark;
	cb_source_format = current_copy_info->source_format;

	copy_stack = current_copy_info->next;
	cobc_free (current_copy_info->dname);
	cobc_free (current_copy_info);
}

%%

/* Global functions */

void
pp_set_replace_list (struct cb_replace_list *list, const cob_u32_t is_pushpop)
{
	/* Handle REPLACE verb */
	if (!list) {
		/* REPLACE [LAST] OFF */
		if (!is_pushpop) {
			base_replace_list = NULL;
			return;
		}
		if (!base_replace_list) {
			return;
		}
		base_replace_list = base_replace_list->prev;
		return;
	}
	/* REPLACE [ALSO] ... */
	if (base_replace_list && is_pushpop) {
		list->last->next = base_replace_list;
		list->prev = base_replace_list;
	} else {
		list->prev = NULL;
	}
	base_replace_list = list;
	if (cb_src_list_file) {
		set_print_replace_list (list);
	}
}

int
ppopen (const char *name, struct cb_replace_list *replacing_list)
{
	struct copy_info	*current_copy_info;
	char			*s;
	char			*dname;

	unsigned char		bom[4];

	if (ppin) {
		for (; newline_count > 0; newline_count--) {
			ungetc ('\n', ppin);
		}
	}

	/* Open copy/source file, or use stdin */
	if (strcmp(name, COB_DASH) == 0) {
		ppin = stdin;
	} else {
#ifdef	__OS400__
		ppin = fopen (name, "r");
#else
		ppin = fopen (name, "rb");
#endif
	}

	if (!ppin) {
		cb_error ("%s: %s", name, cb_get_strerror ());
		return -1;
	}

	/* Check for BOM - *not* for input from stdin as rewind() clears the input
	  buffer if used on stdin and output in console has normally no BOM at all */
	if (strcmp (name, COB_DASH) != 0) {
		if (fread (bom, 3, 1, ppin) == 1) {
			if (bom[0] != 0xEF || bom[1] != 0xBB || bom[2] != 0xBF) {
				rewind (ppin);
			}
		} else {
			rewind (ppin);
		}
	}

	/* Save name for listing */
	if (cb_current_file && !cb_current_file->name) {
		cb_current_file->name = cobc_strdup (name);
	}

	/* Preserve the current buffer */
	current_copy_info = cobc_malloc (sizeof (struct copy_info));
	current_copy_info->file = cb_source_file;
	current_copy_info->buffer = YY_CURRENT_BUFFER;

	/* Save variables */
	current_copy_info->replacing = current_replace_list;
	current_copy_info->line = cb_source_line;
	current_copy_info->quotation_mark = quotation_mark;
	current_copy_info->source_format = cb_source_format;

	current_copy_info->next = copy_stack;
	current_copy_info->containing_files = old_list_file;
	copy_stack = current_copy_info;

	if (cb_current_file) {
		cb_current_file->copy_line = cb_source_line;
	}

	/* Set replacing list */
	if (replacing_list) {
		if (current_replace_list) {
			replacing_list->last->next = current_replace_list;
			replacing_list->last = current_replace_list->last;
		}
		current_replace_list = replacing_list;
		if (cb_src_list_file) {
			set_print_replace_list (replacing_list);
		}
	}

	dname = cobc_strdup (name);
	current_copy_info->dname = dname;
	for (s = dname; *s; ++s) {
		if (*s == '\\') {
			*s = '/';
		}
	}

	/* Switch to new buffer */
	switch_to_buffer (1, dname, yy_create_buffer (ppin, YY_BUF_SIZE));
	return 0;
}

int
ppcopy (const char *name, const char *lib, struct cb_replace_list *replace_list)
{
	struct cb_text_list	*il;
	struct cb_text_list	*el;
	const char		*s;

	if (cb_current_file) {
		cb_current_file->copy_line = cb_source_line;
	}

	/* Locate and open COPY file */
	if (lib) {
		snprintf (plexbuff1, (size_t)COB_SMALL_MAX, "%s/%s", lib, name);
		plexbuff1[COB_SMALL_MAX] = 0;
		s = plexbuff1;
	} else {
		s = name;
	}

	/* Find the file */
	if (access (s, R_OK) == 0) {
		return ppopen (s, replace_list);
	}

	for (el = cb_extension_list; el; el = el->next) {
		snprintf (plexbuff2, (size_t)COB_SMALL_MAX, "%s%s", s, el->text);
		plexbuff2[COB_SMALL_MAX] = 0;
		if (access (plexbuff2, R_OK) == 0) {
			return ppopen (plexbuff2, replace_list);
		}
	}

	if (*s != '/') {
		for (il = cb_include_list; il; il = il->next) {
			for (el = cb_extension_list; el; el = el->next) {
				snprintf (plexbuff2, (size_t)COB_SMALL_MAX,
					  "%s/%s%s", il->text, name, el->text);
				plexbuff2[COB_SMALL_MAX] = 0;
				if (access (plexbuff2, R_OK) == 0) {
					return ppopen (plexbuff2, replace_list);
				}
			}
		}
	}

	/* On COPY, open error restore old file */
	cb_current_file = old_list_file;
	fprintf (yyout, "#line %d \"%s\"\n", cb_source_line, cb_source_file);

	cb_error ("%s: %s", s, cb_get_strerror ());
	return -1;
}

void
ppparse_error (const char *err_msg)
{
	cb_plex_error (newline_count, "%s", err_msg);
}

void
plex_clear_vars (void)
{
	/* Reset variables */
	plex_skip_input = 0;
	plex_nest_depth = 0;
	memset (plex_cond_stack, 0, sizeof(plex_cond_stack));
	requires_listing_line = 1;
	comment_allowed = 1;
}

void
plex_clear_all (void)
{
	if (plexbuff1) {
		cobc_free (plexbuff1);
		plexbuff1 = NULL;
	}
	if (plexbuff2) {
		cobc_free (plexbuff2);
		plexbuff2 = NULL;
	}
}

void
plex_call_destroy (void)
{
	(void)pplex_destroy ();
}

void
plex_action_directive (const unsigned int cmdtype, const unsigned int is_true)
{
	unsigned int	n;

	/* Action IF/ELSE/END-IF/ELIF */
	switch (cmdtype) {
	case PLEX_ACT_IF:
		/* Push stack - First occurrence is dummy */
		if (++plex_nest_depth >= PLEX_COND_DEPTH) {
			/* LCOV_EXCL_START */
			cobc_err_msg (_("directive nest depth exceeded: %d"),
					PLEX_COND_DEPTH);
			COBC_ABORT ();
			/* LCOV_EXCL_STOP */
		}
		plex_cond_stack[plex_nest_depth].cmd = 1U;
		/* Intersection with previous - first is always 0 */
		n = plex_cond_stack[plex_nest_depth - 1].skip | !is_true;
		plex_cond_stack[plex_nest_depth].skip = n;
		plex_cond_stack[plex_nest_depth].cond = is_true;
		plex_cond_stack[plex_nest_depth].line = cb_source_line;
		plex_skip_input = n;
		return;
	case PLEX_ACT_ELSE:
		/* Must have an associated IF/ELIF */
		if (!plex_nest_depth ||
		    plex_cond_stack[plex_nest_depth].cmd != 1) {
			cb_plex_error (newline_count,
				_("ELSE directive without matching IF/ELIF"));
			return;
		}
		plex_cond_stack[plex_nest_depth].cmd = 2U;
		/* Reverse any IF/ELIF condition */
		n = plex_cond_stack[plex_nest_depth].cond;
		plex_cond_stack[plex_nest_depth].skip = n;
		plex_cond_stack[plex_nest_depth].line = cb_source_line;
		/* Intersection with previous */
		plex_skip_input = plex_cond_stack[plex_nest_depth - 1].skip | n;
		return;
	case PLEX_ACT_END:
		/* Must have an associated IF/ELIF/ELSE */
		if (!plex_nest_depth ||
		    !plex_cond_stack[plex_nest_depth].cmd) {
			cb_plex_error (newline_count,
				_("END-IF directive without matching IF/ELIF/ELSE"));
			return;
		}
		plex_cond_stack[plex_nest_depth].cmd = 0;
		plex_cond_stack[plex_nest_depth].skip = 0;
		plex_cond_stack[plex_nest_depth].cond = 0;
		plex_cond_stack[plex_nest_depth].line = 0;
		/* Pop stack - set skip to previous */
		plex_nest_depth--;
		plex_skip_input = plex_cond_stack[plex_nest_depth].skip;
		return;
	case PLEX_ACT_ELIF:
		/* Must have an associated IF/ELIF */
		if (!plex_nest_depth ||
		    plex_cond_stack[plex_nest_depth].cmd != 1) {
			cb_plex_error (newline_count,
				_("ELIF directive without matching IF/ELIF"));
			return;
		}
		plex_cond_stack[plex_nest_depth].line = cb_source_line;
		if (plex_cond_stack[plex_nest_depth].cond) {
			/* Previous IF or one of previous ELIF was true */
			/* Set to skip */
			n = 1U;
		} else if (is_true) {
			/* Condition is true */
			plex_cond_stack[plex_nest_depth].cond = 1U;
			n = 0;
		} else {
			/* Set to skip */
			n = 1U;
		}
		plex_cond_stack[plex_nest_depth].skip = n;
		/* Intersection with previous */
		plex_skip_input = plex_cond_stack[plex_nest_depth - 1].skip | n;
		return;
	default:
		/* LCOV_EXCL_START */
		cobc_err_msg (_("invalid internal case: %u"),
				cmdtype);
		COBC_ABORT ();
		/* LCOV_EXCL_STOP */
	}
}

/* Local functions */

static void
get_new_listing_file (void)
{
	struct list_files	*newfile = cobc_malloc (sizeof (struct list_files));

	if (!cb_current_file->copy_head) {
		cb_current_file->copy_head = newfile;
	}
	if (cb_current_file->copy_tail) {
		cb_current_file->copy_tail->next = newfile;
	}
	cb_current_file->copy_tail = newfile;

	memset (newfile, 0, sizeof (struct list_files));
	newfile->copy_line = cb_source_line;
	newfile->source_format = cb_source_format;
	old_list_file = cb_current_file;
	cb_current_file = newfile;
}

static void
set_print_replace_list (struct cb_replace_list *list)
{
	struct cb_replace_list		*r;
	const struct cb_text_list	*l;
	struct list_replace		*repl;
	int 				length;

	for (r = list; r; r = r->next) {
		repl = cobc_malloc (sizeof (struct list_replace));
		memset (repl, 0, sizeof (struct list_replace));
		repl->firstline = r->line_num;
		repl->lead_trail = r->lead_trail;
		repl->lastline = cb_source_line;

		for (l = r->old_text, length = 0; l; l = l->next) {
			length += (int)strlen (l->text);
		}
		repl->from = cobc_malloc (length + 2);
		memset (repl->from, 0, length + 2);
		for (l = r->old_text; l; l = l->next) {
			strcat (repl->from, l->text);
		}

		for (l = r->new_text, length = 0; l; l = l->next) {
			length += (int)strlen (l->text);
		}
		repl->to = cobc_malloc (length + 2);
		memset (repl->to, 0, length + 2);
		for (l = r->new_text; l; l = l->next) {
			strcat (repl->to, l->text);
		}

		if (cb_current_file->replace_tail) {
			cb_current_file->replace_tail->next = repl;
		}
		if (!cb_current_file->replace_head) {
			cb_current_file->replace_head = repl;
		}
		cb_current_file->replace_tail = repl;
	}
}

static void
switch_to_buffer (const int line, const char *file, const YY_BUFFER_STATE buffer)
{
	/* Reset file/line */
	cb_source_line = line;
	cb_source_file = cobc_plex_strdup (file);
	fprintf (yyout, "#line %d \"%s\"\n", line, file);
	/* Switch buffer */
	yy_switch_to_buffer (buffer);
}

static int
is_condition_directive_clause (const char *buff)
{
	while (buff && !isalpha (*buff)) {
		++buff;
	}

	return buff && (strncmp (buff, "END", 3) == 0
			|| strncmp (buff, "IF", 2) == 0
			|| strncmp (buff, "ELSE", 4) == 0
			|| strncmp (buff, "ELIF", 4) == 0
			|| strncmp (buff, "EVALUATE", 8) == 0
			|| strncmp (buff, "WHEN", 4) == 0);
}

static int
is_cobol_word_char (const char c)
{
	return c == '-' || c == '_' || isalnum (c);
}

static int
ppinput (char *buff, const size_t max_size)
{
	char	*bp;
	size_t	gotcr;
	size_t	line_overflow;
	size_t	continuation;
	int	ipchar;
	int	i;
	int	n;
	int	coln;
	struct list_skip *skip;
	const char	*paragraph_name;

	/* Read line(s) */

	continuation = 0;
start:
	if (unlikely (buffer_overflow ||
		     (newline_count + PPLEX_BUFF_LEN) >= max_size)) {
		if (need_continuation || continuation) {
			cb_plex_error (newline_count,
					_("buffer overrun - too many continuation lines"));
#if 0		/* CHECKME: does anything breaks if we don't fake EOF here? */
			return YY_NULL; /* fake eof (no further processing) */
#endif
		}
		if (newline_count < max_size) {
			memset (buff, '\n', newline_count);
			buff[newline_count] = 0;
			ipchar = (int)newline_count;
			newline_count = 0;
			buffer_overflow = 0;
			return ipchar;
		}
		buffer_overflow = 1;
		ipchar = max_size - 1;
		memset (buff, '\n', (size_t)ipchar);
		buff[ipchar] = 0;
		newline_count -= ipchar;
		return ipchar;
	}
	gotcr = 0;
	line_overflow = 0;
	ipchar = 0;
	for (n = 0; ipchar != '\n';) {
		if (unlikely (n == PPLEX_BUFF_LEN)) {
			if (line_overflow != 2) {
				line_overflow = 1;
			}
		}
		ipchar = getc (ppin);
		if (unlikely (ipchar == EOF)) {
			if (n > 0) {
				/* No end of line at end of file */
				break;
			}
			if (newline_count == 0) {
				return YY_NULL;
			}
			memset (buff, '\n', newline_count);
			buff[newline_count] = 0;
			ipchar = (int)newline_count;
			newline_count = 0;
			return ipchar;
		}
#ifndef	COB_EBCDIC_MACHINE
		if (unlikely (ipchar == 0x1A && !n)) {
			continue;
		}
#endif
		if (unlikely (gotcr)) {
			gotcr = 0;
			if (ipchar != '\n') {
				if (likely (line_overflow == 0)) {
					buff[n++] = '\r';
				} else {
					line_overflow = 2;
				}
			}
		}
		if (unlikely (ipchar == '\r')) {
			gotcr = 1;
			continue;
		}
		if (unlikely (ipchar == '\t')) {
			if (likely (line_overflow == 0)) {
				buff[n++] = ' ';
				while (n % cb_tab_width != 0) {
					buff[n++] = ' ';
				}
				if (unlikely (n > PPLEX_BUFF_LEN)) {
					n = PPLEX_BUFF_LEN;
				}
			}
			continue;
		}
		if (likely (line_overflow == 0)) {
			buff[n++] = (char)ipchar;
		} else if ((char)ipchar != ' ' && (char)ipchar != '\n') {
			line_overflow = 2;
		}
	}

	if (buff[n - 1] != '\n') {
		/* FIXME: cb_source_line is one too low when CB_FORMAT_FREE is used
		   [but only during ppinput() in pplex.l ?] - Workaround for now:
		   Temporary newline_count + 1
		*/
		if (cb_source_format == CB_FORMAT_FREE) {
			if (line_overflow == 0) {
				cb_plex_warning (COBC_WARN_FILLER, newline_count + 1,
						 _("line not terminated by a newline"));
			} else if (line_overflow == 2) {
				cb_plex_warning (COBC_WARN_FILLER, newline_count + 1,
						 _("source text exceeds %d bytes, will be truncated"), PPLEX_BUFF_LEN);
			}
		} else {
			if (line_overflow == 0) {
				cb_plex_warning (COBC_WARN_FILLER, newline_count,
						 _("line not terminated by a newline"));
			} else if (line_overflow == 2) {
				cb_plex_warning (COBC_WARN_FILLER, newline_count,
						 _("source text exceeds %d bytes, will be truncated"), PPLEX_BUFF_LEN);
			}
		}
		buff[n++] = '\n';
	}
	buff[n] = 0;

	if (cb_source_format == CB_FORMAT_FREE) {
		bp = buff;
	} else {
		if (n < 8) {
			/* Line too short */
			newline_count++;
			goto start;
		}

		if (cb_flag_mfcomment) {
			if (buff[0] == '*' || buff[0] == '/') {
				newline_count++;
				goto start;
			}
		}

		/* Check if text is longer than cb_text_column */
		if (cb_source_format == CB_FORMAT_FIXED
		    && n > cb_text_column + 1) {
			/* Show warning if it is not whitespace
			   (postponed after checking for comments by setting
			    line_overflow to first column that leads to
				"source text too long")
			*/
			if (cb_warn_column_overflow && line_overflow == 0) {
				for (coln = cb_text_column; coln < n; ++coln) {
					if (buff[coln] != ' ' && buff[coln] != '\n') {
						line_overflow = coln;
						break;
					}
				}
			} else {
				line_overflow = 0;
			}
			/* Remove it */
			buff[cb_text_column] = '\n';
			buff[cb_text_column + 1] = 0;
			n = cb_text_column + 1;
		} else {
			line_overflow = 0;
		}

		memset (buff, ' ', (size_t)6);
		/* Note we allow directive lines to start at column 7 */
		bp = &buff[6];

		/* Special case: acucomment must be checked here as we'd pass comments
		   as directives otherwise */
		if (cb_flag_acucomment && buff[6] == '$') {
			buff[6] = '*';
		}
	}

	/* Check for directives/floating comment at first non-space of line */
	ipchar = 0;
	for (; *bp; bp++) {
		if (*bp != ' ') {
			if ((*bp == '$' && bp[1] != ' ') || (*bp == '>' && bp[1] == '>')) {
				/* Directive */
				ipchar = 1;
			} else if ((*bp == '*' && bp[1] == '>')
			           || (cb_flag_acucomment && *bp == '|')) {
				/* Float comment */
				newline_count++;
				goto start;
			}
			break;
		}
	}
	if (ipchar && (!plex_skip_input
		       || is_condition_directive_clause (bp))) {
		/* Directive - pass complete line with NL to ppparse */
		if (newline_count) {
			/* Move including NL and NULL byte */
			memmove (buff + newline_count, buff, (size_t)(n + 1));
			memset (buff, '\n', newline_count);
			n += newline_count;
			newline_count = 0;
		}
		return n;
	}

	if (plex_skip_input) {
		/* Skipping input */
		newline_count++;
		if (cb_src_list_file) {
			skip = cobc_malloc (sizeof (struct list_skip));
			memset (skip, 0, sizeof (struct list_skip));
			skip->skipline = cb_source_line + (int)newline_count;

			if (cb_current_file->skip_tail) {
				cb_current_file->skip_tail->next = skip;
			}
			cb_current_file->skip_tail = skip;

			if (!cb_current_file->skip_head) {
				cb_current_file->skip_head = skip;
			}
		}
		goto start;
	}

	/*
	  Check that line isn't start of ID DIVISION comment paragraph.
	*/
	if (comment_allowed) {
		if (!strncasecmp (bp, "AUTHOR", 6)) {
			paragraph_name = "AUTHOR";
		} else if (!strncasecmp (bp, "DATE-WRITTEN", 12)) {
			paragraph_name = "DATE-WRITTEN";
		} else if (!strncasecmp (bp, "DATE-MODIFIED", 13)) {
			paragraph_name = "DATE-MODIFIED";
		} else if (!strncasecmp (bp, "DATE-COMPILED", 13)) {
			paragraph_name = "DATE-COMPILED";
		} else if (!strncasecmp (bp, "INSTALLATION", 12)) {
			paragraph_name = "INSTALLATION";
		} else if (!strncasecmp (bp, "REMARKS", 7)) {
			paragraph_name = "REMARKS";
		} else if (!strncasecmp (bp, "SECURITY", 8)) {
			paragraph_name = "SECURITY";
		} else {
			paragraph_name = NULL;
		}

		if (paragraph_name
		    && !is_cobol_word_char (bp[strlen (paragraph_name)])) {
			cb_plex_verify (newline_count, cb_comment_paragraphs,
					paragraph_name);
			/* Skip comments until the end of line. */
			within_comment = 1;
			++newline_count;
			goto start;
		}
	}

	/* Return when free format (no floating comments removed!) */
	if (cb_source_format == CB_FORMAT_FREE) {
		within_comment = 0;
		if (newline_count) {
			memmove (buff + newline_count, buff, (size_t)(n + 1));
			memset (buff, '\n', newline_count);
			n += newline_count;
			newline_count = 0;
		}
		return n;
	}

	/* Fixed format */

	/* Check the indicator (column 7) */
	switch (buff[6]) {
	case ' ':
		break;
	case '-':
		if (unlikely (within_comment)) {
			cb_plex_error (newline_count,
					_("invalid continuation in comment entry"));
			newline_count++;
			goto start;
		} else if (!need_continuation) {
			cb_plex_verify (newline_count, cb_word_continuation,
					_("continuation of COBOL words"));
		}
		continuation = 1;
		break;
	case 'd':
	case 'D':
		/* Debugging line */
		(void) cb_verify (cb_debugging_mode, _("debugging indicator"));
		if (cb_flag_debugging_line) {
			break;
		}
		newline_count++;
		goto start;
	case '*':
	case '/':
		/* Comment line */
		newline_count++;
		goto start;
	default:
		/* Invalid indicator */
		cb_plex_error (newline_count,
				_("invalid indicator '%c' at column 7"), buff[6]);
		newline_count++;
		/* Treat as comment line instead of aborting compilation */
		goto start;
	}

	/* Skip comments that follow after AUTHORS, etc. */
	if (unlikely (within_comment)) {
		/* Check all of "Area A" */
		for (ipchar = 7; ipchar < (n - 1) && ipchar < 11; ++ipchar) {
			if (buff[ipchar] != ' ') {
				ipchar = 0;
				break;
			}
		}
		if (ipchar) {
			newline_count++;
			goto start;
		}
		within_comment = 0;
	}

	/* Skip blank lines */
	for (i = 7; buff[i] == ' '; ++i) {
		;
	}

	if (buff[i] == '\n') {
		newline_count++;
		goto start;
	}

	buff[6] = ' ';
	bp = buff + 7;

	if (unlikely (continuation)) {
		/* Line continuation */
		need_continuation = 0;
		for (; *bp == ' '; ++bp) {
			;
		}
		/* Validate concatenation */
		if (consecutive_quotation) {
			if (bp[0] == quotation_mark && bp[1] == quotation_mark) {
				bp++;
			} else {
				cb_plex_error (newline_count,
						_("invalid line continuation"));
				return YY_NULL;
			}
			quotation_mark = 0;
			consecutive_quotation = 0;
		} else if (quotation_mark) {
			/* Literal concatenation */
			if (*bp == quotation_mark) {
				bp++;
			} else {
				cb_plex_error (newline_count,
						_("invalid line continuation"));
				return YY_NULL;
			}
		}
	} else {
		/* Normal line */
		if (need_continuation) {
			cb_plex_error (newline_count,
					_("continuation character expected"));
			need_continuation = 0;
		}
		quotation_mark = 0;
		consecutive_quotation = 0;
	}

	/* Check if string literal is to be continued */
	for (i = bp - buff; buff[i] != '\n'; ++i) {
		/* Pick up floating comment and force loop exit */
		if (!quotation_mark && ((buff[i] == '*' && buff[i + 1] == '>') ||
			                    (cb_flag_acucomment && buff[i] == '|') ) ) {
			/* remove indicator "source text too long" if the column
			   leading to the indicator comes after the floating comment
			*/
			if (i < cb_text_column) {
				line_overflow = 0;
			}
			/* Set to null, 'i' is predecremented further below */
			buff[i] = 0;
			break;
		} else if (buff[i] == '\'' || buff[i] == '"') {
			if (quotation_mark == 0) {
				/* Literal start */
				quotation_mark = buff[i];
			} else if (quotation_mark == buff[i]) {
				if (i == cb_text_column - 1) {
					/* Consecutive quotation */
					consecutive_quotation = 1;
				} else {
					/* Literal end */
					quotation_mark = 0;
				}
			}
		}
	}

	if (unlikely (quotation_mark)) {
		/* Expecting continuation */
		if (!consecutive_quotation) {
			need_continuation = 1;
		}
		for (; i < cb_text_column;) {
			buff[i++] = ' ';
		}
		buff[i] = 0;
	} else {
		/* Truncate trailing spaces, including the newline */
		for (i--; i >= 0 && buff[i] == ' '; i--) {
			;
		}
		if (i < 0) {
			/* Empty line after removing floating comment */
			newline_count++;
			goto start;
		}
		if (buff[i] == '\'' || buff[i] == '\"') {
			buff[++i] = ' ';
		}
		buff[i + 1] = 0;
	}

	/* Show warning if text is longer than cb_text_column
	   and not whitespace (postponed here) */
	if (line_overflow != 0) {
		cb_plex_warning (COBC_WARN_FILLER, newline_count,
				 _("source text after program-text area (column %d)"),
				cb_text_column);
	}

	if (unlikely (continuation)) {
		gotcr = strlen (bp);
		memmove (buff, bp, gotcr + 1);
		newline_count++;
	} else {
		/* Insert newlines at the start of the buffer */
		gotcr = strlen (buff);
		if (newline_count != 0) {
			memmove (buff + newline_count, buff, gotcr + 1);
			memset (buff, '\n', newline_count);
			gotcr += newline_count;
		}
		newline_count = 1;
	}
	return (int)gotcr;
}

static struct cb_text_list *
pp_text_list_add (struct cb_text_list *list, const char *text,
		  const size_t size)
{
	struct cb_text_list	*p;
	void			*tp;

	p = cobc_plex_malloc (sizeof (struct cb_text_list));
	tp = cobc_plex_malloc (size + 1);
	memcpy (tp, text, size);
	p->text = tp;
	if (!list) {
		p->last = p;
		return p;
	}
	list->last->next = p;
	list->last = p;
	return list;
}

static void
ppecho (const char *text, const cob_u32_t alt_space, const int textlen)
{
	struct cb_replace_list		*r;
	struct cb_replace_list		*save_ptr;
	const struct cb_text_list	*lno;
	struct cb_text_list		*queue;
	struct cb_text_list		*save_queue;
	const char			*s;
	char				*temp_ptr;
	size_t				size;
	size_t				size2;

	/* Check for replacement text before outputting */
	if (alt_space) {
		s = yytext;
	} else {
		s = text;
	}

	if (text_queue == NULL && (text[0] == ' ' || text[0] == '\n')) {
		/* No replacement */
		fwrite (text, (size_t)textlen, (size_t)1, ppout);
		if (cb_listing_file) {
			check_listing (s, 0);
		}
		return;
	}
	if (!current_replace_list && !base_replace_list) {
		/* Ouput queue */
		for (; text_queue; text_queue = text_queue->next) {
			fputs (text_queue->text, ppout);
		}
		fwrite (text, (size_t)textlen, (size_t)1, ppout);
		if (cb_listing_file) {
			check_listing (s, 0);
		}
		return;
	}
	if (!current_replace_list) {
		current_replace_list = base_replace_list;
		save_ptr = NULL;
	} else {
		current_replace_list->last->next = base_replace_list;
		save_ptr = current_replace_list->last;
	}

	/* Do replacement */
	text_queue = pp_text_list_add (text_queue, text, (size_t)textlen);

	save_queue = NULL;
	size = 0;
	size2 = 0;
	for (r = current_replace_list; r; r = r->next) {
		queue = text_queue;
		/* The LEADING/TRAILING code looks peculiar as we use */
		/* variables after breaking out of the loop BUT */
		/* ppparse.y guarantees that we have only one token */
		/* and therefore only one iteration of this loop */
		for (lno = r->old_text; lno; lno = lno->next) {
			if (lno->text[0] == ' ' || lno->text[0] == '\n') {
				continue;
			}
			while (queue && (queue->text[0] == ' ' ||
			       queue->text[0] == '\n')) {
				queue = queue->next;
			}
			if (queue == NULL) {
				/* Partial match */
				if (!save_ptr) {
					current_replace_list = NULL;
				} else {
					save_ptr->next = NULL;
				}
				return;
			}
			if (r->lead_trail == CB_REPLACE_LEADING) {
				/* Check leading text */
				size = strlen (lno->text);
				if (strncasecmp (lno->text, queue->text, size)) {
					/* No match */
					break;
				}
				save_queue = queue;
			} else if (r->lead_trail == CB_REPLACE_TRAILING) {
				/* Check trailing text */
				size = strlen (lno->text);
				size2 = strlen (queue->text);
				if (size2 < size) {
					/* No match */
					break;
				}
				size2 -= size;
				if (strncasecmp (lno->text, queue->text + size2, size)) {
					/* No match */
					break;
				}
				save_queue = queue;
			} else if (strcasecmp (lno->text, queue->text)) {
				/* No match */
				break;
			}
			queue = queue->next;
		}
		if (lno == NULL) {
			/* Match */
			if (r->lead_trail == CB_REPLACE_TRAILING
				&& save_queue /* <- silence warnings */) {
				/* Non-matched part of original text */
				fprintf (ppout, "%*.*s", (int)size2, (int)size2,
					 save_queue->text);
				if (cb_listing_file) {
					temp_ptr = cobc_strdup (save_queue->text);
					*(temp_ptr + size2) = 0;
					check_listing (temp_ptr, 0);
					cobc_free (temp_ptr);
				}
			}
			for (lno = r->new_text; lno; lno = lno->next) {
				fputs (lno->text, ppout);
				if (cb_listing_file) {
					check_listing (lno->text, 0);
				}
			}
			if (r->lead_trail == CB_REPLACE_LEADING
				&& save_queue /* <- silence warnings */) {
				/* Non-matched part of original text */
				fputs (save_queue->text + size, ppout);
				if (cb_listing_file) {
					check_listing (save_queue->text + size, 0);
				}
			}
			text_queue = queue;
			continue;
		}
	}

	/* No match */
	for (; text_queue; text_queue = text_queue->next) {
		fputs (text_queue->text, ppout);
		if (cb_listing_file) {
			check_listing (text_queue->text, 0);
		}
	}
	if (!save_ptr) {
		current_replace_list = NULL;
	} else {
		save_ptr->next = NULL;
	}
}

static void
skip_to_eol (void)
{
	int	c;

	/* Skip bytes to end of line */
	while ((c = input ()) != EOF) {
		if (c == '\n') {
			break;
		}
	}
	if (c != EOF) {
		unput (c);
	}
}

static void
display_finish (void) {
	int msglen;
	if (!plex_skip_input) {
		msglen = strlen (msg) - 1;
		while (msglen != 0 && msg[msglen] == ' ') {
			msg[msglen--] = 0;
		}
		puts (msg);
		msg[0] = 0;
	}
	unput ('\n');
}

static void
check_listing (const char *text, const unsigned int comment)
{
	const char	*s;
	char		c;

	/* Check for listing */
	if (!cb_listing_file) {
		/* Nothing to do */
		return;
	}
	if (!text) {
		return;
	}
	if (cobc_gen_listing == 2) {
		/* LCOV_EXCL_START */
		/* Passed to cobxref */
		fputs (text, cb_listing_file);
		return;
		/* LCOV_EXCL_STOP */
	}
	if (comment) {
		c = '*';
	} else {
		c = ' ';
	}

	if (requires_listing_line) {
		if (requires_new_line) {
			requires_new_line = 0;
			putc ('\n', cb_listing_file);
		}
		fprintf (cb_listing_file, "%6d%c", ++listing_line, c);
	}

	if (requires_listing_line && cb_source_format != CB_FORMAT_FREE &&
	    strlen (text) > 6) {
		s = &text[6];
	} else {
		s = text;
	}
	fputs (s, cb_listing_file);
	if (strchr (text, '\n')) {
		requires_listing_line = 1;
	} else {
		requires_listing_line = 0;
	}
}
