[ ] add PEG support, i.e. parse the grammar (keep the lexer anyway) and generate an appropriate parser kernel

  + we use PEG with the lexer, so the lexer spits out tokens. This contrasts with 'true PEG'.

  + we use the jison tool to precalc look-ahead sets; where these can be determined and are max depth 1, we can use the look-ahead set to help the generated parser (LL(1) alike)

[x] add lexer state multiline support a la bison: `<state> { ...rules... }`

[ ] inline performAction when none of the action code uses variable names which clash with the core. `this._$` and `this.$` then have to become `yyval._$` and `yyval.$` and inlining then has to take it from there (some parameters in the call to `performAction` change names at the interface,
so there's more renaming to do there...)

---

[x] add %parser-type support in parallel to commandline `-p`

[x] check where the 'main' has gone; --no-main ???

  + ==> CLI option `--main`: positive logic. Without `--main` (the default) it's `no-main` output for all...

[x] report unused grammar rules (which are not referenced by %start nor by any other rule nor are the very first if there's no %start)

