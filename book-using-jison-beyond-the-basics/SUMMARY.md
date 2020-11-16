# Summary

## Overview

* [Preface / What will you find in here?](README.md)
* [Introduction](Introduction.md)
* [The Goal of JISON](1_Goal.md)
* [The Basics](2_Basics.md)
* [Diving Into JISON](3_Diving_Into_JISON.md)
* [The Real Meat: Advanced Topics](4_The_Real_Meat_Advanced_Topics.md)
* [Appendix: Reference of JISON specifics](A_JISON_Specifics_Reference.md)

## The Goal of JISON

## The Basics

* [First Principles: Parsing Theory](gitbook-is-buggered.md#Theory)
  * [Parsing a Language: CFGs a.k.a. Context Free Grammars, and why they're such a bother](gitbook-is-buggered.md#Methods)
  * [Parsing Methods: Bottom-up and Top-down](gitbook-is-buggered.md#Methods)
  * [Bottom-up: SLR, LR(0), LR(1), LALR(1), LR(k), why do we care?](gitbook-is-buggered.md#Methods)
  * [Top-down: LL(1), LL(k), LL(*), why do we care?](gitbook-is-buggered.md#Methods)
  * [More from Top-down News Desk: PEG](gitbook-is-buggered.md#PEG)
  * [... and when you truly wish to travel The Light Fantastic, here's a little taste for ya](gitbook-is-buggered.md#beyond_the_pale)
* [Parser Engineering: practice vs. theory](gitbook-is-buggered.md#Engineering)
  * [Tokenizing: bothering with a Lexer ... or not?](gitbook-is-buggered.md#Lexing)
  * [Lexer Automation: tooling up](gitbook-is-buggered.md#Lex_Tooling_Up)
    * [LEX and friends](gitbook-is-buggered.md#lex)
      * [... and JISON in particular](gitbook-is-buggered.md#lex_jison)
  * [Parser Automation: tooling up](gitbook-is-buggered.md#Parser_Tooling_Up)
    * [YACC and friends](gitbook-is-buggered.md#yacc)
      * [... and JISON in particular](gitbook-is-buggered.md#yacc_jison)
    * [Parser generators of a different kind: ANTLR, PCCTS, PEGjs, ...](gitbook-is-buggered.md#pccts)
    * [Beyond parser generators](gitbook-is-buggered.md#burg_et_al)
* [Anticipating the devil waiting in the details: JISON vs. YACC, BISON, BTYACC, ...](gitbook-is-buggered.md#comparing_JISON)
* [Performance Considerations](gitbook-is-buggered.md#optimizing_grammars)
  * [What does reducing the number of parse states do?](gitbook-is-buggered.md#optimizing)
  * [What is the bother about Left Recursive vs. Right Recursive grammar rules?]
    * [... when you use LR type parsers](gitbook-is-buggered.md#dummy)
    * [... when you use LL type parsers](gitbook-is-buggered.md#dummy)
    * [... when you use PEG type parsers](gitbook-is-buggered.md#dummy)

## Diving Into JISON

* [Simply Invoking JISON](gitbook-is-buggered.md#Basic_Invoke)
  * [The CLI (Command Line Interface)](gitbook-is-buggered.md#CLI)
  * [The API: invoking JISON programmatically](gitbook-is-buggered.md#JISON_API)
* [Simply Using JISON](gitbook-is-buggered.md#Basic_Usage)
  * [Writing Your First Grammar](gitbook-is-buggered.md#first_grammar)
    * [Necessary Preparation: Specifying the 'language' we are going to parse and what it'll have to accomplish](gitbook-is-buggered.md#first_grammar_specs)
    * [Writing the lexer spec](gitbook-is-buggered.md#first_grammar_lexer)
    * [Testing the generated lexer](gitbook-is-buggered.md#dummy)
    * [Writing the grammar spec](gitbook-is-buggered.md#dummy)
    * [Testing the generated parser](gitbook-is-buggered.md#dummy)
    * [Writing the grammar rules' actions: make the parser work](gitbook-is-buggered.md#dummy)
  * [Stepping it up: Writing Your Second Grammar](gitbook-is-buggered.md#second_grammar)
    * [Necessary Preparation: Specifying the 'language' we are going to parse and what it'll have to accomplish](gitbook-is-buggered.md#first_grammar_specs)
    * [Writing the lexer spec](gitbook-is-buggered.md#first_grammar_lexer)
    * [Testing the generated lexer](gitbook-is-buggered.md#dummy)
    * [Writing the grammar spec](gitbook-is-buggered.md#dummy)
    * [Testing the generated parser](gitbook-is-buggered.md#dummy)
    * [Writing the grammar rules' actions: make the parser work](gitbook-is-buggered.md#dummy)
  * [How about 'porting' an existing LEX/FLEX+YACC/BISON grammar?](gitbook-is-buggered.md#porting_a_grammar)
    * [Necessary Preparation: Checking the original to find out what grammar type it uses/requires](gitbook-is-buggered.md#first_grammar_specs)
    * [Porting the lexer spec](gitbook-is-buggered.md#first_grammar_lexer)
    * [Testing the generated lexer](gitbook-is-buggered.md#dummy)
    * [Porting the grammar spec](gitbook-is-buggered.md#dummy)
    * [Testing the generated parser](gitbook-is-buggered.md#dummy)
    * [Porting the grammar rules' actions: make the parser work](gitbook-is-buggered.md#dummy)
  * [How about 'porting' an existing ANTLR/PCCTS/PEG grammar?](gitbook-is-buggered.md#porting_a_grammar)
    * [Necessary Preparation: Checking the original to find out what grammar type it uses/requires](gitbook-is-buggered.md#first_grammar_specs)
    * [Porting the lexer spec](gitbook-is-buggered.md#first_grammar_lexer)
    * [Testing the generated lexer](gitbook-is-buggered.md#dummy)
    * [Porting the grammar spec](gitbook-is-buggered.md#dummy)
    * [Testing the generated parser](gitbook-is-buggered.md#dummy)
    * [Porting the grammar rules' actions: make the parser work](gitbook-is-buggered.md#dummy)
* [Driving JISON settings from your grammar or the CLI](gitbook-is-buggered.md#error_handling)
* [Stuff we might not support yet](gitbook-is-buggered.md#error_handling)
* [Stuff we are not intent on supporting](gitbook-is-buggered.md#error_handling)

## The Real Meat: Advanced Topics

* [Debugging your work - Episode 1: turning it ON](gitbook-is-buggered.md#error_handling)
* [Error handling](gitbook-is-buggered.md#error_handling)
  * [Error handling in the lexer](gitbook-is-buggered.md#error_handling)
  * [Error handling in the parser](gitbook-is-buggered.md#error_handling)
  * [Loving Living dangerously: Messing with the Error Recovery mechanisms](gitbook-is-buggered.md#error_handling)
* [Debugging your work - Episode 2: customizing the parser](gitbook-is-buggered.md#error_handling)
* [Debugging their work - Episode 1: improving your error diagnostics and reporting to the grammar user](gitbook-is-buggered.md#error_handling)
* [Performance Considerations: Speed is what I need!](gitbook-is-buggered.md#speed_is_what_I_need)
  * [Don't skimp on your Theory pages! Giving it raw to your grammar spec](gitbook-is-buggered.md#cleaning_out)
  * [Cleaning out the parser kernel](gitbook-is-buggered.md#cleaning_out)
  * [Cleaning out the lexer kernel](gitbook-is-buggered.md#cleaning_out)
* [Performance Considerations: Compact Size is what I crave!](gitbook-is-buggered.md#right_I_like_em_tight)
  * [Don't skimp on your Theory pages! Giving it raw to your grammar spec](gitbook-is-buggered.md#cleaning_out)
  * [Cleaning out the parser kernel](gitbook-is-buggered.md#cleaning_out)
  * [Cleaning out the lexer kernel](gitbook-is-buggered.md#cleaning_out)
  * [If you must: writing a 100% custom lexer](gitbook-is-buggered.md#cleaning_out)

---

* [Debugging their work - Episode 2: stepping through a parse](gitbook-is-buggered.md#error_handling)

## Appendix: Reference of JISON specifics

* [Parser options](gitbook-is-buggered.md#dummy)
* [Lexer options](gitbook-is-buggered.md#dummy)
* [Generated Code](gitbook-is-buggered.md#dummy)
  * [Parser Kernel API](gitbook-is-buggered.md#dummy)
    * [SLR/LALR/LALR](gitbook-is-buggered.md#dummy)
    * [LL](gitbook-is-buggered.md#dummy)
    * [PEG](gitbook-is-buggered.md#dummy)
  * [Lexer options](gitbook-is-buggered.md#dummy)
    * [Minimal required API to interface with the parser](gitbook-is-buggered.md#dummy)



