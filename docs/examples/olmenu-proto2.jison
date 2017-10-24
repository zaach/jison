/* https://luv.asn.au/overheads/lex_yacc/examples/olmenu-proto2.y */

// %{
// #include <stdio.h>
// #include <unistd.h>
// #include <math.h>
// #include <string.h>
// static char rcsid[] = "$Id: olmenu-proto2.y,v 1.1.1.1 1999/09/26 12:34:39 mib Exp $";
// #define YYERROR_VERBOSE 1
// extern FILE *yyin;
// extern int errno;
// extern char *optarg;
// extern int optind, opterr, optopt;
// int yydebug;
// %}

%token       BACK_SELN
%token       COLUMNS
%token       DEFAULT
%token       DIRMENU
%token       END
%token       EXIT
%token       EXIT_NO_CONFIRM
%token       FLIPDRAG
%token       FLIPFOCUS
%token       FULL_RESTORE_SIZE_SELN
%token       INCLUDE
%token       MENU
%token       MOVE_DESKTOP
%token       NOP
%token       OPEN_CLOSE_SELN
%token       QUIT_SELN
%token       PIN
%token       PROPERTIES
%token       REFRESH
%token       REREAD_MENU_FILE
%token       RESTART
%token       SAVE_WORKSPACE
%token       SEPARATOR
%token       START_DSDM
%token       STICK_UNSTICK_SELN
%token       STOP_DSDM
%token       TITLE
%token       WINMENU
%token       WMEXIT
%token   LABEL
%token   EXEC
%token   INT

%type  <str> filename 
%type  <str> label
%type  <str> menu_command 

// %union {
//   char *str;
//   int  num;
// }
 
%start menufile

%%

menufile  : menu_items
        { @1; /* See: adding line numbers */ }
    ;
menu_items  : menu_item
    | menu_items menu_item
    ;
menu_item : menu_command
        { }
    | option       '\n'
    | SEPARATOR    '\n'
    | menu_file    '\n'
    | submenu
    |              '\n'
    | error        '\n'
        { printf("Invalid menu item at line %d\n",@1.first_line); }
    ;
menu_file : label default include filename
        { }
    ;
filename  : EXEC
    ;
include   : MENU
    | INCLUDE
    ;
submenu   : label default MENU '\n' menu_items end '\n'
        { }
    ;
default   : /* empty */
    | DEFAULT
    ;
end   : label END pin
        { }
    ;
pin   : /* emtpy */
    | PIN
    ;
menu_command  : label  default  EXEC '\n'
    | label  default  olvwm_cmd '\n'
    | label  default  olvwm_cmd_arg '\n'
    | label  error '\n'
        { printf("Invalid menu item (%s) at line %d is invalid\n",
            $1,@1.first_line);
        }
    ;
option    : COLUMNS  INT
        { }
    | TITLE  pin
        { }
    ;
label   : LABEL
    | '<'  LABEL  '>'
        { $$=$2; }
    | '<'  error  '>'
        { printf("Bad icon-label at line %d\n",
            @1.first_line);
        }
    ;
olvwm_cmd : BACK_SELN
    | EXIT
    | EXIT_NO_CONFIRM
    | FLIPDRAG
    | FLIPFOCUS
    | FULL_RESTORE_SIZE_SELN
    | NOP
    | OPEN_CLOSE_SELN
    | QUIT_SELN
    | PROPERTIES
    | REFRESH
    | REREAD_MENU_FILE
    | RESTART
    | SAVE_WORKSPACE
    | SEPARATOR
    | START_DSDM
    | STICK_UNSTICK_SELN
    | STOP_DSDM
    | WINMENU
    | WMEXIT
    ;
olvwm_cmd_arg : DIRMENU EXEC
    | MOVE_DESKTOP INT
    | WINMENU INT
    ;

%%
// /*
//    The openwin-menu syntax is somewhat loose, in that
//    the options TITLE, COLUMNS etc may appear anywhere in a
//    submenu, even between other menu items. This is convinient from
//    the point of view of our parser,
//    Stylistically, it would be better to constrain options like TITLE
//    to appearing before any menu commands, but we want to be "compatible".
// */
// 
// int main(int argc,char *argv[]) {
//   char c;
//   while( (c=getopt(argc, argv,"v")) != EOF ) {
//     switch(c) {
//       case 'v':
//         yydebug=1;
//         break;
//     }
//   }
//         if ( argc > optind ) {
//                 if ( (yyin = fopen(argv[optind],"r")) == 0 ) {
//                         perror(argv[optind]);
//                         exit(1);
//                 }
//         }
//   return(yyparse());
// }
// 
// int yywrap() {
//   return(1);
// }
// 
// int yyerror(char *err) {
//   fprintf(stderr, "%s at line %d\n",err,yylloc.first_line);
// }
// 
// 
 
