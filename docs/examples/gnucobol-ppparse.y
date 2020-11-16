/*
   Copyright (C) 2001-2012, 2015-2017 Free Software Foundation, Inc.
   Written by Keisuke Nishida, Roger While, Simon Sobisch

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


%expect 0

%defines
%error-verbose
%verbose
%name-prefix="pp" // recent versions want %api.prefix "pp", older cannot compile this

/* NOTE:
   support without = was added in Bison 2.4 (released 2008-11-02, we currently use 2.3),
   bison 3.0 (released 2013-07-25) added a warning if with = is used
*/

%{
#include "config.h"

#include <stdio.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define	COB_IN_PPPARSE	1
#include "cobc.h"
#include "tree.h"

#ifndef	_STDLIB_H
#define	_STDLIB_H 1
#endif

#define pperror(x)	cb_error ("%s", x)

#define COND_EQ		0
#define COND_LT		1U
#define COND_GT		2U
#define COND_LE		3U
#define COND_GE		4U
#define COND_NE		5U

/* Global variables */

int				current_call_convention;

/* Local variables */

static struct cb_define_struct	*ppp_setvar_list = NULL;
static unsigned int		current_cmd = 0;

#if	0	/* RXWRXW OPT */
static const char	* const compopts[] = {
	"ibm",
	"ibmcomp",
	"iso2002",
	"mf",
	"mfcomment",
	"sticky-linkage",
	"trunc",
	"noibmcomp",
	"nofold-copy-name",
	"nofoldcopyname",
	"nomfcomment",
	"nosticky-linkage",
	"notrunc"
};

static const char	* const varopts[] = {
	"fold-copy-name",
	"foldcopyname",
	"sourceformat",
	"trunc"
};
#endif

/* Local functions */

static char *
fix_filename (char *name)
{
	/* remove quotation from alphanumeric literals */
	if (name[0] == '\'' || name[0] == '\"') {
		name++;
		name[strlen (name) - 1] = 0;
	}
	return name;
}

static char *
fold_lower (char *name)
{
	unsigned char	*p;

	for (p = (unsigned char *)name; *p; p++) {
		if (isupper (*p)) {
			*p = (cob_u8_t)tolower (*p);
		}
	}
	return name;
}

static char *
fold_upper (char *name)
{
	unsigned char	*p;

	for (p = (unsigned char *)name; *p; p++) {
		if (islower (*p)) {
			*p = (cob_u8_t)toupper (*p);
		}
	}
	return name;
}

static struct cb_replace_list *
ppp_replace_list_add (struct cb_replace_list *list,
		     const struct cb_text_list *old_text,
		     const struct cb_text_list *new_text,
		     const unsigned int lead_or_trail)
{
	struct cb_replace_list *p;

	p = cobc_plex_malloc (sizeof (struct cb_replace_list));
	p->line_num = cb_source_line;
	p->old_text = old_text;
	p->new_text = new_text;
	p->lead_trail = lead_or_trail;
	if (!list) {
		p->last = p;
		return p;
	}
	list->last->next = p;
	list->last = p;
	return list;
}

static unsigned int
ppp_set_value (struct cb_define_struct *p, const char *value)
{
	const char	*s;
	size_t		size;
	unsigned int	dotseen;
	int		sign;
	int		int_part;
	int		dec_part;

	if (!value) {
		p->deftype = PLEX_DEF_NONE;
		p->value = NULL;
		p->sign = 0;
		p->int_part = 0;
		p->dec_part = 0;
		return 0;
	}

	if (*value == '"' || *value == '\'') {
		sign = *value;
		p->value = cobc_plex_strdup (value + 1);
		size = strlen (p->value) - 1;
		if (sign != p->value[size]) {
			p->value = NULL;
			p->deftype = PLEX_DEF_NONE;
			return 1;
		}
		p->value[size] = 0;
		p->deftype = PLEX_DEF_LIT;
		p->sign = 0;
		p->int_part = 0;
		p->dec_part = 0;
		return 0;
	}

	p->value = cobc_plex_strdup (value);
	p->deftype = PLEX_DEF_NUM;
	p->sign = 0;
	p->int_part = 0;
	p->dec_part = 0;

	sign = 0;
	if (*value == '+') {
		value++;
	} else if (*value == '-') {
		value++;
		sign = 1;
	}
	int_part = 0;
	dec_part = 0;
	size = 0;
	dotseen = 0;
	s = value;
	for ( ; *s; ++s, ++size) {
		if (*s == '.') {
			if (dotseen) {
				p->deftype = PLEX_DEF_NONE;
				return 1;
			}
			dotseen = 1;
			continue;
		}
		if (*s > '9' || *s < '0') {
			p->deftype = PLEX_DEF_NONE;
			return 1;
		}
		if (!dotseen) {
			int_part = (int_part * 10) + (*s - '0');
		} else {
			dec_part = (dec_part * 10) + (*s - '0');
		}
	}

	if (!int_part && !dec_part) {
		sign = 0;
	}
	p->sign = sign;
	p->int_part = int_part;
	p->dec_part = dec_part;
	return 0;
}

static unsigned int
ppp_compare_vals (const struct cb_define_struct *p1,
		 const struct cb_define_struct *p2,
		 const unsigned int cond)
{
	int	result;

	if (!p1 || !p2) {
		return 0;
	}
	if (p1->deftype != PLEX_DEF_LIT && p1->deftype != PLEX_DEF_NUM) {
		return 0;
	}
	if (p2->deftype != PLEX_DEF_LIT && p2->deftype != PLEX_DEF_NUM) {
		return 0;
	}
	if (p1->deftype != p2->deftype) {
		cb_warning (COBC_WARN_FILLER, _("directive comparison on different types"));
		return 0;
	}
	if (p1->deftype == PLEX_DEF_LIT) {
		result = strcmp (p1->value, p2->value);
	} else {
		if (p1->sign && !p2->sign) {
			result = -1;
		} else if (!p1->sign && p2->sign) {
			result = 1;
		} else if (p1->int_part < p2->int_part) {
			if (p1->sign) {
				result = 1;
			} else {
				result = -1;
			}
		} else if (p1->int_part > p2->int_part) {
			if (p1->sign) {
				result = -1;
			} else {
				result = 1;
			}
		} else if (p1->dec_part < p2->dec_part) {
			if (p1->sign) {
				result = 1;
			} else {
				result = -1;
			}
		} else if (p1->dec_part > p2->dec_part) {
			if (p1->sign) {
				result = -1;
			} else {
				result = 1;
			}
		} else {
			result = 0;
		}
	}
	switch (cond) {
	case COND_EQ:
		return (result == 0);
	case COND_LT:
		return (result < 0);
	case COND_GT:
		return (result > 0);
	case COND_LE:
		return (result <= 0);
	case COND_GE:
		return (result >= 0);
	case COND_NE:
		return (result != 0);
	default:
		break;
	}
	return 0;
}

static struct cb_define_struct *
ppp_define_add (struct cb_define_struct *list, const char *name,
	       const char *text, const unsigned int override)
{
	struct cb_define_struct	*p;
	struct cb_define_struct	*l;

	/* Check duplicate */
	for (l = list; l; l = l->next) {
		if (!strcasecmp (name, l->name)) {
			if (!override && l->deftype != PLEX_DEF_DEL) {
				cb_error (_("duplicate DEFINE directive '%s'"), name);
				return NULL;
			}
			if (l->value) {
				l->value = NULL;
			}
			if (ppp_set_value (l, text)) {
				cb_error (_("invalid constant in DEFINE directive"));
				return NULL;
			}
			return list;
		}
	}

	p = cobc_plex_malloc (sizeof (struct cb_define_struct));
	p->name = cobc_plex_strdup (name);
	if (ppp_set_value (p, text)) {
		cb_error (_("invalid constant in DEFINE directive"));
		return NULL;
	}

	if (!list) {
		p->last = p;
		return p;
	}
	list->last->next = p;
	list->last = p;
	return list;
}

static void
ppp_define_del (const char *name)
{
	struct cb_define_struct	*l;

	for (l = ppp_setvar_list; l; l = l->next) {
		if (!strcmp (name, l->name)) {
			l->deftype = PLEX_DEF_DEL;
			if (l->value) {
				l->value = NULL;
			}
			l->sign = 0;
			l->int_part = 0;
			l->dec_part = 0;
			break;
		}
	}
}

void
ppp_clear_lists ( void )
{
	ppp_setvar_list = NULL;
}

struct cb_define_struct *
ppp_search_lists (const char *name)
{
	struct cb_define_struct	*p;

	for (p = ppp_setvar_list; p; p = p->next) {
		if (p->name == NULL) {
			continue;
		}
		if (!strcasecmp (name, p->name)) {
			if (p->deftype != PLEX_DEF_DEL) {
				return p;
			}
			break;
		}
	}
	return NULL;
}

static struct cb_text_list *
ppp_list_add (struct cb_text_list *list, const char *text)
{
	struct cb_text_list	*p;

	p = cobc_plex_malloc (sizeof (struct cb_text_list));
	p->text = cobc_plex_strdup (text);
	if (!list) {
		p->last = p;
		return p;
	}
	list->last->next = p;
	list->last = p;
	return list;
}

static unsigned int
ppp_search_comp_vars (const char *name)
{
#undef	CB_PARSE_DEF
#define	CB_PARSE_DEF(x,z)	if (!strcasecmp (name, x)) return (z);
#include "ppparse.def"
#undef	CB_PARSE_DEF
	return 0;
}

static unsigned int
ppp_check_needs_quote (const char *envval)
{
	const char	*s;
	size_t		size;
	unsigned int	dot_seen;
	unsigned int	sign_seen;

	/* Non-quoted value - Check if possible numeric */
	dot_seen = 0;
	sign_seen = 0;
	size = 0;
	s = envval;
	if (*s == '+' || *s == '-') {
		sign_seen = 1;
		size++;
		s++;
	}
	for (; *s; ++s) {
		if (*s == '.') {
			if (dot_seen) {
				break;
			}
			dot_seen = 1;
			size++;
			continue;
		}
		if (*s > '9' || *s < '0') {
			break;
		}
		size++;
	}

	if (*s || size <= (dot_seen + sign_seen)) {
		return 1;
	}
	return 0;
}

/* Global functions */

void
ppparse_clear_vars (const struct cb_define_struct *p)
{
	const struct cb_define_struct	*q;

	ppp_setvar_list = NULL;
	/* Set standard DEFINE's */
	if (cb_perform_osvs) {
		ppp_setvar_list = ppp_define_add (ppp_setvar_list,
						  "PERFORM-TYPE",
						  "'OSVS'", 0);
	} else {
		ppp_setvar_list = ppp_define_add (ppp_setvar_list,
						  "PERFORM-TYPE",
						  "'MF'", 0);
	}
	if (cb_ebcdic_sign) {
		ppp_setvar_list = ppp_define_add (ppp_setvar_list,
						  "SIGN",
						  "'EBCDIC'", 0);
	} else {
		ppp_setvar_list = ppp_define_add (ppp_setvar_list,
						  "SIGN",
						  "'ASCII'", 0);
	}
#ifdef	WORDS_BIGENDIAN
	ppp_setvar_list = ppp_define_add (ppp_setvar_list,
					  "ENDIAN",
					  "'BIG'", 0);
#else
	ppp_setvar_list = ppp_define_add (ppp_setvar_list,
					  "ENDIAN",
					  "'LITTLE'", 0);
#endif
#if	' ' == 0x20
	ppp_setvar_list = ppp_define_add (ppp_setvar_list,
					  "CHARSET",
					  "'ASCII'", 0);
#elif	' ' == 0x40
	ppp_setvar_list = ppp_define_add (ppp_setvar_list,
					  "CHARSET",
					  "'EBCDIC'", 0);
#else
	ppp_setvar_list = ppp_define_add (ppp_setvar_list,
					  "CHARSET",
					  "'UNKNOWN'", 0);
#endif
	/* Set DEFINE's from '-D' option(s) */
	for (q = p; q; q = q->next) {
		ppp_setvar_list = ppp_define_add (ppp_setvar_list,
						  q->name,
						  q->value, 0);
	}
	/* reset CALL CONVENTION */
	current_call_convention = CB_CONV_COBOL;
}

%}

%union {
	char			*s;
	struct cb_text_list	*l;
	struct cb_replace_list	*r;
	struct cb_define_struct	*ds;
	unsigned int		ui;
	int			si;
};

%token TOKEN_EOF 0	"end of file"

%token ALSO
%token BY
%token COPY
%token EQEQ		"=="
%token IN
%token LAST
%token LEADING
%token OF
%token OFF
%token PRINTING
%token REPLACE
%token REPLACING
%token SUPPRESS
%token TRAILING
%token DOT		"."

%token GARBAGE		"word"

%token LISTING_DIRECTIVE
%token LISTING_STATEMENT
%token TITLE_STATEMENT

%token CONTROL_STATEMENT
%token SOURCE
%token NOSOURCE
%token LIST
%token NOLIST
%token MAP
%token NOMAP

%token LEAP_SECOND_DIRECTIVE

%token SOURCE_DIRECTIVE
%token FORMAT
%token IS
%token FIXED
%token FREE
%token VARIABLE

%token CALL_DIRECTIVE
%token COBOL
%token TOK_EXTERN		"EXTERN"
%token STDCALL
%token STATIC

%token DEFINE_DIRECTIVE
%token AS
%token PARAMETER
%token OVERRIDE

%token SET_DIRECTIVE
%token CONSTANT
%token SOURCEFORMAT
%token FOLDCOPYNAME
%token NOFOLDCOPYNAME

%token IF_DIRECTIVE
%token ELSE_DIRECTIVE
%token ENDIF_DIRECTIVE
%token ELIF_DIRECTIVE

%token GE		">="
%token LE		"<="
%token LT		"<"
%token GT		">"
%token EQ		"="
%token NE		"<>"
%token NOT
%token THAN
%token TO
%token OR
%token EQUAL
%token GREATER
%token LESS
%token SET
%token DEFINED

%token TURN_DIRECTIVE
%token ON
%token CHECKING
%token WITH
%token LOCATION

%token TERMINATOR	"end of line"

%token <s> TOKEN		"Identifier or Literal"
%token <s> VARIABLE_NAME	"Variable"
%token <s> LITERAL		"Literal"

%type <s>	copy_in

%type <l>	token_list
%type <l>	identifier
%type <l>	subscripts
%type <l>	text_src
%type <l>	text_dst
%type <l>	text_partial_src
%type <l>	text_partial_dst

%type <r>	copy_replacing
%type <r>	replacing_list

%type <ds>	object_id

%type <ui>	_override
%type <ui>	condition_clause
%type <ui>	_not
%type <ui>	_also
%type <ui>	_last
%type <ui>	lead_trail

%%

statement_list:
| statement_list statement
;

statement:
  copy_statement DOT
| replace_statement DOT
| directive TERMINATOR
| listing_statement
| CONTROL_STATEMENT control_options _dot TERMINATOR
  {
	CB_PENDING (_("*CONTROL statement"));
  }
;

directive:
  SOURCE_DIRECTIVE source_directive
| DEFINE_DIRECTIVE define_directive
| SET_DIRECTIVE set_directive
| TURN_DIRECTIVE turn_directive
| LISTING_DIRECTIVE listing_directive
| LEAP_SECOND_DIRECTIVE leap_second_directive
| IF_DIRECTIVE
  {
	current_cmd = PLEX_ACT_IF;
  }
  if_directive
| ELIF_DIRECTIVE
  {
	current_cmd = PLEX_ACT_ELIF;
  }
  if_directive
| ELSE_DIRECTIVE
  {
	plex_action_directive (PLEX_ACT_ELSE, 0);
  }
| ENDIF_DIRECTIVE
  {
	plex_action_directive (PLEX_ACT_END, 0);
  }
| CALL_DIRECTIVE
  {
	current_call_convention = 0;
  }
  call_directive
  {
	if (current_call_convention == CB_CONV_STATIC_LINK) {
		current_call_convention |= CB_CONV_COBOL;
	};
  }
  
;

set_directive:
  set_choice
| set_directive set_choice
;

set_choice:
  CONSTANT VARIABLE_NAME LITERAL
  {
	/* note: the old version was _as LITERAL but MF doesn't supports this */
	struct cb_define_struct	*p;

	p = ppp_define_add (ppp_setvar_list, $2, $3, 1);
	if (p) {
		ppp_setvar_list = p;
		fprintf (ppout, "#DEFLIT %s %s\n", $2, $3);
	}
  }
| VARIABLE_NAME set_options
| SOURCEFORMAT _as LITERAL
  {
	char	*p;
	size_t	size;
	int	quote;

	p = $3;
	if (*p == '\"' || *p == '\'') {
		quote = *p;
		p++;
		size = strlen (p) - 1;
		if (p[size] != quote) {
			cb_error (_("invalid %s directive"), "SOURCEFORMAT");
		}
		p[size] = 0;
	}
	if (!strcasecmp (p, "FIXED")) {
		cb_source_format = CB_FORMAT_FIXED;
		cb_text_column = cb_config_text_column;
	} else if (!strcasecmp (p, "FREE")) {
		cb_source_format = CB_FORMAT_FREE;
	} else if (!strcasecmp (p, "VARIABLE")) {
		cb_source_format = CB_FORMAT_FIXED;
		/* This is an arbitrary value; perhaps change later? */
		cb_text_column = 500;
	} else {
		cb_error (_("invalid %s directive"), "SOURCEFORMAT");
	}
	if (cb_src_list_file) {
		cb_current_file->source_format = cb_source_format;
	}
  }
| NOFOLDCOPYNAME
  {
	cb_fold_copy = 0;
  }
| FOLDCOPYNAME _as LITERAL
  {
	char	*p;
	size_t	size;
	int	quote;

	p = $3;
	if (*p == '\"' || *p == '\'') {
		quote = *p;
		p++;
		size = strlen (p) - 1;
		if (p[size] != quote) {
			cb_error (_("invalid %s directive"), "FOLD-COPY-NAME");
		}
		p[size] = 0;
	}
	if (!strcasecmp (p, "UPPER")) {
		cb_fold_copy = COB_FOLD_UPPER;
	} else if (!strcasecmp (p, "LOWER")) {
		cb_fold_copy = COB_FOLD_LOWER;
	} else {
		cb_error (_("invalid %s directive"), "FOLD-COPY-NAME");
	}
  }
;

set_options:
  /* empty */
  {
	fprintf (ppout, "#OPTION %s\n", $<s>0);
  }
| _as LITERAL
  {
	fprintf (ppout, "#OPTION %s %s\n", $<s>0, $2);
  }
;

source_directive:
  _format _is format_type
  {
	  if (cb_src_list_file) {
		  cb_current_file->source_format = cb_source_format;
	  }
  }
;

format_type:
  FIXED
  {
	cb_source_format = CB_FORMAT_FIXED;
	cb_text_column = cb_config_text_column;
  }
| FREE
  {
	cb_source_format = CB_FORMAT_FREE;
  }
| VARIABLE
  {
	cb_source_format = CB_FORMAT_FIXED;
	cb_text_column = 500;
  }
| GARBAGE
  {
	cb_error (_("invalid %s directive"), "SOURCE");
	YYERROR;
  }
;

define_directive:
  VARIABLE_NAME _as LITERAL _override
  {
	struct cb_define_struct	*p;

	p = ppp_define_add (ppp_setvar_list, $1, $3, $4);
	if (p) {
		ppp_setvar_list = p;
	}
  }
| VARIABLE_NAME _as PARAMETER _override
  {
	char			*s;
	char			*q;
	struct cb_define_struct	*p;
	size_t			size;

	s = getenv ($1);
	q = NULL;
	if (s && *s && *s != ' ') {
		if (*s == '"' || *s == '\'') {
			size = strlen (s) - 1U;
			/* Ignore if improperly quoted */
			if (s[0] == s[size]) {
				q = s;
			}
		} else {
			if (ppp_check_needs_quote (s)) {
				/* Alphanumeric literal */
				q = cobc_plex_malloc (strlen (s) + 4U);
				sprintf (q, "'%s'", s);
			} else {
				/* Numeric literal */
				q = s;
			}
		}
	}
	if (q) {
		p = ppp_define_add (ppp_setvar_list, $1, q, $4);
		if (p) {
			ppp_setvar_list = p;
		}
	}
  }
| VARIABLE_NAME _as OFF
  {
	ppp_define_del ($1);
  }
| CONSTANT VARIABLE_NAME _as LITERAL _override
  {
  /* OpenCOBOL/GnuCOBOL 2.0 extension: MF $SET CONSTANT in 2002+ style as
     >> DEFINE CONSTANT var [AS] literal  archaic extension:
     use plain  >> DEFINE var [AS] literal  for conditional compilation and
     use        01 CONSTANT with/without FROM clause  for constant definitions */
	struct cb_define_struct	*p;

	
	if (cb_verify (cb_define_constant_directive, ">> DEFINE CONSTANT var")) {
		p = ppp_define_add (ppp_setvar_list, $2, $4, $5);
		if (p) {
			ppp_setvar_list = p;
			fprintf (ppout, "#DEFLIT %s %s%s\n", $2, $4, $5 ? " OVERRIDE" : "");
		}
	}
  }
| variable_or_literal
  {
	cb_error (_("invalid %s directive"), "DEFINE/SET");
  }
;


listing_directive:
  /*  Note: processed in cobc.c */
  /* empty (ON implied) */
| ON
| OFF
;

listing_statement:
  LISTING_STATEMENT
| TITLE_STATEMENT LITERAL _dot TERMINATOR
;

control_options:
  control_option
| control_options control_option
;

control_option:
  SOURCE
| NOSOURCE
| LIST
| NOLIST
| MAP
| NOMAP
;

_dot:
| DOT
;

leap_second_directive:
/* empty (OFF implied) */
| ON
  {
	CB_PENDING (_("LEAP-SECOND ON directive"));
  }
| OFF
;

turn_directive:
  ec_list CHECKING on_or_off
  {
	CB_PENDING (_("TURN directive"));
  }
;

ec_list:
  VARIABLE_NAME
| ec_list VARIABLE_NAME
;

on_or_off:
  /* Empty */
| OFF
| ON with_loc
| with_loc
;

with_loc:
  WITH LOCATION
| LOCATION
;

call_directive:
  call_choice
| call_directive call_choice
;

call_choice:
  COBOL
  {
	current_call_convention |= CB_CONV_COBOL;
	current_call_convention &= ~CB_CONV_STDCALL;
  }
| TOK_EXTERN
  {
	current_call_convention &= ~CB_CONV_STDCALL;
	current_call_convention &= ~CB_CONV_COBOL;
  }
| STDCALL
  {
	current_call_convention |= CB_CONV_STDCALL;
	current_call_convention &= ~CB_CONV_COBOL;
  }
| STATIC
  {
	current_call_convention |= CB_CONV_STATIC_LINK;
  }
;

if_directive:
  VARIABLE_NAME _is _not DEFINED
  {
	unsigned int		found;

	found = (ppp_search_lists ($1) != NULL);
	plex_action_directive (current_cmd, found ^ $3);
  }
| VARIABLE_NAME _is _not SET
  {
	unsigned int		found;

	found = ppp_search_comp_vars ($1);
	plex_action_directive (current_cmd, found ^ $3);
  }
| VARIABLE_NAME _is _not condition_clause object_id
  {
	struct cb_define_struct	*p;
	unsigned int		found;

	found = 0;
	p = ppp_search_lists ($1);
	found = ppp_compare_vals (p, $5, $4);
	plex_action_directive (current_cmd, found ^ $3);
  }
| LITERAL _is _not condition_clause object_id
  {
	struct cb_define_struct	*p;
	unsigned int		found;

	found = 0;
	p = cobc_plex_malloc (sizeof (struct cb_define_struct));
	p->next = NULL;
	if (ppp_set_value (p, $1)) {
		cb_error (_("invalid constant"));
	} else {
		found = ppp_compare_vals (p, $5, $4);
	}
	plex_action_directive (current_cmd, found ^ $3);
  }
| variable_or_literal
  {
	cb_error (_("invalid %s directive"), "IF/ELIF");
  }
;

variable_or_literal:
  VARIABLE_NAME
| LITERAL
;

object_id:
  LITERAL
  {
	struct cb_define_struct	*p;

	p = cobc_plex_malloc (sizeof (struct cb_define_struct));
	p->next = NULL;
	if (ppp_set_value (p, $1)) {
		cb_error (_("invalid constant"));
		$$ = NULL;
	} else {
		$$ = p;
	}
  }
| VARIABLE_NAME
  {
	struct cb_define_struct	*p;

	p = ppp_search_lists ($1);
	if (p != NULL && p->deftype != PLEX_DEF_NONE) {
		$$ = p;
	} else {
		$$ = NULL;
	}
  }
;

condition_clause:
  GREATER _than OR EQUAL _to
  {
	$$ = COND_GE;
  }
| GREATER _than
  {
	$$ = COND_GT;
  }
| LESS _than OR EQUAL _to
  {
	$$ = COND_LE;
  }
| LESS _than
  {
	$$ = COND_LT;
  }
| EQUAL _to
  {
	$$ = COND_EQ;
  }
| GE
  {
	$$ = COND_GE;
  }
| GT
  {
	$$ = COND_GT;
  }
| LE
  {
	$$ = COND_LE;
  }
| LT
  {
	$$ = COND_LT;
  }
| EQ
  {
	$$ = COND_EQ;
  }
| NE
  {
	$$ = COND_NE;
  }
;

copy_statement:
  COPY TOKEN copy_in copy_suppress copy_replacing
  {
	fputc ('\n', ppout);
	$2 = fix_filename ($2);
	if (cb_fold_copy == COB_FOLD_LOWER) {
		$2 = fold_lower ($2);
	} else if (cb_fold_copy == COB_FOLD_UPPER) {
		$2 = fold_upper ($2);
	}
	if ($3) {
		$3 = fix_filename ($3);
		if (cb_fold_copy == COB_FOLD_LOWER) {
			$3 = fold_lower ($3);
		} else if (cb_fold_copy == COB_FOLD_UPPER) {
			$3 = fold_upper ($3);
		}
	}
	ppcopy ($2, $3, $5);
  }
;

copy_in:
  /* nothing */
  {
	$$ = NULL;
  }
| in_or_of TOKEN
  {
	$$ = $2;
  }
;

in_or_of:
  IN
| OF
;

copy_suppress:
| SUPPRESS _printing
;

copy_replacing:
  /* nothing */
  {
	$$ = NULL;
  }
| REPLACING replacing_list
  {
	$$ = $2;
  }
;

replace_statement:
  REPLACE _also replacing_list
  {
	pp_set_replace_list ($3, $2);
  }
| REPLACE _last OFF
  {
	pp_set_replace_list (NULL, $2);
  }
;

replacing_list:
  text_src BY text_dst
  {
	$$ = ppp_replace_list_add (NULL, $1, $3, 0);
  }
| lead_trail text_partial_src BY text_partial_dst
  {
	$$ = ppp_replace_list_add (NULL, $2, $4, $1);
  }
| replacing_list text_src BY text_dst
  {
	$$ = ppp_replace_list_add ($1, $2, $4, 0);
  }
| replacing_list lead_trail text_partial_src BY text_partial_dst
  {
	$$ = ppp_replace_list_add ($1, $3, $5, $2);
  }
;

text_src:
  EQEQ token_list EQEQ
  {
	$$ = $2;
  }
| identifier
  {
	$$ = $1;
  }
;

text_dst:
  EQEQ EQEQ
  {
	$$ = NULL;
  }
| EQEQ token_list EQEQ
  {
	$$ = $2;
  }
| identifier
  {
	$$ = $1;
  }
;

text_partial_src:
  EQEQ TOKEN EQEQ
  {
	$$ = ppp_list_add (NULL, $2);
  }
;

text_partial_dst:
  EQEQ EQEQ
  {
	$$ = NULL;
  }
| EQEQ TOKEN EQEQ
  {
	$$ = ppp_list_add (NULL, $2);
  }
;

token_list:
  TOKEN
  {
	$$ = ppp_list_add (NULL, $1);
  }
| token_list TOKEN
  {
	$$ = ppp_list_add ($1, $2);
  }
;

identifier:
  TOKEN
  {
	$$ = ppp_list_add (NULL, $1);
  }
| identifier IN TOKEN
  {
	$$ = ppp_list_add ($1, " ");
	$$ = ppp_list_add ($$, "IN");
	$$ = ppp_list_add ($$, " ");
	$$ = ppp_list_add ($$, $3);
  }
| identifier OF TOKEN
  {
	$$ = ppp_list_add ($1, " ");
	$$ = ppp_list_add ($$, "OF");
	$$ = ppp_list_add ($$, " ");
	$$ = ppp_list_add ($$, $3);
  }
| identifier '(' subscripts ')'
  {
	struct cb_text_list *l;

	$$ = ppp_list_add ($1, " ");
	$$ = ppp_list_add ($$, "(");
	$3 = ppp_list_add ($3, ")");
	for (l = $$; l->next; l = l->next) {
		;
	}
	l->next = $3;
  }
;

subscripts:
  TOKEN
  {
	$$ = ppp_list_add (NULL, $1);
  }
| subscripts TOKEN
  {
	$$ = ppp_list_add ($1, " ");
	$$ = ppp_list_add ($$, $2);
  }
;

lead_trail:
  LEADING
  {
	$$ = CB_REPLACE_LEADING;
  }
| TRAILING
  {
	$$ = CB_REPLACE_TRAILING;
  }
;

/* Optional keywords */

_override:
  /* empty */
  {
	$$ = 0;
  }
| OVERRIDE
  {
	$$ = 1U;
  }
;

_not:
  /* empty */
  {
	$$ = 0;
  }
| NOT
  {
	$$ = 1U;
  }
;

_also:
  /* empty */
  {
	$$ = 0;
  }
| ALSO
  {
	$$ = 1U;
  }
;

_last:
  /* empty */
  {
	$$ = 0;
  }
| LAST
  {
	$$ = 1U;
  }
;

_as:		| AS ;
_format:	| FORMAT ;
_is:		| IS ;
_printing:	| PRINTING ;
_than:		| THAN ;
_to:		| TO ;

%%
