TBD

---

# Summary

## Overview

* [Preface / What will you find in here?](README.md)
* [Introduction](Introduction.adoc)
* [The Goal of JISON](1_Goal.adoc)
* [The Basics](2_Basics.adoc)
* [Diving Into JISON](3_Diving_Into_JISON.adoc)
* [The Real Meat: Advanced Topics](4_The_Real_Meat_Advanced_Topics.adoc)
* [Appendix: Reference of JISON specifics](A_JISON_Specifics_Reference.md)




## [The Goal of JISON](1_Goal.md)


## [The Basics](2_Basics.md)

   1. [First Principles: Parsing Theory](#Theory)

      1. [Parsing a Language: CFGs a.k.a. Context Free Grammars, and why they're such a bother](#Methods)
      1. [Parsing Methods: Bottom-up and Top-down](#Methods)
      1. [Bottom-up: SLR, LR(0), LR(1), LALR(1), LR(k), why do we care?](#Methods)
      1. [Top-down: LL(1), LL(k), LL(*), why do we care?](#Methods)
      1. [More from Top-down News Desk: PEG](#PEG)
      1. [... and when you truly wish to travel The Light Fantastic, here's a little taste for ya](#beyond_the_pale)

   1. [Parser Engineering: practice vs. theory](#Engineering)

      1. [Tokenizing: bothering with a Lexer ... or not?](#Lexing)
      1. [Lexer Automation: tooling up](#Lex_Tooling_Up)

         1. [LEX and friends](#lex)

            1. [... and JISON in particular](#lex_jison)

      1. [Parser Automation: tooling up](#Parser_Tooling_Up)

         1. [YACC and friends](#yacc)

            1. [... and JISON in particular](#yacc_jison)

         1. [Parser generators of a different kind: ANTLR, PCCTS, PEGjs, ...](#pccts)
         1. [Beyond parser generators](#burg_et_al)

   1. [Anticipating the devil waiting in the details: JISON vs. YACC, BISON, BTYACC, ...](#comparing_JISON)

   1. [Performance Considerations](#optimizing_grammars)

      1. [What does reducing the number of parse states do?](#optimizing)
      1. [What is the bother about Left Recursive vs. Right Recursive grammar rules?]
         1. [... when you use LR type parsers](#dummy)
         1. [... when you use LL type parsers](#dummy)
         1. [... when you use PEG type parsers](#dummy)


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




## The Real Meat: Advanced Topics

   1. [Debugging your work - Episode 1: turning it *ON*](#error_handling)

   1. [Error handling](#error_handling)

      1. [Error handling in the lexer](#error_handling)
      1. [Error handling in the parser](#error_handling)
      1. [Loving Living dangerously: Messing with the Error Recovery mechanisms](#error_handling)

   1. [Debugging your work - Episode 2: customizing the parser](#error_handling)

   1. [Debugging *their* work - Episode 1: improving your error diagnostics and reporting to the grammar user](#error_handling)

   1. [Performance Considerations: Speed is what I need!](#speed_is_what_I_need)

      1. [Don't skimp on your Theory pages! Giving it raw to your grammar spec](#cleaning_out)
      1. [Cleaning out the parser kernel](#cleaning_out)
      1. [Cleaning out the lexer kernel](#cleaning_out)

   1. [Performance Considerations: Compact **Size** is what I crave!](#right_I_like_em_tight)

      1. [Don't skimp on your Theory pages! Giving it raw to your grammar spec](#cleaning_out)
      1. [Cleaning out the parser kernel](#cleaning_out)
      1. [Cleaning out the lexer kernel](#cleaning_out)
      1. [If you must: writing a 100% custom lexer](#cleaning_out)


1. [Debugging *their* work - Episode 2: stepping through a parse](#error_handling)




## [Appendix: Reference of JISON specifics](A_JISON_Specifics_Reference.md)

* [Parser options](#dummy)
* [Lexer options](#dummy)
* [Generated Code](#dummy)
  * [Parser Kernel API](#dummy)
    * [SLR/LALR/LALR](#dummy)
    * [LL](#dummy)
    * [PEG](#dummy)
  * [Lexer options](#dummy)
    * [Minimal required API to interface with the parser](#dummy)













