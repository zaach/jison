- report unused grammar rules (which are not referenced by %start nor by any other rule nor are the very first if there's no %start)

- add PEG support, i.e. parse the grammar (keep the lexer anyway) and generate an appropriate parser kernel

  + we use PEG with the lexer, so the lexer spits out tokens. This contrasts with 'true PEG'.

  + we use the jison tool to precalc look-ahead sets; where these can be determined and are max depth 1, we can use the look-ahead set to help the generated parser (LL(1) alike)

- add %parser-type support in parallel to commandline `-p`

- check where the 'main' has gone; --no-main ???

- add lexer state multiline support a la bison: `<state> { ...rules... }`
