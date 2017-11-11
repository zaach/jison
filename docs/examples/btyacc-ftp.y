// Example from btyacc3

/*
 * Copyright (c) 1985, 1988 Regents of the University of California.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms are permitted
 * provided that the above copyright notice and this paragraph are
 * duplicated in all such forms and that any documentation,
 * advertising materials, and other materials related to such
 * distribution and use acknowledge that the software was developed
 * by the University of California, Berkeley.  The name of the
 * University may not be used to endorse or promote products derived
 * from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND WITHOUT ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, WITHOUT LIMITATION, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.
 *
 *	@(#)ftpcmd.y	5.20.1.1 (Berkeley) 3/2/89
 */

/*
 * Grammar for FTP commands.
 * See RFC 959.
 */


%token
	A	B	C	E	F	I
	L	N	P	R	S	T

	SP	CRLF	COMMA	STRING	NUMBER

	USER	PASS	ACCT	REIN	QUIT	PORT
	PASV	TYPE	STRU	MODE	RETR	STOR
	APPE	MLFL	MAIL	MSND	MSOM	MSAM
	MRSQ	MRCP	ALLO	REST	RNFR	RNTO
	ABOR	DELE	CWD		LIST	NLST	SITE
	STAT	HELP	NOOP	MKD		RMD		PWD
	CDUP	STOU	SMNT	SYST	SIZE	MDTM

	UMASK	IDLE	CHMOD

	LEXERR

%start	cmd_list

%%

cmd_list:	/* empty */
	|	cmd_list cmd
	|	cmd_list rcmd
	;

cmd:		USER SP username CRLF
	|	PASS SP password CRLF
	|	PORT SP host_port CRLF
	|	PASV CRLF
	|	TYPE SP type_code CRLF
	|	STRU SP struct_code CRLF
	|	MODE SP mode_code CRLF
	|	ALLO SP NUMBER CRLF
	|	ALLO SP NUMBER SP R SP NUMBER CRLF
	|	RETR check_login SP pathname CRLF
	|	STOR check_login SP pathname CRLF
	|	APPE check_login SP pathname CRLF
	|	NLST check_login CRLF
	|	NLST check_login SP STRING CRLF
	|	LIST check_login CRLF
	|	LIST check_login SP pathname CRLF
	|	STAT check_login SP pathname CRLF
	|	STAT CRLF
	|	DELE check_login SP pathname CRLF
	|	RNTO SP pathname CRLF
	|	ABOR CRLF
	|	CWD check_login CRLF
	|	CWD check_login SP pathname CRLF
	|	HELP CRLF
	|	HELP SP STRING CRLF
	|	NOOP CRLF
	|	MKD check_login SP pathname CRLF
	|	RMD check_login SP pathname CRLF
	|	PWD check_login CRLF
	|	CDUP check_login CRLF
	|	SITE SP HELP CRLF
	|	SITE SP HELP SP STRING CRLF
	|	SITE SP UMASK check_login CRLF
	|	SITE SP UMASK check_login SP octal_number CRLF
	|	SITE SP CHMOD check_login SP octal_number SP pathname CRLF
	|	SITE SP IDLE CRLF
	|	SITE SP IDLE SP NUMBER CRLF
	|	STOU check_login SP pathname CRLF
	|	SYST CRLF

		/*
		 * SIZE is not in RFC959, but Postel has blessed it and
		 * it will be in the updated RFC.
		 *
		 * Return size of file in a format suitable for
		 * using with RESTART (we just count bytes).
		 */
	|	SIZE check_login SP pathname CRLF

		/*
		 * MDTM is not in RFC959, but Postel has blessed it and
		 * it will be in the updated RFC.
		 *
		 * Return modification time of file as an ISO 3307
		 * style time. E.g. YYYYMMDDHHMMSS or YYYYMMDDHHMMSS.xxx
		 * where xxx is the fractional second (of any precision,
		 * not necessarily 3 digits)
		 */
	|	MDTM check_login SP pathname CRLF
	|	QUIT CRLF
	|	error CRLF
		{
			yyerrok;
		}
	;

rcmd:		RNFR check_login SP pathname CRLF
	;
		
username:	STRING
	;

password:	/* empty */
	|	STRING
	;

byte_size:	NUMBER
	;

host_port:	NUMBER COMMA NUMBER COMMA NUMBER COMMA NUMBER COMMA 
		NUMBER COMMA NUMBER
	;

form_code:	N
	|	T
	|	C
	;

type_code:	A
	|	A SP form_code
	|	E
	|	E SP form_code
	|	I
	|	L
	|	L SP byte_size
	/* this is for a bug in the BBN ftp */
	|	L byte_size
	;

struct_code:	F
	|	R
	|	P
	;

mode_code:	S
	|	B
	|	C
	;

pathname:	pathstring
	;

pathstring:	STRING
	;

octal_number:	NUMBER
	;

check_login:	/* empty */
	;

%%


const 	CMD	    = 0;	/* beginning of command */
const 	ARGS	= 1;	/* expect miscellaneous arguments */
const 	STR1	= 2;	/* expect SP followed by STRING */
const 	STR2	= 3;	/* expect STRING */
const 	OSTR	= 4;	/* optional SP then STRING */
const 	ZSTR1	= 5;	/* SP then optional STRING */
const 	ZSTR2	= 6;	/* optional STRING after SP */
const 	SITECMD	= 7;	/* SITE command */
const 	NSTR	= 8;	/* Number followed by a string */

//struct tab {
//	char	*name;
//	short	token;
//	short	state;
//	short	implemented;	/* 1 if command is implemented */
//	char	*help;
//};

const /* struct tab */ cmdtab = [		/* In order defined in RFC 765 */
	[ "USER", USER, STR1, 1,	"<sp> username" ],
	[ "PASS", PASS, ZSTR1, 1,	"<sp> password" ],
	[ "ACCT", ACCT, STR1, 0,	"(specify account)" ],
	[ "SMNT", SMNT, ARGS, 0,	"(structure mount)" ],
	[ "REIN", REIN, ARGS, 0,	"(reinitialize server state)" ],
	[ "QUIT", QUIT, ARGS, 1,	"(terminate service)", ],
	[ "PORT", PORT, ARGS, 1,	"<sp> b0, b1, b2, b3, b4" ],
	[ "PASV", PASV, ARGS, 1,	"(set server in passive mode)" ],
	[ "TYPE", TYPE, ARGS, 1,	"<sp> [ A | E | I | L ]" ],
	[ "STRU", STRU, ARGS, 1,	"(specify file structure)" ],
	[ "MODE", MODE, ARGS, 1,	"(specify transfer mode)" ],
	[ "RETR", RETR, STR1, 1,	"<sp> file-name" ],
	[ "STOR", STOR, STR1, 1,	"<sp> file-name" ],
	[ "APPE", APPE, STR1, 1,	"<sp> file-name" ],
	[ "MLFL", MLFL, OSTR, 0,	"(mail file)" ],
	[ "MAIL", MAIL, OSTR, 0,	"(mail to user)" ],
	[ "MSND", MSND, OSTR, 0,	"(mail send to terminal)" ],
	[ "MSOM", MSOM, OSTR, 0,	"(mail send to terminal or mailbox)" ],
	[ "MSAM", MSAM, OSTR, 0,	"(mail send to terminal and mailbox)" ],
	[ "MRSQ", MRSQ, OSTR, 0,	"(mail recipient scheme question)" ],
	[ "MRCP", MRCP, STR1, 0,	"(mail recipient)" ],
	[ "ALLO", ALLO, ARGS, 1,	"allocate storage (vacuously)" ],
	[ "REST", REST, ARGS, 0,	"(restart command)" ],
	[ "RNFR", RNFR, STR1, 1,	"<sp> file-name" ],
	[ "RNTO", RNTO, STR1, 1,	"<sp> file-name" ],
	[ "ABOR", ABOR, ARGS, 1,	"(abort operation)" ],
	[ "DELE", DELE, STR1, 1,	"<sp> file-name" ],
	[ "CWD",  CWD,  OSTR, 1,	"[ <sp> directory-name ]" ],
	[ "XCWD", CWD,	OSTR, 1,	"[ <sp> directory-name ]" ],
	[ "LIST", LIST, OSTR, 1,	"[ <sp> path-name ]" ],
	[ "NLST", NLST, OSTR, 1,	"[ <sp> path-name ]" ],
	[ "SITE", SITE, SITECMD, 1,	"site-cmd [ <sp> arguments ]" ],
	[ "SYST", SYST, ARGS, 1,	"(get type of operating system)" ],
	[ "STAT", STAT, OSTR, 1,	"[ <sp> path-name ]" ],
	[ "HELP", HELP, OSTR, 1,	"[ <sp> <string> ]" ],
	[ "NOOP", NOOP, ARGS, 1,	"" ],
	[ "MKD",  MKD,  STR1, 1,	"<sp> path-name" ],
	[ "XMKD", MKD,  STR1, 1,	"<sp> path-name" ],
	[ "RMD",  RMD,  STR1, 1,	"<sp> path-name" ],
	[ "XRMD", RMD,  STR1, 1,	"<sp> path-name" ],
	[ "PWD",  PWD,  ARGS, 1,	"(return current directory)" ],
	[ "XPWD", PWD,  ARGS, 1,	"(return current directory)" ],
	[ "CDUP", CDUP, ARGS, 1,	"(change to parent directory)" ],
	[ "XCUP", CDUP, ARGS, 1,	"(change to parent directory)" ],
	[ "STOU", STOU, STR1, 1,	"<sp> file-name" ],
	[ "SIZE", SIZE, OSTR, 1,	"<sp> path-name" ],
	[ "MDTM", MDTM, OSTR, 1,	"<sp> path-name" ],
	[ NULL,   0,    0,    0,	0 ]
];

const /* struct tab */ sitetab = [
	[ "UMASK", UMASK, ARGS, 1,	"[ <sp> umask ]" ],
	[ "IDLE", IDLE, ARGS, 1,	"[ <sp> maximum-idle-time ]" ],
	[ "CHMOD", CHMOD, NSTR, 1,	"<sp> mode <sp> file-name" ],
	[ "HELP", HELP, OSTR, 1,	"[ <sp> <string> ]" ],
	[ NULL,   0,    0,    0,	0 ]
];


var /* static int */ cpos, state;

function yylex()
{
	var /* char * */ cp, cp2;
	var /* struct tab * */ p;
	var n;
	var c;
	//char *copy();

	for (;;) {
		switch (state) {

		case CMD:
			signal(SIGALRM, toolong);
			alarm((unsigned) timeout);
			if (getline(cbuf, sizeof(cbuf)-1, stdin) == NULL) {
				reply(221, "You could at least say goodbye.");
				dologout(0);
			}
			alarm(0);
//#ifdef SETPROCTITLE
			if (strncasecmp(cbuf, "PASS", 4) != NULL)
				setproctitle("%s: %s", proctitle, cbuf);
//#endif /* SETPROCTITLE */
			if ((cp = index(cbuf, '\r'))) {
				cp[0] = '\n';
				cp[1] = '\0';
			}
			if ((cp = strpbrk(cbuf, " \n")))
				cpos = cp - cbuf;
			if (cpos == 0)
				cpos = 4;
			c = cbuf[cpos];
			cbuf[cpos] = '\0';
			upper(cbuf);
			p = lookup(cmdtab, cbuf);
			cbuf[cpos] = c;
			if (p != 0) {
				if (p.implemented == 0) {
					nack(p.name);
					longjmp(errcatch, 0);
					/* NOTREACHED */
				}
				state = p.state;
				yylval = p.name;
				return (p.token);
			}
			break;

		case SITECMD:
			if (cbuf[cpos] == ' ') {
				cpos++;
				return (SP);
			}
			cp = cbuf + cpos;
			if ((cp2 = strpbrk(cp, " \n")))
				cpos = cp2 - cbuf;
			c = cbuf[cpos];
			cbuf[cpos] = '\0';
			upper(cp);
			p = lookup(sitetab, cp);
			cbuf[cpos] = c;
			if (p != 0) {
				if (p.implemented == 0) {
					state = CMD;
					nack(p.name);
					longjmp(errcatch, 0);
					/* NOTREACHED */
				}
				state = p.state;
				yylval = p.name;
				return (p.token);
			}
			state = CMD;
			break;

		case OSTR:
			if (cbuf[cpos] == '\n') {
				state = CMD;
				return (CRLF);
			}
			/* FALLTHROUGH */

		case STR1:
		case ZSTR1:
dostr1:
			if (cbuf[cpos] == ' ') {
				cpos++;
				state = state == OSTR ? STR2 : ++state;
				return (SP);
			}
			break;

		case ZSTR2:
			if (cbuf[cpos] == '\n') {
				state = CMD;
				return (CRLF);
			}
			/* FALLTHROUGH */

		case STR2:
			cp = cbuf + cpos;
			n = strlen(cp);
			cpos += n - 1;
			/*
			 * Make sure the string is nonempty and \n terminated.
			 */
			if (n > 1 && cbuf[cpos] == '\n') {
				cbuf[cpos] = '\0';
				yylval = copy(cp);
				cbuf[cpos] = '\n';
				state = ARGS;
				return (STRING);
			}
			break;

		case NSTR:
			if (cbuf[cpos] == ' ') {
				cpos++;
				return (SP);
			}
			if (isdigit(cbuf[cpos])) {
				cp = cbuf + cpos;
				while (isdigit(cbuf[++cpos]))
					;
				c = cbuf[cpos];
				cbuf[cpos] = '\0';
				yylval = atoi(cp);
				cbuf[cpos] = c;
				state = STR1;
				return (NUMBER);
			}
			state = STR1;
// goto dostr1;
			break;

		case ARGS:
			if (isdigit(cbuf[cpos])) {
				cp = cbuf + cpos;
				while (isdigit(cbuf[++cpos]))
					;
				c = cbuf[cpos];
				cbuf[cpos] = '\0';
				yylval = atoi(cp);
				cbuf[cpos] = c;
				return (NUMBER);
			}
			switch (cbuf[cpos++]) {

			case '\n':
				state = CMD;
				return (CRLF);

			case ' ':
				return (SP);

			case ',':
				return (COMMA);

			case 'A':
			case 'a':
				return (A);

			case 'B':
			case 'b':
				return (B);

			case 'C':
			case 'c':
				return (C);

			case 'E':
			case 'e':
				return (E);

			case 'F':
			case 'f':
				return (F);

			case 'I':
			case 'i':
				return (I);

			case 'L':
			case 'l':
				return (L);

			case 'N':
			case 'n':
				return (N);

			case 'P':
			case 'p':
				return (P);

			case 'R':
			case 'r':
				return (R);

			case 'S':
			case 's':
				return (S);

			case 'T':
			case 't':
				return (T);

			}
			break;

		default:
			fatal("Unknown state in scanner.");
		}
		yyerror(NULL);
		state = CMD;
		longjmp(errcatch, 0);
	}
}

