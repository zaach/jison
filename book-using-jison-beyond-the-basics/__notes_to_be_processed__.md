
## https://github.com/GerHobbelt/jison/issues/12


I’m not sure if I’m doing something wrong, but result locations `@$` seem to be always `undefined` in v0.6.0-188. If I run

```sh
npm install https://github.com/GerHobbelt/jison/archive/0.6.0-188.tar.gz
cat << 'EOF' > test.jison
%lex
%%
. return 'CHARACTER';
/lex

%start characters

%%

characters
  : character
  | characters character
  ;

character: 'CHARACTER' { console.log(@$); };
EOF
node_modules/jison-gho/lib/cli.js test.jison
node --eval "require('$(pwd)/test.js').parse('abc')"
```

on macOS 10.12.6, the output is

```
undefined
undefined
undefined
```

---

Answer:

`@$` is the yylloc info **result** of the rule, similar to `$$` being the **value result**.

Previously (0.4.18-xxx) you got away with this in most circumstances because 0.4.18 run-time **always** performed the old 'default actions':

```
$$ = $1;
@$ = @1;
```

before executing **any** rule action code chunk, so that `$$` and `@$` acted as identical copies of `$1` and `@1`. v0.6.0-XXX doesn't do this any more (for run-time performance reasons) and only injects default actions when there's no user code at all (which is more like the bison behaviour, incidentally).

## Anyway, long story short:

The correct way to reference any rule production term, is by numeric or named reference, e.g.

```
character: 'CHARACTER' { console.log(@1); }
               ;
```

but I never use the *quoted* token names as that is only extra overhead cost, hence your example would be written as (showcasing 'named reference' for CHARACTER, by the way):

```
%lex
%%
. return 'CHARACTER';
/lex

%start characters

// %token CHARACTER  <-- is *implicit* due to the way I wrote the character rule below
 
%%

characters
  : character
  | characters character
  ;

character: CHARACTER 
        { console.log(@CHARACTER); }
    ;
```

The next snippet is a self-contained executable, if you compile it with `jison --main` (see `jison --help`):

```
%lex
%%
. return 'CHARACTER';
/lex

%start characters

// %token CHARACTER  <-- is *implicit* due to the way I wrote the character rule below
 
%%

characters
  : character
  | characters character
  ;

character: CHARACTER 
        { console.log(@CHARACTER); }   // or use `@1` to ref the 1st term in the rule production
    ;


%%

// compile with `jison --main test.jison`
// then execute this `main()` with `node test.js`

parser.main = function () {
	parser.parse('abc');
};
```

---

Answer:

BTW:

`@$` is useful when you construct your own location reference for the rule, e.g. 

```
rule: a b c d e f 
    { @$ = yyparser.mergeLocationInfo(##a, ##f); $$ = $a + $b + $c + $d + $e + $f; }
```

`##` is a jison-specific **advanced use** prefix: it transforms the production term reference name/number into the **index** number for the parse stack(s) `yyvstack` (value stack, i.e. the array carrying all the `$a/$b/$c/...` values), `yylstack` (location infos `@a,@b,@c,...`), `yysstack` (parse state stack, in case you want to use these internals), etc.

## The supported references in parser action code:

- `$a` / `$1` produces the value of the term (for a terminal, this is the value returned by the lexer in `yytext` in the matching lexer rule)
 
- `@a` / `@1` produces the location info (which MAY be NULL if you're not careful: this is related to the default action code injection and worth a chapter or at least a book section in itself 😉 )

- `#a` / `#1` (jison-specific, not available in bison/yacc/etc.) produces the **token number** for this term (handy when you have an external token definition set and have `%import`-ed that one into the lexer and the parser: this way you have one numeric value representing the same (*terminal*) token *everywhere* in your app code)

- `##a` / `##1` (jison-specific, not available in bison/yacc/etc.) produces the **stack index number** as mentioned above: this is handy when you're doing advanced stuff that needs full disclosure of the parser internals, particularly all parse stacks.

