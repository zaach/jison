%{{
  Next Delphi Yacc & Lex
  Copyright (c) 2013 by Roman Yankovsky <roman@yankovsky.me>
  Based on Delphi Yacc & Lex Version 1.4
  Based on Turbo Pascal Lex and Yacc Version 4.1

  Copyright (c) 1990-92   Albert Graef <ag@muwiinfa.geschichte.uni-mainz.de>
  Copyright (C) 1996      Berend de Boer <berend@pobox.com>
  Copyright (c) 1998      Michael Van Canneyt <Michael.VanCanneyt@fys.kuleuven.ac.be>
  Copyright (c) 2003-2004 Michiel Rook

  ## $Id: lexlib.pas 1697 2005-12-19 16:27:41Z druid $

  This library is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation; either
  version 2.1 of the License, or (at your option) any later version.

  This library is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public
  License along with this library; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
}

program ndyacc;
{$APPTYPE CONSOLE}
{$X+}
{$I-}
{$H-}
{$R+}
{$Q+}

{%File 'ndyacc.y'}

uses
  SysUtils,
  dlib,
  lexlib,
  yacclib,
  yaccbase,
  yaccmsgs,
  yaccsem,
  yacctabl,
  yaccpars;

%}

/* Lexical part of the Yacc language: */

%token
  ID		/* identifiers: {letter}{letter_or_digit}* */
  C_ID		/* identifier which forms left side of rule, i.e. is
		   followed by a colon */
  LITERAL       /* single character literal */
  LITID         /* multiple character literal */
  NUMBER	/* nonnegative integers: {digit}+ */
  PTOKEN PLEFT PRIGHT PNONASSOC PTYPE PSTART PPREC PUNION
  		/* reserved words: PTOKEN=%token, etc. */
  PP		/* source sections separator %% */
  LCURL		/* curly braces: %{ and %} */
  RCURL
  ',' ':' ';' '|' '{' '}' '<' '>' '='
		/* literals */
  ILLEGAL	/* illegal input character */

%start grammar

%%

/* Lexical entities, those that may give rise to syntax errors are augmented
   with error productions, and important symbols call yyerrok. */

id		: ID
c_id		: C_ID
literal         : LITERAL
litid           : LITID
number		: NUMBER
ptoken		: PTOKEN        { yyerrok; }
punion          : PUNION        { yyerrok; }
pleft		: PLEFT	        { yyerrok; }
pright		: PRIGHT        { yyerrok; }
pnonassoc	: PNONASSOC	{ yyerrok; }
ptype		: PTYPE	        { yyerrok; }
pstart		: PSTART        { yyerrok; }
pprec		: PPREC
pp		: PP	        { yyerrok; }
lcurl		: LCURL
rcurl		: RCURL
		| error	        { error(rcurl_expected); }
comma		: ','
colon		: ':'	        { yyerrok; }
semicolon	: ';'	        { yyerrok; }
bar		: '|'	        { yyerrok; }
lbrace		: '{'
rbrace		: '}'
		| error	        { error(rbrace_expected); }
langle		: '<'
rangle		: '>'
		| error         { error(rangle_expected); }
eq		: '='

/* Syntax and semantic routines: */

grammar		: defs pp
		  		{ sort_types;
                                  definitions;
                                  next_section; }
		  rules
		  		{ next_section;
                                  generate_parser;
                                  next_section; }
		  aux_procs
		;

aux_procs	: /* empty: aux_procs is optional */

		| pp { copy_rest_of_file; }

		;


defs		: /* empty */
		| defs def	{ yyerrok; }
		| defs error	{ error(error_in_def); }
		;

def		: pstart id
			 	{ startnt := ntsym($2); }
		| pstart error
				{ error(ident_expected); }
		| lcurl { copy_code; } rcurl

		| ptoken
				{ act_prec := 0; }
		  tag token_list

		| punion { copy_union_code; } '}'

		| pleft
				{ act_prec := new_prec_level(left); }
		  tag token_list

		| pright
				{ act_prec := new_prec_level(right); }
		  tag token_list

		| pnonassoc
				{ act_prec := new_prec_level(nonassoc); }
		  tag token_list

		| ptype tag nonterm_list

                | ptype tag

		;

tag		: /* empty: type tag is optional */
				{ act_type := 0; }
		| langle id rangle
				{ act_type := $2; add_type($2); }
		;

token_list	: token_num

		| token_list token_num
				{ yyerrok; }
		| token_list comma token_num
				{ yyerrok; }
		| error
				{ error(ident_expected); }
		| token_list error
				{ error(error_in_def); }
		| token_list comma error
				{ error(ident_expected); }
		;

token_num	: literal
				{ if act_type<>0 then
                                    sym_type^[$1] := act_type;
                                  if act_prec<>0 then
                                    sym_prec^[$1] := act_prec; }
               	| litid
				{ litsym($1, 0);
                                  if act_type<>0 then
                                    sym_type^[litsym($1, 0)] := act_type;
                                  if act_prec<>0 then
                                    sym_prec^[litsym($1, 0)] := act_prec; }
               	| id
				{ litsym($1, 0);
                                  if act_type<>0 then
                                    sym_type^[litsym($1, 0)] := act_type;
                                  if act_prec<>0 then
                                    sym_prec^[litsym($1, 0)] := act_prec; }
               	| litid number
				{ litsym($1, 0);
                                  if act_type<>0 then
                                    sym_type^[litsym($1, $2)] := act_type;
                                  if act_prec<>0 then
                                    sym_prec^[litsym($1, 0)]  := act_prec; }
               	| id number
				{ litsym($1, 0);
                                  if act_type<>0 then
                                    sym_type^[litsym($1, $2)] := act_type;
                                  if act_prec<>0 then
                                    sym_prec^[litsym($1, 0)]  := act_prec; }
		;

nonterm_list	: nonterm
		| nonterm_list nonterm
				{ yyerrok; }
		| nonterm_list comma nonterm
				{ yyerrok; }
		| error
				{ error(ident_expected); }
		| nonterm_list error
				{ error(error_in_def); }
		| nonterm_list comma error
				{ error(ident_expected); }
		;

nonterm		: id
				{ if act_type<>0 then
                                    sym_type^[ntsym($1)] := act_type; }
		;


rules		: 		{ next_section; }
		  rule1

		| lcurl { copy_code; } rcurl
				{ next_section; }
		  rule1
					/* rules section may be prefixed
					   with `local' Turbo Pascal
					   declarations */
		| rules rule
				{ yyerrok; }
		| error
				{ error(error_in_rule); }
		| rules error
				{ error(error_in_rule); }
		;

rule1		: c_id
				{ start_rule(ntsym($1)); }
		  colon
		  		{ start_body; }
		  body prec
				{ end_body; }
		;

rule		: rule1

		| bar
				{ start_body; }
		  body prec
				{ end_body; }
		;

body		: /* empty */

		| body literal
				{ add_symbol($2); yyerrok; }
		| body litid
				{ add_symbol(sym($2)); yyerrok; }
		| body id
				{ add_symbol(sym($2)); yyerrok; }
                | body action
				{ add_action; yyerrok; }
		| body error
				{ error(error_in_rule); }
		;

action		: lbrace { copy_action; } rbrace

		| eq { copy_single_action; }
                		/* old language feature; code must be
				   single statement ending with `;' */
		;

prec		: /* empty */

		| pprec literal
				{ add_rule_prec($2); }
		  opt_action

		| pprec litid
				{ add_rule_prec(litsym($2, 0)); }
		  opt_action

		| pprec id
				{ add_rule_prec(litsym($2, 0)); }
		  opt_action

		| prec semicolon

		;

opt_action	: /* empty */

		| action
				{ add_action; }
		;


%%

(* Lexical analyzer (implemented in Turbo Pascal for maximum efficiency): *)

function TLexer.parse() : integer;
  function end_of_input : boolean;
    begin
      end_of_input := (cno>length(line)) and eof(yyin)
    end(*end_of_input*);
  procedure scan;
    (* scan for nonempty character, skip comments *)
    procedure scan_comment;
      var p : integer;
      begin
        p := pos('*/', copy(line, cno, length(line)));
        if p>0 then
          cno := cno+succ(p)
        else
          begin
            while (p=0) and not eof(yyin) do
              begin
                readln(yyin, line);
                inc(lno);
                p := pos('*/', line)
              end;
            if p=0 then
              begin
                cno := succ(length(line));
                error(open_comment_at_eof);
              end
            else
              cno := succ(succ(p))
          end
      end(*scan_comment*);
    begin
      while not end_of_input do
        if cno<=length(line) then
          case line[cno] of
            ' ', tab : inc(cno);
            '/' :
              if (cno<length(line)) and (line[succ(cno)]='*') then
                begin
                  inc(cno, 2);
                  scan_comment
                end
              else
                exit
            else
              exit
          end
        else
          begin
            readln(yyin, line);
            inc(lno); cno := 1;
          end
    end(*scan*);
  function scan_ident : integer;
    (* scan an identifier *)
    var
      idstr : String;
    begin
      idstr := line[cno];
      inc(cno);
      while (cno<=length(line)) and (
            ('A'<=upCase(line[cno])) and (upCase(line[cno])<='Z') or
            ('0'<=line[cno]) and (line[cno]<='9') or
            (line[cno]='_') or
            (line[cno]='.') ) do
        begin
          idstr := idstr+line[cno];
          inc(cno)
        end;
      yylval := get_key(idstr);
      scan;
      if not end_of_input and (line[cno]=':') then
        scan_ident := C_ID
      else
        scan_ident := ID
    end(*scan_ident*);
  function scan_literal: integer;
    (* scan a literal, i.e. string *)
    var
      idstr : AnsiString;
      oct_val : Byte;
    begin
      idstr := line[cno];
      inc(cno);
      while (cno<=length(line)) and (line[cno]<>idstr[1]) do
        if line[cno]='\' then
          if cno<length(line) then
            begin
              inc(cno);
              case line[cno] of
                'n' :
                  begin
                    idstr := idstr+nl;
                    inc(cno)
                  end;
                'r' :
                  begin
                    idstr := idstr+cr;
                    inc(cno)
                  end;
                't' :
                  begin
                    idstr := idstr+tab;
                    inc(cno)
                  end;
                'b' :
                  begin
                    idstr := idstr+bs;
                    inc(cno)
                  end;
                'f' :
                  begin
                    idstr := idstr+ff;
                    inc(cno)
                  end;
                '0'..'7' :
                  begin
                    oct_val := ord(line[cno])-ord('0');
                    inc(cno);
                    while (cno<=length(line)) and
                          ('0'<=line[cno]) and
                          (line[cno]<='7') do
                      begin
                        oct_val := oct_val*8+ord(line[cno])-ord('0');
                        inc(cno)
                      end;
                    idstr := idstr+chr(oct_val)
                  end
                else
                  begin
                    idstr := idstr+line[cno];
                    inc(cno)
                  end
              end
            end
          else
            inc(cno)
        else
          begin
            idstr := idstr+line[cno];
            inc(cno)
          end;
      if cno>length(line) then
        error(missing_string_terminator)
      else
        inc(cno);
      if length(idstr)=2 then
        begin
          yylval := ord(idstr[2]);
          scan_literal := LITERAL;
        end
      else if length(idstr)>1 then
        begin
          yylval := get_key(''''+copy(idstr, 2, pred(length(idstr)))+'''');
          scan_literal := LITID;
        end
      else
        scan_literal := ILLEGAL;
    end(*scan_literal*);
  function scan_num : integer;
    (* scan an unsigned integer *)
    var
      numstr : String;
      code : integer;
    begin
      numstr := line[cno];
      inc(cno);
      while (cno<=length(line)) and
            ('0'<=line[cno]) and (line[cno]<='9') do
        begin
          numstr := numstr+line[cno];
          inc(cno)
        end;
      val(numstr, yylval, code);
      if code=0 then
        scan_num := NUMBER
      else
        scan_num := ILLEGAL;
    end(*scan_num*);
  function scan_keyword : integer;
    (* scan %xy *)
    function lookup(key : String; var tok : integer) : boolean;
      (* table of Yacc keywords (unstropped): *)
      const
        no_of_entries = 12;
        max_entry_length = 8;
        keys : array [1..no_of_entries] of AnsiString = (
          '0', '2', 'binary', 'left', 'nonassoc', 'prec', 'right',
          'start', 'term', 'token', 'type', 'union');
        toks : array [1..no_of_entries] of integer = (
          PTOKEN, PNONASSOC, PNONASSOC, PLEFT, PNONASSOC, PPREC, PRIGHT,
          PSTART, PTOKEN, PTOKEN, PTYPE, PUNION);
      var m, n, k : integer;
      begin
        (* binary search: *)
        m := 1; n := no_of_entries;
        lookup := true;
        while m<=n do
          begin
            k := m+(n-m) div 2;
            if key=keys[k] then
              begin
                tok := toks[k];
                exit
              end
            else if key>keys[k] then
              m := k+1
            else
              n := k-1
          end;
        lookup := false
      end(*lookup*);
    var
      keywstr : String;
      tok : integer;
    begin
      inc(cno);
      if cno<=length(line) then
        case line[cno] of
          '<' :
            begin
              scan_keyword := PLEFT;
              inc(cno)
            end;
          '>' :
            begin
              scan_keyword := PRIGHT;
              inc(cno)
            end;
          '=' :
            begin
              scan_keyword := PPREC;
              inc(cno)
            end;
          '%', '\' :
            begin
              scan_keyword := PP;
              inc(cno)
            end;
          '{' :
            begin
              scan_keyword := LCURL;
              inc(cno)
            end;
          '}' :
            begin
              scan_keyword := RCURL;
              inc(cno)
            end;
          'A'..'Z', 'a'..'z', '0'..'9' :
            begin
              keywstr := line[cno];
              inc(cno);
              while (cno<=length(line)) and (
                    ('A'<=upCase(line[cno])) and (upCase(line[cno])<='Z') or
                    ('0'<=line[cno]) and (line[cno]<='Z') ) do
                begin
                  keywstr := keywstr+line[cno];
                  inc(cno)
                end;
              if lookup(keywstr, tok) then
                scan_keyword := tok
              else
                scan_keyword := ILLEGAL
            end;
          else scan_keyword := ILLEGAL
        end
      else
        scan_keyword := ILLEGAL;
    end(*scan_keyword*);
  function scan_char : integer;
    (* scan any single character *)
    begin
      scan_char := ord(line[cno]);
      inc(cno)
    end(*scan_char*);
  var lno0, cno0 : integer;
  begin
    tokleng := 0;
    scan;
    lno0 := lno; cno0 := cno;
    if end_of_input then
      Result := 0
    else
      case line[cno] of
        'A'..'Z', 'a'..'z', '_' : Result := scan_ident;
        '''', '"' : Result := scan_literal;
        '0'..'9' : Result := scan_num;
        '%', '\' : Result := scan_keyword;
        '=' :
          if (cno<length(line)) and (line[succ(cno)]='{') then
            begin
              inc(cno);
              Result := scan_char
            end
          else
            Result := scan_char;
        else Result := scan_char;
      end;
    if lno=lno0 then
      tokleng := cno-cno0
  end(*yylex*);

(* Main program: *)

var
  i : Integer;
  lexer : TLexer;
  parser : TParser;
  readonlyflag : Boolean;
  Attrs : Integer;

procedure openCodFile();
begin
  (* search code template in /usr/share/dyacclex/ (on linux),
     then current directory, then on path where Lex
     was executed from: *)

  codfilepath := ExtractFilePath(ParamStr(0));

  {$IFDEF LINUX}
  codfilename := '/usr/share/dyacclex/yyparse.cod';
  Assign(yycod, codfilename);
  reset(yycod);

  if (IOResult = 0) then
    exit;
  {$ENDIF}

  codfilename := 'yyparse.cod';
  Assign(yycod, codfilename);
  reset(yycod);

  if (IOResult = 0) then
    exit;

  codfilename := codfilepath + 'yyparse.cod';
  Assign(yycod, codfilename);
  reset(yycod);

  if (IOResult = 0) then
    exit;

  fatal(cannot_open_file + 'yyparse.cod');
end;

begin
  readonlyflag := False;

  (* sign-on: *)

  writeln(sign_on);

  (* parse command line: *)

  if paramCount=0 then
    begin
      writeln;
      writeln(usage);
      writeln(options);
      halt(0);
    end;

  yfilename := '';
  pasfilename := '';

  for i := 1 to paramCount do
    if copy(paramStr(i), 1, 1)='-' then
      if UpperCase(paramStr(i))='-V' then
        verbose := true
      else if UpperCase(paramStr(i))='-R' then
        readonlyflag := true
      else if UpperCase(paramStr(i))='-D' then
        debug := true
      else
        begin
          writeln(invalid_option, paramStr(i));
          halt(1);
        end
    else if yfilename='' then
      yfilename := addExt(paramStr(i), 'y')
    else if pasfilename='' then
      pasfilename := addExt(paramStr(i), 'pas')
    else
      begin
        writeln(illegal_no_args);
        halt(1);
      end;

  if yfilename='' then
    begin
      writeln(illegal_no_args);
      halt(1);
    end;

  if pasfilename='' then pasfilename := root(yfilename)+'.pas';
  lstfilename := root(yfilename)+'.lst';

  (* open files: *)

{$WARN SYMBOL_PLATFORM OFF}
{$IFDEF MSWINDOWS}
  if readonlyflag then begin
    if FileExists(pasfilename) then begin
      Attrs := FileGetAttr(pasfilename);
      FileSetAttr(pasfilename, Attrs and not faReadOnly);
    end;
  end;
{$WARN SYMBOL_PLATFORM ON}
{$ENDIF}

  assign(yyin, yfilename);
  assign(yyout, pasfilename);
  assign(yylst, lstfilename);

  reset(yyin);    if ioresult<>0 then fatal(cannot_open_file+yfilename);
  rewrite(yyout); if ioresult<>0 then fatal(cannot_open_file+pasfilename);
  rewrite(yylst); if ioresult<>0 then fatal(cannot_open_file+lstfilename);

  openCodFile();

  (* parse source grammar: *)

  write('parse ... ');

  lno := 0; cno := 1; line := ''; yycodlno := 0;


  next_section;
  if debug then writeln(yyout, '{$DEFINE YYDEBUG}');
  if debug then writeln(yyout, '{$DEFINE YYEXTRADEBUG}');

  lexer := TLexer.Create();
  parser := TParser.Create();
  parser.lexer := lexer;

  if (parser.parse() = 0) then
    { done }
  else if parser.yychar=0 then
    error(unexpected_eof)
  else
    error(syntax_error);

  if errors=0 then writeln('DONE');

  (* close files: *)

  close(yyin); close(yyout); close(yylst); close(yycod);

{$WARN SYMBOL_PLATFORM OFF}
{$IFDEF MSWINDOWS}
  if readonlyflag then begin
    Attrs := FileGetAttr(pasfilename);
    FileSetAttr(pasfilename, Attrs or faReadOnly);
  end;
{$ENDIF}
{$WARN SYMBOL_PLATFORM ON}

  (* print statistics: *)

  if errors>0 then
    writeln( lno, ' lines, ',
             errors, ' errors found.' )
  else
    begin
      writeln( lno, ' lines, ',
               n_rules-1, '/', max_rules-1, ' rules, ',
               n_states, '/', max_states, ' s, ',
               n_items, '/', max_items, ' i, ',
               n_trans, '/', max_trans, ' t, ',
               n_redns, '/', max_redns, ' r.');
      if shift_reduce>0 then
        writeln(shift_reduce, ' shift/reduce conflicts.');
      if reduce_reduce>0 then
        writeln(reduce_reduce, ' reduce/reduce conflicts.');
      if never_reduced>0 then
        writeln(never_reduced, ' rules never reduced.');
    end;

  if warnings>0 then writeln(warnings, ' warnings.');

  (* terminate: *)

  if errors>0 then
    begin
      erase(yyout);
      if ioresult<>0 then ;
    end;

  if file_size(lstfilename)=0 then
    erase(yylst)
  else
    writeln('(see ', lstfilename, ' for more information)');

  halt(errors);

end(*Yacc*).
