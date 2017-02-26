TBD

---


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





---


