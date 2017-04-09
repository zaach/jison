TBD

---



## [Diving Into JISON](3_Diving_Into_JISON.md)

1. [Simply Invoking JISON](#Basic_Invoke)

  1. [The CLI (Command Line Interface)](#CLI)
  1. [The API: invoking JISON programmatically](#JISON_API)

1. [Simply Using JISON](#Basic_Usage)

  1. [Writing Your First Grammar](#first_grammar)
     1. [Necessary Preparation: Specifying the 'language' we are going to parse and what it'll have to accomplish](#first_grammar_specs)
     1. [Writing the lexer spec](#first_grammar_lexer)
     1. [Testing the generated lexer](#dummy)
     1. [Writing the grammar spec](#dummy)
     1. [Testing the generated parser](#dummy)
     1. [Writing the grammar rules' actions: make the parser work](#dummy)

   1. [Stepping it up: Writing Your Second Grammar](#second_grammar)
      1. [Necessary Preparation: Specifying the 'language' we are going to parse and what it'll have to accomplish](#first_grammar_specs)
      1. [Writing the lexer spec](#first_grammar_lexer)
      1. [Testing the generated lexer](#dummy)
      1. [Writing the grammar spec](#dummy)
      1. [Testing the generated parser](#dummy)
      1. [Writing the grammar rules' actions: make the parser work](#dummy)

   1. [How about 'porting' an existing LEX/FLEX+YACC/BISON grammar?](#porting_a_grammar)
      1. [Necessary Preparation: Checking the original to find out what grammar type it uses/requires](#first_grammar_specs)
      1. [Porting the lexer spec](#first_grammar_lexer)
      1. [Testing the generated lexer](#dummy)
      1. [Porting the grammar spec](#dummy)
      1. [Testing the generated parser](#dummy)
      1. [Porting the grammar rules' actions: make the parser work](#dummy)

   1. [How about 'porting' an existing ANTLR/PCCTS/PEG grammar?](#porting_a_grammar)
      1. [Necessary Preparation: Checking the original to find out what grammar type it uses/requires](#first_grammar_specs)
      1. [Porting the lexer spec](#first_grammar_lexer)
      1. [Testing the generated lexer](#dummy)
      1. [Porting the grammar spec](#dummy)
      1. [Testing the generated parser](#dummy)
      1. [Porting the grammar rules' actions: make the parser work](#dummy)

1. [Driving JISON settings from your grammar or the CLI](#error_handling)
1. [Stuff we might not support yet](#error_handling)
1. [Stuff we are not intent on supporting](#error_handling)



---


