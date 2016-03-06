/* http://www.lojban.org/publications/formal-grammars/grammar.300.txt */

/*          LOJBAN MACHINE GRAMMAR, 3RD BASELINE AS OF 10 JANUARY 1997
   WHICH IS ORIGINAL BASELINE 20 JULY 1990 INCORPORATING JC'S TECH FIXES 1-28
     THIS DRAFT ALSO INCORPORATES CHANGE PROPOSALS 1-47 DATED 29 DECEMBER 1996

          THIS DOCUMENT IS EXPLICITLY DEDICATED TO THE PUBLIC DOMAIN
                BY ITS AUTHOR, THE LOGICAL LANGUAGE GROUP INC.
       CONTACT THAT ORGANIZATION AT 2904 BEAU LANE, FAIRFAX VA 22031 USA
                          U.S. PHONE: 703-385-0273
                        INTL PHONE: +1 703 385-0273


  grammar.300

*/

   /* The Lojban machine parsing algorithm is a multi-step process.  The
   YACC machine grammar presented here is an amalgam of those steps,
   concatenated so as to allow YACC to verify the syntactic ambiguity of
   the grammar.  YACC is used to generate a parser for a portion of the
   grammar, which is LALR1 (the type of grammar that YACC is designed to
   identify and process successfully), but most of the rest of the grammar
   must be parsed using some language-coded processing.

   Step 1 - Lexing

   From phonemes, stress, and pause, it is possible to resolve Lojban
   unambiguously into a stream of words.  Any machine processing of speech
   will have to have some way to deal with 'non-Lojban' failures of fluent
   speech, of course.  The resolved words can be expressed as a text file,
   using Lojban's phonetic spelling rules.

   The following steps, assume that there is the possibility of non-Lojban
   text within the Lojban text (delimited appropriately).  Such non-Lojban
   text may not be reducible from speech phonetically.  However, step 2
   allows the filtering of a phonetically transcribed text stream, to
   recognize such portions of non-Lojban text where properly delimited,
   without interference with the parsing algorithm.


   Step 2 - Filtering

   From start to end, performing the following filtering and lexing tasks
   using the given order of precedence in case of conflict:

   a. If the Lojban word "zoi" (selma'o ZOI) is identified, take the
   following Lojban word (which should be end delimited with a pause for
   separation from the following non-Lojban text) as an opening delimiter.
   Treat all text following that delimiter, until that delimiter recurs
   *after a pause*, as grammatically a single token (labelled 'anything_699'
   in this grammar).  There is no need for processing within this text
   except as necessary to find the closing delimiter.

   b. If the Lojban word "zo" (selma'o ZO) is identified, treat the
   following Lojban word as a token labelled 'any_word_698', instead of lexing
   it by its normal grammatical function.

   c. If the Lojban word "lo'u" (selma'o LOhU) is identified, search for
   the closing delimiter "le'u" (selma'o LEhU), ignoring any such closing
   delimiters absorbed by the previous two steps.  The text between the
   delimiters should be treated as the single token 'any_words_697'.

   d. Categorize all remaining words into their Lojban selma'o category,
   including the various delimiters mentioned in the previous steps.  In
   all steps after step 2, only the selma'o token type is significant for
   each word.

   e. If the word "si" (selma'o SI) is identified, erase it and the
   previous word (or token, if the previous text has been condensed into a
   single token by one of the above rules).

   f. If the word "sa" (selma'o SA) is identified, erase it and all
   preceding text as far back as necessary to make what follows attach to
   what precedes.  (This rule is hard to formalize and may receive further
   definition later.)

   g. If the word 'su' (selma'o SU) is identified, erase it and all
   preceding text back to and including the first preceding token word
   which is in one of the selma'o:  NIhO, LU, TUhE, and TO.  However, if
   speaker identification is available, a SU shall only erase to the
   beginning of a speaker's discourse, unless it occurs at the beginning of
   a speaker's discourse.  (Thus, if the speaker has said something, two
   "su"'s are required to erase the entire conversation.


   Step 3 - Termination

   If the text contains a FAhO, treat that as the end-of-text and ignore
   everything that follows it.


   Step 4 - Absorption of Grammar-Free Tokens

   In a new pass, perform the following absorptions (absorption means that
   the token is removed from the grammar for processing in following steps,
   and optionally reinserted, grouped with the absorbing token after
   parsing is completed).

   a. Token sequences of the form any - (ZEI - any) ..., where there may be
   any number of ZEIs, are merged into a single token of selma'o BRIVLA.

   b. Absorb all selma'o BAhE tokens into the following token.  If
   they occur at the end of text, leave them alone (they are errors).

   c. Absorb all selma'o BU tokens into the previous token.  Relabel the
   previous token as selma'o BY.

   d. If selma'o NAI occurs immediately following any of tokens UI or CAI,
   absorb the NAI into the previous token.

   e. Absorb all members of selma'o DAhO, FUhO, FUhE, UI, Y, and CAI
   into the previous token.  All of these null grammar tokens are permitted
   following any word of the grammar, without interfering with that word's
   grammatical function, or causing any effect on the grammatical
   interpretation of any other token in the text.  Indicators at the
   beginning of text are explicitly handled by the grammar.


   Step 5 - Insertion of Lexer Lexemes

   Lojban is not in itself LALR1.  There are words whose grammatical
   function is determined by following tokens.  As a result, parsing of the
   YACC grammar must take place in two steps.  In the first step, certain
   strings of tokens with defined grammars are identified, and either

   a. are replaced by a single specified 'lexer token' for step 6, or

   b. the lexer token is inserted in front of the token string to identify
   it uniquely.

   The YACC grammar included herein is written to make YACC generation of a
   step 6 parser easy regardless of whether a. or b. is used.  The strings
   of tokens to be labelled with lexer tokens are found in rule terminals
   labelled with numbers between 900 and 1099.  These rules are defined
   with the lexer tokens inserted, with the result that it can be verified
   that the language is LALR1 under option b. after steps 1 through 4 have
   been performed.  Alternatively, if option a. is to be used, these rules
   are commented out, and the rule terminals labelled from 800 to 900 refer
   to the lexer tokens *without* the strings of defining tokens.  Two sets
   of lexer tokens are defined in the token set so as to be compatible with
   either option.

   In this step, the strings must be labelled with the appropriate lexer
   tokens.  Order of inserting lexer tokens *IS* significant, since some
   shorter strings that would be marked with a lexer token may be found
   inside longer strings.  If the tokens are inserted before or in place of
   the shorter strings, the longer strings cannot be identified.

   If option a. is chosen, the following order of insertion works correctly
   (it is not the only possible order): A, C, D, B, U, E, H, I,
   J, K, M ,N, G, O, V, W, F, P, R, T, S, Y, L, Q. This ensures that the longest
   rules will be processed first; a PA+MAI will not be seen as a PA
   with a dangling MAI at the end, for example.


   Step 6 - YACC Parsing

   YACC should now be able to parse the Lojban text in accordance with the
   rule terminals labelled from 1 to 899 under option 5a, or 1 to 1099
   under option 5b.  Comment out the rules beyond 900 if option 5a is used,
   and comment out the 700-series of lexer-tokens, while restoring the
   series of lexer tokens numbered from 900 up.

   */



%token A_501            /*        eks; basic afterthought logical connectives */
%token BAI_502          /*        modal operators */
%token BAhE_503         /*        next word intensifier */
%token BE_504           /*        sumti link to attach sumti to a selbri */
%token BEI_505          /*        multiple sumti separator between BE, BEI */
%token BEhO_506         /*        terminates BE/BEI specified descriptors */
%token BIhI_507         /*        interval component of JOI */
%token BO_508           /*        joins two units with shortest scope */
%token BRIVLA_509       /*        any brivla */
%token BU_511           /*        turns any word into a BY lerfu word */
%token BY_513           /*        individual lerfu words */
%token CAhA_514         /*        specifies actuality/potentiality of tense */
%token CAI_515          /*        afterthought intensity marker */
%token CEI_516          /*        pro-bridi assignment operator */
%token CEhE_517         /*        afterthought term list connective */
%token CMENE_518        /*        names; require consonant end, then pause no
                                   LA or DOI selma'o embedded, pause before if
                                   vowel initial and preceded by a vowel */
%token CO_519           /*        tanru inversion  */
%token COI_520          /*        vocative marker permitted inside names; must
                                   always be followed by pause or DOI */
%token CU_521           /*        separator between head sumti and selbri */
%token CUhE_522         /*        tense/modal question */
%token DAhO_524         /*        cancel anaphora/cataphora assignments */
%token DOI_525          /*        vocative marker */
%token DOhU_526         /*        terminator for DOI-marked vocatives */
%token FA_527           /*        modifier head generic case tag */
%token FAhA_528         /*        superdirections in space */
%token FAhO_529         /*        normally elided 'done pause' to indicate end
                                   of utterance string */
%token FEhE_530         /*        space interval mod flag */
%token FEhU_531         /*        ends bridi to modal conversion */
%token FIhO_532         /*        marks bridi to modal conversion */
%token FOI_533          /*        end compound lerfu */
%token FUhE_535         /*        open long scope for indicator */
%token FUhO_536         /*        close long scope for indicator */
%token GA_537           /*        geks; forethought logical connectives */
%token GEhU_538         /*        marker ending GOI relative clauses */
%token GI_539           /*        forethought medial marker */
%token GIhA_541         /*        logical connectives for bridi-tails */
%token GOI_542          /*        attaches a sumti modifier to a sumti */
%token GOhA_543         /*        pro-bridi */
%token GUhA_544         /*        GEK for tanru units, corresponds to JEKs */
%token I_545            /*        sentence link */
%token JA_546           /*        jeks; logical connectives within tanru */
%token JAI_547          /*        modal conversion flag */
%token JOI_548          /*        non-logical connectives */
%token KEhE_550         /*        right terminator for KE groups */
%token KE_551           /*        left long scope marker */
%token KEI_552          /*        right terminator, NU abstractions */
%token KI_554           /*        multiple utterance scope for tenses */
%token KOhA_555         /*        sumti anaphora */
%token KU_556           /*        right terminator for descriptions, etc. */
%token KUhO_557         /*        right terminator, NOI relative clauses */
%token LA_558           /*        name descriptors */
%token LAU_559          /*        lerfu prefixes */
%token LAhE_561         /*        sumti qualifiers */
%token LE_562           /*        sumti descriptors */
%token LEhU_565         /*        possibly ungrammatical text right quote */
%token LI_566           /*        convert number to sumti */
%token LIhU_567         /*        grammatical text right quote */
%token LOhO_568         /*        elidable terminator for LI */
%token LOhU_569         /*        possibly ungrammatical text left quote */
%token LU_571           /*        grammatical text left quote */
%token LUhU_573         /*        LAhE close delimiter */
%token ME_574           /*        converts a sumti into a tanru_unit */
%token MEhU_575         /*        terminator for ME */
%token MOhI_577         /*        motion tense marker */
%token NA_578           /*        bridi negation  */
%token NAI_581          /*        attached to words to negate them */
%token NAhE_583         /*        scalar negation  */
%token NIhO_584         /*        new paragraph; change of subject */
%token NOI_585          /*        attaches a subordinate clause to a sumti */
%token NU_586           /*        abstraction  */
%token NUhI_587         /*        marks the start of a termset */
%token NUhU_588         /*        marks the middle and end of a termset */
%token PEhE_591         /*        afterthought termset connective prefix */
%token PU_592           /*        directions in time */
%token RAhO_593         /*        flag for modified interpretation of GOhI */
%token ROI_594          /*        converts number to extensional tense */
%token SA_595           /*        metalinguistic eraser to the beginning of
                                   the current utterance */
%token SE_596           /*        conversions */
%token SEI_597          /*        metalinguistic bridi insert marker */
%token SEhU_598         /*        metalinguistic bridi end marker */
%token SI_601           /*        metalinguistic single word eraser */
%token SOI_602          /*        reciprocal sumti marker */
%token SU_603           /*        metalinguistic eraser of the entire text */
%token TAhE_604         /*        tense interval properties */
%token TEI_605          /*        start compound lerfu */
%token TO_606           /*        left discursive parenthesis */
%token TOI_607          /*        right discursive parenthesis */
%token TUhE_610         /*        multiple utterance scope mark */
%token TUhU_611         /*        multiple utterance end scope mark */
%token UI_612           /*        attitudinals, observationals, discursives */
%token VA_613           /*        distance in space-time */
%token VAU_614          /*        end simple bridi or bridi-tail */
%token VEhA_615         /*        space-time interval size */
%token VIhA_616         /*        space-time dimensionality marker */
%token VUhO_617         /*        glue between logically connected sumti
                                    and relative clauses */
%token XI_618           /*        subscripting operator */
%token Y_619            /*        hesitation */
%token ZAhO_621         /*        event properties - inchoative, etc. */
%token ZEhA_622         /*        time interval size tense */
%token ZEI_623          /*        lujvo glue */
%token ZI_624           /*        time distance tense */
%token ZIhE_625         /*        conjoins relative clauses */
%token ZO_626           /*        single word metalinguistic quote marker */
%token ZOI_627          /*        delimited quote marker */
%token ZOhU_628         /*        prenex terminator (not elidable) */

%token BIhE_650         /*        prefix for high-priority MEX operator */
%token BOI_651          /*        number or lerfu-string terminator */
%token FUhA_655         /*        reverse Polish flag */
%token GAhO_656         /*        open/closed interval markers for BIhI */
%token JOhI_657         /*        flags an array operand */
%token KUhE_658         /*        MEX forethought delimiter */
%token MAI_661          /*        change numbers to utterance ordinals */
%token MAhO_662         /*        change MEX expressions to MEX operators */
%token MOI_663          /*        change number to selbri */
%token MOhE_664         /*        change sumti to operand, inverse of LI */
%token NAhU_665         /*        change a selbri into an operator */
%token NIhE_666         /*        change selbri to operand; inverse of MOI */
%token NUhA_667         /*        change operator to selbri; inverse of MOhE */
%token PA_672           /*        numbers and numeric punctuation */
%token PEhO_673         /*        forethought (Polish) flag */
%token TEhU_675         /*        closing gap for MEX constructs */
%token VEI_677          /*        left MEX bracket */
%token VEhO_678         /*        right MEX bracket */
%token VUhU_679         /*        MEX operator */

%token any_words_697    /*        a string of lexable Lojban words */
%token any_word_698     /*        any single lexable Lojban words */
%token anything_699     /*        a possibly unlexable phoneme string */


/* The following tokens are the actual lexer tokens.  The _900 series
tokens are duplicates that allow limited testing of lexer rules in the
context of the total grammar.  They are used in the actual parser, where
the 900 series rules are found in the lexer.  */

%token lexer_A_701      /*        flags a MAI utterance ordinal */
%token lexer_B_702      /*        flags an EK unless EK_BO, EK_KE */
%token lexer_C_703      /*        flags an EK_BO */
%token lexer_D_704      /*        flags an EK_KE */
%token lexer_E_705      /*        flags a JEK */
%token lexer_F_706      /*        flags a JOIK */
%token lexer_G_707      /*        flags a GEK */
%token lexer_H_708      /*        flags a GUhEK */
%token lexer_I_709      /*        flags a NAhE_BO */
%token lexer_J_710      /*        flags a NA_KU */
%token lexer_K_711      /*        flags an I_BO (option. JOIK/JEK lexer tags)*/
%token lexer_L_712      /*        flags a PA, unless MAI (then lexer A) */
%token lexer_M_713      /*        flags a GIhEK_BO */
%token lexer_N_714      /*        flags a GIhEK_KE */
%token lexer_O_715      /*        flags a modal operator BAI or compound */
%token lexer_P_716      /*        flags a GIK */
%token lexer_Q_717      /*        flags a lerfu_string unless MAI (then lexer_A)*/
%token lexer_R_718      /*        flags a GIhEK, not BO or KE */
%token lexer_S_719      /*        flags simple I */
%token lexer_T_720      /*        flags I_JEK */
%token lexer_U_721      /*        flags a JEK_BO */
%token lexer_V_722      /*        flags a JOIK_BO */
%token lexer_W_723      /*        flags a JOIK_KE */
/* %token lexer_X_724   /* null */
%token lexer_Y_725      /*        flags a PA_MOI */


/*%token lexer_A_905    /*        :  lexer_A_701  utt_ordinal_root_906 */
/*%token lexer_B_910    /*        :  lexer_B_702  EK_root_911 */
/*%token lexer_C_915    /*        :  lexer_C_703  EK_root_911  BO_508 */
/*%token lexer_D_916    /*        :  lexer_D_704  EK_root_911  KE_551 */
/*%token lexer_E_925    /*        :  lexer_E_705  JEK_root_926 */
/*%token lexer_F_930    /*        :  lexer_F_706  JOIK_root_931 */
/*%token lexer_G_935    /*        :  lexer_G_707  GA_537 */
/*%token lexer_H_940    /*        :  lexer_H_708  GUhA_544 */
/*%token lexer_I_945    /*        :  lexer_I_709  NAhE_583  BO_508 */
/*%token lexer_J_950    /*        :  lexer_J_710  NA_578  KU_556 */
/*%token lexer_K_955    /*        :  lexer_K_711  I_432  BO_508 */
/*%token lexer_L_960    /*        :  lexer_L_712  number_root_961 */
/*%token lexer_M_965    /*        :  lexer_M_713  GIhEK_root_991  BO_508 */
/*%token lexer_N_966    /*        :  lexer_N_714  GIhEK_root_991  KE_551 */
/*%token lexer_O_970    /*        :  lexer_O_715  simple_tense_modal_972 */
/*%token lexer_P_980    /*        :  lexer_P_716  GIK_root_981 */
/*%token lexer_Q_985    /*        :  lexer_Q_717  lerfu_string_root_986 */
/*%token lexer_R_990    /*        :  lexer_R_718  GIhEK_root_991 */
/*%token lexer_S_995    /*        :  lexer_S_719  I_545 */
/*%token lexer_T_1000  /*        :  lexer_T_720  I_545  simple_JOIK_JEK_957 */
/*%token lexer_U_1005   /*        :  lexer_U_721  JEK_root_926  BO_508 */
/*%token lexer_V_1010   /*        :  lexer_V_722  JOIK_root_931  BO_508 */
/*%token lexer_W_1015   /*        :  lexer_W_723  JOIK_root_931  KE_551 */
/*%token lexer_X_1020   /* null */
/*%token lexer_Y_1025   /*        :  lexer_Y_725  number_root_961  MOI_663 */


%start text_0

%%

text_0                  :  text_A_1
                        |  indicators_411  text_A_1
                        |  free_modifier_32  text_A_1
                        |  cmene_404  text_A_1
                        |  indicators_411  free_modifier_32  text_A_1
                        |  NAI_581  text_0
                        ;

text_A_1                :  JOIK_JEK_422  text_B_2
                        /* incomplete JOIK_JEK  without preceding I */
                        /* compare note on paragraph_10 */
                        |  text_B_2
                        ;

text_B_2                :  I_819  text_B_2
                        |  I_JEK_820  text_B_2
                        |  I_BO_811  text_B_2
                        |  para_mark_410  text_C_3
                        |  text_C_3
                        ;

text_C_3                :  paragraphs_4
   /* Only indicators which follow certain selma'o:
    cmene, TOI_607, LU_571, and the lexer_K and lexer_S I_roots and compounds,
    and at the start of text(_0), will survive the lexer; all other valid ones
    will be absorbed.  The only strings for which indicators generate a
    potential ambiguity are those which contain NAI.  An indicator cannot be
    inserted in between a token and its negating NAI, else you can't tell
    whether it is the indicator or the original token being negated. */
                        |  /* empty */
  /* An empty text is legal; formerly this was handled by the explicit
   appearance of FAhO_529, but this is now absorbed by the preparser. */
                        ;


paragraphs_4            :  paragraph_10
                        |  paragraph_10  para_mark_410  paragraphs_4
                        ;

paragraph_10            :  statement_11
                        |  fragment_20
                        |  paragraph_10  I_819  statement_11
                        |  paragraph_10  I_819  fragment_20
                        |  paragraph_10  I_819
                        /* this last fixes an erroneous start to a sentence,
                           and permits incomplete JOIK_JEK after I, as well
                           in answer to questions on those connectives  */
                        ;

statement_11            :  statement_A_12
                        |  prenex_30  statement_11
                        ;

statement_A_12          :  statement_B_13
                        |  statement_A_12  I_JEK_820  statement_B_13
                        |  statement_A_12  I_JEK_820 
                        ;

statement_B_13          :  statement_C_14
                        |  statement_C_14  I_BO_811  statement_B_13
                        |  statement_C_14  I_BO_811 
                        ;

statement_C_14          :  sentence_40
                        |  TUhE_447  text_B_2  TUhU_gap_454
                        |  tag_491  TUhE_447  text_B_2  TUhU_gap_454
                        ;


fragment_20             :  EK_802
                        |  NA_445
                        |  GIhEK_818
                        |  quantifier_300
                        |  terms_80  VAU_gap_456        /* answer to ma */
                        /* mod_head_490 requires both gap_450 and VAU_gap_456
                           but needs no extra rule to accomplish this */
                        |  relative_clauses_121
                        |  links_161
                        |  linkargs_160
                        |  prenex_30
                        ;


prenex_30               :  terms_80  ZOhU_492
                        ;

free_modifier_32        :  free_modifier_A_33
                        |  free_modifier_A_33  free_modifier_32
                        ;

free_modifier_A_33      :  vocative_35
                        |  parenthetical_36
                        |  discursive_bridi_34
                        |  subscript_486
                        |  utterance_ordinal_801
                        ;

discursive_bridi_34     :  SEI_440  selbri_130  SEhU_gap_459
                        |  SOI_498  sumti_90  SEhU_gap_459
                        |  SOI_498  sumti_90  sumti_90  SEhU_gap_459
                        |  SEI_440  terms_80  front_gap_451
                                  selbri_130  SEhU_gap_459
                        |  SEI_440  terms_80  selbri_130  SEhU_gap_459
                        ;

vocative_35             :  DOI_415  selbri_130  DOhU_gap_457
                        |  DOI_415  selbri_130
                                  relative_clauses_121  DOhU_gap_457
                        |  DOI_415  relative_clauses_121
                                  selbri_130  DOhU_gap_457
                        |  DOI_415  relative_clauses_121
                                  selbri_130  relative_clauses_121  DOhU_gap_457
                        |  DOI_415  cmene_404  DOhU_gap_457
                        |  DOI_415  cmene_404
                                  relative_clauses_121  DOhU_gap_457
                        |  DOI_415  relative_clauses_121  cmene_404
                                 DOhU_gap_457
                        |  DOI_415  relative_clauses_121  cmene_404
                                  relative_clauses_121  DOhU_gap_457
                        |  DOI_415  sumti_90  DOhU_gap_457
                        |  DOI_415  DOhU_gap_457
                        ;

parenthetical_36        :  TO_606  text_0  TOI_gap_468
                        ;


sentence_40             :  bridi_tail_50  /* bare observative or mo answer */
                        |  terms_80  front_gap_451  bridi_tail_50
                        |  terms_80  bridi_tail_50
                        ;

subsentence_41          :  sentence_40
                        |  prenex_30  subsentence_41
                        ;


bridi_tail_50           :  bridi_tail_A_51
                        |  bridi_tail_A_51  GIhEK_KE_814  bridi_tail_50
                                  KEhE_gap_466  tail_terms_71
                        ;

bridi_tail_A_51         :  bridi_tail_B_52
                        |  bridi_tail_A_51  GIhEK_818  bridi_tail_B_52
                           tail_terms_71
                        ;

bridi_tail_B_52         :  bridi_tail_C_53
                        |  bridi_tail_C_53  GIhEK_BO_813  bridi_tail_B_52
                           tail_terms_71
                        ;

bridi_tail_C_53         :  gek_sentence_54
                        |  selbri_130  tail_terms_71
                        ;

gek_sentence_54         :  GEK_807  subsentence_41
                                GIK_816  subsentence_41  tail_terms_71
                        |  tag_491  KE_493  gek_sentence_54  KEhE_gap_466
                        |  NA_445  gek_sentence_54
                        ;

tail_terms_71           :  terms_80  VAU_gap_456
                        |  VAU_gap_456
                        ;


terms_80                :  terms_A_81
                        |  terms_80  terms_A_81
                        ;

terms_A_81              :  terms_B_82
                        |  terms_A_81  PEhE_494  JOIK_JEK_422  terms_B_82
                        ;

terms_B_82              :  term_83
                        |  terms_B_82  CEhE_495  term_83
                        ;

term_83                 :  sumti_90
                        |  modifier_84
                        |  term_set_85
                        |  NA_KU_810
                        ;

modifier_84             :  mod_head_490  gap_450
                        |  mod_head_490  sumti_90
                        ;

term_set_85             :  NUhI_496  terms_80  NUhU_gap_460
                        |  NUhI_496  GEK_807  terms_80  NUhU_gap_460
                                GIK_816  terms_80  NUhU_gap_460
                        ;


sumti_90                :  sumti_A_91
                        |  sumti_A_91  VUhO_497  relative_clauses_121
                        ;

sumti_A_91              :  sumti_B_92
                        |  sumti_B_92  EK_KE_804  sumti_90  KEhE_gap_466
                        |  sumti_B_92  JOIK_KE_823  sumti_90  KEhE_gap_466
                        ;

sumti_B_92              :  sumti_C_93
                        |  sumti_B_92  JOIK_EK_421  sumti_C_93  
                        ;

sumti_C_93              :  sumti_D_94
                        |  sumti_D_94  EK_BO_803  sumti_C_93
                        |  sumti_D_94  JOIK_BO_822  sumti_C_93
                        ;

sumti_D_94              :  sumti_E_95
                        |  GEK_807  sumti_90  GIK_816  sumti_D_94
                        ;

sumti_E_95              :  sumti_F_96
                        |  sumti_F_96  relative_clauses_121
                           /* indefinite sumti */
                        |  quantifier_300  selbri_130  gap_450
                        |  quantifier_300  selbri_130
                                gap_450  relative_clauses_121
                        ;

sumti_F_96              :  sumti_G_97
                           /* outer-quantified sumti */
                        |  quantifier_300  sumti_G_97
                        ;

sumti_G_97              :  qualifier_483  sumti_90  LUhU_gap_463
                        |  qualifier_483  relative_clauses_121
                                sumti_90  LUhU_gap_463
                           /*sumti grouping, set/mass/individual conversion */
                           /*also sumti scalar negation */
                        |  anaphora_400
                        |  LA_499  cmene_404
                        |  LA_499  relative_clauses_121  cmene_404
                        |  LI_489  MEX_310  LOhO_gap_472
                        |  description_110
                        |  quote_arg_432
                        ;



description_110         :  LA_499  sumti_tail_111  gap_450
                        |  LE_488  sumti_tail_111  gap_450
                        ;

sumti_tail_111          :  sumti_tail_A_112
                           /* inner-quantified sumti relative clause */
                        |  relative_clauses_121  sumti_tail_A_112
                           /* pseudo-possessive
                              (an abbreviated inner restriction);
                              note that sumti cannot be quantified */
                        |  sumti_G_97  sumti_tail_A_112
                           /* pseudo-possessive with outer restriction */
                        |  sumti_G_97  relative_clauses_121  sumti_tail_A_112
                        ;

sumti_tail_A_112        :  selbri_130
                        |  selbri_130  relative_clauses_121
                           /* explicit inner quantifier */
                        |  quantifier_300  selbri_130
                           /* quantifier both internal to a description,
                              and external to a sumti thereby made specific */
                        |  quantifier_300  selbri_130  relative_clauses_121
                        |  quantifier_300  sumti_90
                        ;

relative_clauses_121    :  relative_clause_122
                        |  relative_clauses_121  ZIhE_487  relative_clause_122
                        ;

relative_clause_122     :  GOI_485  term_83  GEhU_gap_464
                        |  NOI_484  subsentence_41  KUhO_gap_469
                        ;


selbri_130              :  tag_491  selbri_A_131
                        |  selbri_A_131
                        ;

selbri_A_131            :  selbri_B_132
                        |  NA_445  selbri_130
                        ;

selbri_B_132            :  selbri_C_133
                        |  selbri_C_133  CO_443  selbri_B_132
                        ;

selbri_C_133            :  selbri_D_134
                        |  selbri_C_133  selbri_D_134
                        ;

selbri_D_134            :  selbri_E_135
                        |  selbri_D_134  JOIK_JEK_422  selbri_E_135
                        |  selbri_D_134  JOIK_KE_823  selbri_C_133
                                KEhE_gap_466
                        ;

selbri_E_135            :  selbri_F_136
                        |  selbri_F_136  JEK_BO_821  selbri_E_135
                        |  selbri_F_136  JOIK_BO_822  selbri_E_135
                        ;

selbri_F_136            :  tanru_unit_150
                        |  tanru_unit_150  BO_479  selbri_F_136
                        |  GUhEK_selbri_137
                        |  NAhE_482  GUhEK_selbri_137
                        ;

GUhEK_selbri_137        :  GUhEK_808  selbri_130  GIK_816  selbri_F_136
                        ;


tanru_unit_150          :  tanru_unit_A_151
                        |  tanru_unit_150  CEI_444  tanru_unit_A_151
                        ;


tanru_unit_A_151        :  tanru_unit_B_152
                        |  tanru_unit_B_152  linkargs_160
                        ;

tanru_unit_B_152        :  bridi_valsi_407
                        |  KE_493  selbri_C_133  KEhE_gap_466
                        |  SE_480  tanru_unit_B_152
                        |  JAI_478  tag_491  tanru_unit_B_152
                        |  JAI_478  tanru_unit_B_152
                        |  ME_477  sumti_90  MEhU_gap_465
                        |  ME_477  sumti_90  MEhU_gap_465  MOI_476
                        |  NUhA_475  MEX_operator_374
                        |  NAhE_482  tanru_unit_B_152
                        |  NU_425  subsentence_41  KEI_gap_453
                        ;


linkargs_160            :  BE_446  term_83  BEhO_gap_467
                        |  BE_446  term_83  links_161  BEhO_gap_467
                        ;

links_161               :  BEI_442  term_83
                        |  BEI_442  term_83  links_161
                        ;


/*  Main entry point for MEX; everything but a number must be in parens.   */

quantifier_300          :  number_812  BOI_gap_461
                        |  left_bracket_470  MEX_310  right_bracket_gap_471
                        ;



/*  Entry point for MEX used after LI; no parens needed, but LI now has an
    elidable terminator. (This allows us to express the difference between
    "the expression a + b" and "the expression (a + b)"_)   */

/*  This rule supports left-grouping infix expressions and reverse Polish
    expressions. To handle infix monadic, use a null operand; to handle
    infix with more than two operands (whatever that means) use an extra
    operator or an array operand.   */

MEX_310                 :  MEX_A_311
                        |  MEX_310  operator_370  MEX_A_311
                        |  FUhA_441  rp_expression_330
                        ;

/*  Support for right-grouping (short scope) infix expressions with BIhE.  */

MEX_A_311               :  MEX_B_312
                        |  MEX_B_312  BIhE_439  operator_370  MEX_A_311
                        ;

/*  Support for forethought (Polish) expressions. These begin with a
    forethought flag, then the operator and then the argument(s).  */

MEX_B_312               :  operand_381
                        |  operator_370  MEX_C_313  MEX_gap_452
                        |  PEhO_438  operator_370  MEX_C_313  MEX_gap_452
                        ;

MEX_C_313               :  MEX_B_312
                        |  MEX_C_313  MEX_B_312
                        ;


/*  Reverse Polish expressions always have exactly two operands.
    To handle one operand, use a null operand;
    to handle more than two operands, use a null operator.  */

rp_expression_330       :  rp_operand_332  rp_operand_332  operator_370
                        ;


rp_operand_332          :  operand_381
                        |  rp_expression_330
                        ;


/*  Operators may be joined by logical connectives. */

operator_370            :  operator_A_371
                        |  operator_370  JOIK_JEK_422  operator_A_371
                        |  operator_370  JOIK_KE_823  operator_370
                                KEhE_gap_466
                        ;

operator_A_371          :  operator_B_372
                        |  GUhEK_808  operator_A_371  GIK_816  operator_B_372
                        |  operator_B_372  JOIK_BO_822  operator_A_371
                        |  operator_B_372  JEK_BO_821  operator_A_371
                        ;

operator_B_372          :  MEX_operator_374
                        |  KE_493  operator_370  KEhE_gap_466
                        ;

MEX_operator_374        :  VUhU_679
                        |  VUhU_679  free_modifier_32
                        |  SE_480  MEX_operator_374
   /* changes argument order */
                        |  NAhE_482  MEX_operator_374
   /* scalar negation */
                        |  MAhO_430  MEX_310  TEhU_gap_473
                        |  NAhU_429  selbri_130  TEhU_gap_473
                        ;


operand_381             :  operand_A_382
                        |  operand_A_382  EK_KE_804  operand_381  KEhE_gap_466
                        |  operand_A_382  JOIK_KE_823  operand_381  KEhE_gap_466
                        ;

operand_A_382           :  operand_B_383
                        |  operand_A_382  JOIK_EK_421  operand_B_383
                        ;

operand_B_383           :  operand_C_385
                        |  operand_C_385  EK_BO_803  operand_B_383
                        |  operand_C_385  JOIK_BO_822  operand_B_383
                        ;

operand_C_385           :  quantifier_300
                        |  lerfu_string_817  BOI_gap_461
   /* lerfu string as operand - classic math variable */
                        |  NIhE_428  selbri_130  TEhU_gap_473
   /* quantifies a bridi - inverse of -MOI */
                        |  MOhE_427  sumti_90  TEhU_gap_473
   /* quantifies a sumti - inverse of LI */
                        |  JOhI_431  MEX_C_313  TEhU_gap_473
                        |  GEK_807  operand_381  GIK_816  operand_C_385
                        |  qualifier_483  operand_381  LUhU_gap_463
                        ;


/* _400 series constructs are mostly specific strings, some of which may
   also be used by the lexer; the lexer should not use any reference to
   terminals numbered less than _400, as they have grammars composed on
   non-deterministic strings of selma'o.  Some above _400 also are this
   way, so care should be taken; this is especially true for those that
   reference free_modifier_32.  */


anaphora_400            :  KOhA_555
                        |  KOhA_555  free_modifier_32
                        |  lerfu_string_817  BOI_gap_461
                        ;


cmene_404               :  cmene_A_405
                        |  cmene_A_405  free_modifier_32
                        ;

cmene_A_405             :  CMENE_518  /* pause */
                        |  cmene_A_405  CMENE_518  /* pause*/
/* multiple CMENE are identified morphologically (by the lexer) -- separated by
   consonant & pause */
                        ;


bridi_valsi_407         :  bridi_valsi_A_408
                        |  bridi_valsi_A_408  free_modifier_32
                        ;

bridi_valsi_A_408       :  BRIVLA_509
                        |  PA_MOI_824
                        |  GOhA_543
                        |  GOhA_543  RAhO_593
                        ;

para_mark_410           :  NIhO_584
                        |  NIhO_584  free_modifier_32
                        |  NIhO_584  para_mark_410
                        ;


indicators_411          :  indicators_A_412
                        |  FUhE_535  indicators_A_412
                        ;

indicators_A_412        :  indicator_413
                        |  indicators_A_412  indicator_413
                        ;

indicator_413           :  UI_612
                        |  CAI_515
                        |  UI_612  NAI_581
                        |  CAI_515  NAI_581
                        |  Y_619
                        |  DAhO_524
                        |  FUhO_536
                        ;

DOI_415                 :  DOI_525
                        |  COI_416
                        |  COI_416  DOI_525
                        ;

COI_416                 :  COI_A_417
                        |  COI_416  COI_A_417
                        ;

COI_A_417               :  COI_520
                        |  COI_520  NAI_581
                        ;


JOIK_EK_421             :  EK_802
                        |  JOIK_806
                        |  JOIK_806  free_modifier_32
                        ;

JOIK_JEK_422            :  JOIK_806
                        |  JOIK_806  free_modifier_32
                        |  JEK_805
                        |  JEK_805  free_modifier_32
                        ;


XI_424                  :  XI_618
                        |  XI_618  free_modifier_32
                        ;

NU_425                  :  NU_A_426
                        |  NU_425  JOIK_JEK_422  NU_A_426
                        ;

NU_A_426                :  NU_586
                        |  NU_586  NAI_581
                        |  NU_586  free_modifier_32
                        |  NU_586  NAI_581  free_modifier_32
                        ;

MOhE_427                :  MOhE_664
                        |  MOhE_664  free_modifier_32
                        ;

NIhE_428                :  NIhE_666
                        |  NIhE_666  free_modifier_32
                        ;

NAhU_429                :  NAhU_665
                        |  NAhU_665  free_modifier_32
                        ;

MAhO_430                :  MAhO_662
                        |  MAhO_662  free_modifier_32
                        ;

JOhI_431                :  JOhI_657
                        |  JOhI_657  free_modifier_32
                        ;

quote_arg_432           :  quote_arg_A_433
                        |  quote_arg_A_433  free_modifier_32
                        ;

quote_arg_A_433         :  ZOI_quote_434
                        |  ZO_quote_435
                        |  LOhU_quote_436
                        |  LU_571  text_0  LIhU_gap_448
                        ;

/* The quoted material in the following three terminals must be identified by
   the lexer, but no additional lexer processing is needed. */

ZOI_quote_434           :  ZOI_627  any_word_698
                                  /*pause*/  anything_699  /*pause*/  any_word_698
                        ;

/* 'pause' is morphemic, represented by '.' The lexer assembles anything_699 */

ZO_quote_435            :  ZO_626  any_word_698
                        ;

/* 'word' may not be a compound; but it can be any valid Lojban selma'o value,
   including ZO, ZOI, SI, SA, SU. The preparser will not lex the word per its
   normal selma'o. */

LOhU_quote_436          :  LOhU_569  any_words_697  LEhU_565
                        ;

/* 'words' may be any Lojban words, with no claim of grammaticality; the
   preparser will not lex the individual words per their normal selma'o;
   used to quote ungrammatical Lojban, equivalent to the * or ? writing
   convention for such text.  */

/* The preparser needs one bit of sophistication for this rule.  A
   quoted string should be able to contain other quoted strings - this is
   only a problem for a LOhU quote itself, since the LEhU clossing this
   quote would otherwise close the outer quotes, which is incorrect.  For
   this purpose, we will cheat on the use of ZO in such a quote (since this
   is ungrammatical text, it is a sign ignored by the parser).  Use ZO to
   mark any nested quotation LOhU.  The preparser then will absorb it by
   the ZO rule, before testing for LOhU.  This is obviously not the
   standard usage for ZO, which would otherwise cause the result to be a
   sumti.  But, since the result will be part of an unparsed string anyway,
   it doesn't matter.  */

/* It may be seen that any of the ZO/ZOI/LOhU trio of quotation markers
   may contain the powerful metalinguistic erasers.  Since these quotations
   are not parsed internally, these operators are ignored within the quote.
   To erase a ZO, then, two SI's are needed after giving a quoted word of
   any type.  ZOI takes four SI's, with the ENTIRE BODY OF THE QUOTE
   treated as a single 'word' since it is one selma'o.  Thus one for the
   quote body, two for the single word delimiters, and one for the ZOI.  In
   LOhU, the entire body is treated as a single word, so three SI's can
   erase it.  */

/* All rule terminator names with 'gap' in them are potentially
   elidable, where such elision does not cause an ambiguity.  This is
   implemented through use of the YACC 'error' token, which effectively
   recovers from an elision.  */

FIhO_437                :  FIhO_532
                        |  FIhO_532  free_modifier_32
                        ;

PEhO_438                :  PEhO_673
                        |  PEhO_673  free_modifier_32
                        ;

BIhE_439                :  BIhE_650
                        |  BIhE_650  free_modifier_32
                        ;

SEI_440                 :  SEI_597
                        |  SEI_597  free_modifier_32
                        ;

FUhA_441                :  FUhA_655
                        |  FUhA_655  free_modifier_32
                        ;

BEI_442                 :  BEI_505
                        |  BEI_505  free_modifier_32
                        ;

CO_443                  :  CO_519
                        |  CO_519  free_modifier_32
                        ;

CEI_444                 :  CEI_516
                        |  CEI_516  free_modifier_32
                        ;

NA_445                  :  NA_578
                        |  NA_578  free_modifier_32
                        ;

BE_446                  :  BE_504
                        |  BE_504  free_modifier_32
                        ;

TUhE_447                :  TUhE_610
                        |  TUhE_610  free_modifier_32
                        ;


LIhU_gap_448            :  LIhU_567
                        |  error
                        ;


gap_450                 :  KU_556
                        |  KU_556  free_modifier_32
                        |  error
                        ;

front_gap_451           :  CU_521
                        |  CU_521  free_modifier_32
                        ;

MEX_gap_452             :  KUhE_658
                        |  KUhE_658  free_modifier_32
                        |  error
                        ;

KEI_gap_453             :  KEI_552
                        |  KEI_552  free_modifier_32
                        |  error
                        ;

TUhU_gap_454            :  TUhU_611
                        |  TUhU_611  free_modifier_32
                        |  error
                        ;

VAU_gap_456             :  VAU_614
                        |  VAU_614  free_modifier_32
                        |  error
                        ;

/* redundant to attach a free modifier on the following */

DOhU_gap_457            :  DOhU_526
                        |  error
                        ;

FEhU_gap_458            :  FEhU_531
                        |  FEhU_531  free_modifier_32
                        |  error
                        ;

SEhU_gap_459            :  SEhU_598
                        |  error
/* a free modifier on a discursive should be somewhere within the discursive.
   See SEI_440 */
                        ;

NUhU_gap_460            :  NUhU_588
                        |  NUhU_588  free_modifier_32
                        |  error
                        ;


BOI_gap_461             :  BOI_651
                        |  BOI_651  free_modifier_32
                        |  error
                        ;

sub_gap_462             :  BOI_651
                        |  error
                        ;


LUhU_gap_463            :  LUhU_573
                        |  LUhU_573  free_modifier_32
                        |  error
                        ;


GEhU_gap_464            :  GEhU_538
                        |  GEhU_538  free_modifier_32
                        |  error
                        ;


MEhU_gap_465            :  MEhU_575
                        |  MEhU_575   free_modifier_32
                        |  error
                        ;


KEhE_gap_466            :  KEhE_550
                        |  KEhE_550  free_modifier_32
                        |  error
                        ;


BEhO_gap_467            :  BEhO_506
                        |  BEhO_506  free_modifier_32
                        |  error
                        ;


TOI_gap_468             :  TOI_607
                        |  error
                        ;


KUhO_gap_469            :  KUhO_557
                        |  KUhO_557  free_modifier_32
                        |  error
                        ;


left_bracket_470        :  VEI_677
                        |  VEI_677  free_modifier_32
                        ;

right_bracket_gap_471   :  VEhO_678
                        |  VEhO_678  free_modifier_32
                        |  error
                        ;

LOhO_gap_472            :  LOhO_568
                        |  LOhO_568  free_modifier_32
                        |  error
                        ;

TEhU_gap_473            :  TEhU_675
                        |  TEhU_675  free_modifier_32
                        |  error
                        ;

right_br_no_free_474    :  VEhO_678
                        |  error
                        ;



NUhA_475                :  NUhA_667
                        |  NUhA_667  free_modifier_32
                        ;

MOI_476                 :  MOI_663
                        |  MOI_663  free_modifier_32
                        ;

ME_477                  :  ME_574
                        |  ME_574  free_modifier_32
                        ;

JAI_478                 :  JAI_547
                        |  JAI_547  free_modifier_32
                        ;

BO_479                  :  BO_508
                        |  BO_508  free_modifier_32
                        ;

SE_480                  :  SE_596
                        |  SE_596  free_modifier_32
                        ;


FA_481                  :  FA_527
                        |  FA_527  free_modifier_32
                        ;

NAhE_482                :  NAhE_583
                        |  NAhE_583  free_modifier_32
                        ;

qualifier_483           :  LAhE_561
                        |  LAhE_561  free_modifier_32
                        |  NAhE_BO_809
                        ;

NOI_484                 :  NOI_585
                        |  NOI_585  free_modifier_32
                        ;

GOI_485                 :  GOI_542
                        |  GOI_542  free_modifier_32
                        ;

subscript_486           :  XI_424  number_812  sub_gap_462
                        |  XI_424  left_bracket_470  MEX_310
                                right_br_no_free_474
                        |  XI_424  lerfu_string_817  sub_gap_462
                        ;

ZIhE_487                :  ZIhE_625
                        |  ZIhE_625  free_modifier_32
                        ;

LE_488                  :  LE_562
                        |  LE_562  free_modifier_32
                        ;

LI_489                  :  LI_566
                        |  LI_566  free_modifier_32
                        ;

mod_head_490            :  tag_491
                        |  FA_481
                        ;


tag_491                 :  tense_modal_815
                        |  tag_491  JOIK_JEK_422  tense_modal_815
                        ;

ZOhU_492                :  ZOhU_628
                        |  ZOhU_628  free_modifier_32
                        ;

KE_493                  :  KE_551
                        |  KE_551  free_modifier_32
                        ;

PEhE_494                :  PEhE_591
                        |  PEhE_591  free_modifier_32
                        ;

CEhE_495                :  CEhE_517
                        |  CEhE_517  free_modifier_32
                        ;

NUhI_496                :  NUhI_587
                        |  NUhI_587  free_modifier_32
                        ;

VUhO_497                :  VUhO_617
                        |  VUhO_617  free_modifier_32
                        ;

SOI_498                 :  SOI_602
                        |  SOI_602  free_modifier_32
                        ;

LA_499                  :  LA_558
                        |  LA_558  free_modifier_32
                        ;


utterance_ordinal_801   :  lexer_A_905
                        ;

EK_802                  :  lexer_B_910
                        |  lexer_B_910  free_modifier_32
                        ;

EK_BO_803               :  lexer_C_915
                        |  lexer_C_915  free_modifier_32
                        ;

EK_KE_804               :  lexer_D_916
                        |  lexer_D_916  free_modifier_32
                        ;

JEK_805                 :  lexer_E_925
                        ;

JOIK_806                :  lexer_F_930
                        ;

GEK_807                 :  lexer_G_935
                        |  lexer_G_935  free_modifier_32
                        ;

GUhEK_808               :  lexer_H_940
                        |  lexer_H_940  free_modifier_32
                        ;

NAhE_BO_809             :  lexer_I_945
                        |  lexer_I_945  free_modifier_32
                        ;

NA_KU_810               :  lexer_J_950
                        |  lexer_J_950  free_modifier_32
                        ;

I_BO_811                :  lexer_K_955
                        |  lexer_K_955  free_modifier_32
                        ;

number_812              :  lexer_L_960
                        ;

GIhEK_BO_813            :  lexer_M_965
                        |  lexer_M_965  free_modifier_32
                        ;

GIhEK_KE_814            :  lexer_N_966
                        |  lexer_N_966  free_modifier_32
                        ;

tense_modal_815         :  lexer_O_970
                        |  lexer_O_970  free_modifier_32
                        |  FIhO_437  selbri_130  FEhU_gap_458
                        ;

GIK_816                 :  lexer_P_980
                        |  lexer_P_980  free_modifier_32
                        ;


lerfu_string_817        :  lexer_Q_985
                        ;

GIhEK_818               :  lexer_R_990
                        |  lexer_R_990  free_modifier_32
                        ;

I_819                   :  lexer_S_995
                        |  lexer_S_995  free_modifier_32
                        ;

I_JEK_820               :  lexer_T_1000
                        |  lexer_T_1000  free_modifier_32
                        ;

JEK_BO_821              :  lexer_U_1005
                        |  lexer_U_1005  free_modifier_32
                        ;

JOIK_BO_822             :  lexer_V_1010
                        |  lexer_V_1010  free_modifier_32
                        ;

JOIK_KE_823             :  lexer_W_1015
                        |  lexer_W_1015  free_modifier_32
                        ;

PA_MOI_824              :  lexer_Y_1025
                        ;


/* The following rules are used only in lexer processing.  They have been
   tested for ambiguity at various levels in the YACC grammar, but are in
   the recursive descent lexer in the current parser.  The lexer inserts
   the lexer tokens before the processed strings, but leaves the original
   tokens.  */

lexer_A_905             :  lexer_A_701  utt_ordinal_root_906
                        ;

utt_ordinal_root_906    :  lerfu_string_root_986  MAI_661
                        |  number_root_961  MAI_661
                        ;


lexer_B_910             :  lexer_B_702  EK_root_911
                        ;

EK_root_911             :  A_501
                        |  SE_596  A_501
                        |  NA_578  A_501
                        |  A_501  NAI_581
                        |  SE_596  A_501  NAI_581
                        |  NA_578  A_501  NAI_581
                        |  NA_578  SE_596  A_501
                        |  NA_578  SE_596  A_501  NAI_581
                        ;


lexer_C_915             :  lexer_C_703  EK_root_911  BO_508
                        |  lexer_C_703  EK_root_911  simple_tag_971  BO_508
                        ;


lexer_D_916             :  lexer_D_704  EK_root_911  KE_551
                        |  lexer_D_704  EK_root_911  simple_tag_971  KE_551
                        ;


lexer_E_925             :  lexer_E_705  JEK_root_926
                        ;

JEK_root_926            :  JA_546
                        |  JA_546  NAI_581
                        |  NA_578  JA_546
                        |  NA_578  JA_546  NAI_581
                        |  SE_596  JA_546
                        |  SE_596  JA_546  NAI_581
                        |  NA_578  SE_596  JA_546
                        |  NA_578  SE_596  JA_546  NAI_581
                        ;


lexer_F_930             :  lexer_F_706  JOIK_root_931
                        ;

JOIK_root_931           :  JOI_548
                        |  JOI_548  NAI_581
                        |  SE_596  JOI_548
                        |  SE_596  JOI_548  NAI_581
                        |  interval_932
                        |  GAhO_656  interval_932  GAhO_656
                        ;

interval_932            :  BIhI_507
                        |  BIhI_507  NAI_581
                        |  SE_596  BIhI_507
                        |  SE_596  BIhI_507  NAI_581
                        ;




lexer_G_935             :  lexer_G_707  GA_537
                        |  lexer_G_707  SE_596  GA_537
                        |  lexer_G_707  GA_537  NAI_581
                        |  lexer_G_707  SE_596  GA_537  NAI_581
                        |  lexer_G_707  simple_tag_971  GIK_root_981
                        |  lexer_G_707  JOIK_root_931  GI_539
                        ;


lexer_H_940             :  lexer_H_708  GUhA_544
                        |  lexer_H_708  SE_596  GUhA_544
                        |  lexer_H_708  GUhA_544  NAI_581
                        |  lexer_H_708  SE_596  GUhA_544  NAI_581
                        ;


lexer_I_945             :  lexer_I_709  NAhE_583  BO_508
                        ;


lexer_J_950             :  lexer_J_710  NA_578  KU_556
                        ;


lexer_K_955             :  lexer_K_711  I_root_956  BO_508
                        |  lexer_K_711  I_root_956  simple_tag_971  BO_508
                        ;

I_root_956              :  I_545
                        |  I_545  simple_JOIK_JEK_957
                        ;


simple_JOIK_JEK_957     :  JOIK_806
                        |  JEK_805
                        ;
                        /* no freemod in this version; cf. JOIK_JEK_422 */
                        /* this reference to a version of JOIK and JEK
                           which already have the lexer tokens attached
                           prevents shift/reduce errors.  The problem is
                           resolved in a hard-coded parser implementation
                           which builds lexer_K, before lexer_S, before
                           lexer_E and lexer_F. */



lexer_L_960             :  lexer_L_712  number_root_961
                        ;


number_root_961         :  PA_672
                        |  number_root_961  PA_672
                        |  number_root_961  lerfu_word_987
                        ;

lexer_M_965             :  lexer_M_713  GIhEK_root_991  BO_508
                        |  lexer_M_713  GIhEK_root_991  simple_tag_971  BO_508
                        ;


lexer_N_966             :  lexer_N_714  GIhEK_root_991  KE_551
                        |  lexer_N_714  GIhEK_root_991  simple_tag_971  KE_551
                        ;


lexer_O_970             :  lexer_O_715  simple_tense_modal_972
                        ;
/* the following rule is a lexer version of non-terminal _815 for compounding
   PU/modals; it disallows the lexer picking out FIhO clauses, which would
   require it to have knowledge of the main parser grammar */

simple_tag_971          :  simple_tense_modal_972
                        |  simple_tag_971  simple_JOIK_JEK_957
                                simple_tense_modal_972
                        ;


simple_tense_modal_972  :  simple_tense_modal_A_973
                        |  NAhE_583  simple_tense_modal_A_973
                        |  KI_554
                        |  CUhE_522
                        ;

simple_tense_modal_A_973:  modal_974
                        |  modal_974  KI_554
                        |  tense_A_977
                        ;

modal_974               :  modal_A_975
                        |  modal_A_975  NAI_581
                        ;

modal_A_975             :  BAI_502
                        |  SE_596  BAI_502
                        ;

tense_A_977             :  tense_B_978
                        |  tense_B_978  KI_554
                        ;

tense_B_978             :  tense_C_979
                        |  CAhA_514
                        |  tense_C_979  CAhA_514
                        ;
/* specifies actuality/potentiality of the bridi */

/* puca'a = actually was */
/* baca'a = actually will be */
/* bapu'i = can and will have */
/* banu'o = can, but won't have yet */
/* canu'ojebapu'i = can, hasn't yet, but will */

tense_C_979             :  time_1030
   /* time-only */
   /* space defaults to time-space reference space */

                        |  space_1040
   /* can include time if specified with VIhA */
   /* otherwise time defaults to the time-space reference time */

                        |  time_1030  space_1040
   /* time and space - If space_1040 is marked with
   VIhA for space-time the tense may be self-contradictory */
   /* interval prop before space_time is for time distribution */
                        |  space_1040  time_1030
                        ;

lexer_P_980             :  lexer_P_716  GIK_root_981
                        ;

GIK_root_981            :  GI_539
                        |  GI_539  NAI_581
                        ;

lexer_Q_985             :  lexer_Q_717  lerfu_string_root_986
                        ;

lerfu_string_root_986   :  lerfu_word_987
                        |  lerfu_string_root_986  lerfu_word_987
                        |  lerfu_string_root_986  PA_672
                        ;

lerfu_word_987          :  BY_513
                        |  LAU_559  lerfu_word_987
                        |  TEI_605  lerfu_string_root_986  FOI_533
                        ;


lexer_R_990             :  lexer_R_718  GIhEK_root_991
                        ;


GIhEK_root_991          :  GIhA_541
                        |  SE_596  GIhA_541
                        |  NA_578  GIhA_541
                        |  GIhA_541  NAI_581
                        |  SE_596  GIhA_541  NAI_581
                        |  NA_578  GIhA_541  NAI_581
                        |  NA_578  SE_596  GIhA_541
                        |  NA_578  SE_596  GIhA_541  NAI_581
                        ;


lexer_S_995             :  lexer_S_719  I_545
                        ;

lexer_T_1000            :  lexer_T_720  I_545  simple_JOIK_JEK_957
                        ;


lexer_U_1005            :  lexer_U_721  JEK_root_926  BO_508
                        |  lexer_U_721  JEK_root_926  simple_tag_971  BO_508
                        ;

lexer_V_1010            :  lexer_V_722  JOIK_root_931  BO_508
                        |  lexer_V_722  JOIK_root_931  simple_tag_971  BO_508
                        ;

lexer_W_1015            :  lexer_W_723  JOIK_root_931  KE_551
                        |  lexer_W_723  JOIK_root_931  simple_tag_971  KE_551
                        ;

lexer_Y_1025            :  lexer_Y_725  number_root_961  MOI_663
                        |  lexer_Y_725  lerfu_string_root_986  MOI_663
                        ;



time_1030               :  ZI_624
                        |  ZI_624  time_A_1031
                        |  time_A_1031
                        ;

time_A_1031             :  time_B_1032
                        |  time_interval_1034
                        |  time_B_1032  time_interval_1034
                        ;

time_B_1032             :  time_offset_1033
                        |  time_B_1032  time_offset_1033
                        ;


time_offset_1033        :  time_direction_1035
                        |  time_direction_1035  ZI_624
                        ;


time_interval_1034      :  ZEhA_622
                        |  ZEhA_622  time_direction_1035
                        |  time_int_props_1036
                        |  ZEhA_622  time_int_props_1036
                        |  ZEhA_622  time_direction_1035  time_int_props_1036
                        ;

time_direction_1035     :  PU_592
                        |  PU_592  NAI_581
                        ;

time_int_props_1036     :  interval_property_1051
                        |  time_int_props_1036  interval_property_1051
                        ;


space_1040              :  space_A_1042
                        |  space_motion_1041
                        |  space_A_1042  space_motion_1041
                        ;


space_motion_1041       :  MOhI_577  space_offset_1045
                        ;

space_A_1042            :  VA_613
                        |  VA_613  space_B_1043
                        |  space_B_1043
                        ;

space_B_1043            :  space_C_1044
                        |  space_intval_1046
                        |  space_C_1044  space_intval_1046
                        ;

space_C_1044            :  space_offset_1045
                        |  space_C_1044  space_offset_1045
                        ;


space_offset_1045       :  space_direction_1048
                        |  space_direction_1048  VA_613
                        ;


space_intval_1046       :  space_intval_A_1047
                        |  space_intval_A_1047  space_direction_1048
                        |  space_int_props_1049
                        |  space_intval_A_1047  space_int_props_1049
                        |  space_intval_A_1047  space_direction_1048
                                  space_int_props_1049
                        ;


space_intval_A_1047     :  VEhA_615
                        |  VIhA_616
                        |  VEhA_615  VIhA_616
                        ;

space_direction_1048    :  FAhA_528
                        |  FAhA_528  NAI_581
                        ;

space_int_props_1049    :  space_int_props_A_1050
                        |  space_int_props_1049  space_int_props_A_1050
                        ;

space_int_props_A_1050  : FEhE_530  interval_property_1051
                        ;

/* This terminal gives an interval size in space-time (VEhA), and possibly a
   dimensionality of the interval.  The dimensionality may also be used
   with the interval size left unspecified.  When this terminal is used for the
   spacetime origin, then barring any overriding VIhA, a VIhA here defines
   the dimensionality of the space-time being discussed.                 */




interval_property_1051  :  number_root_961  ROI_594
                        |  number_root_961  ROI_594  NAI_581
                        |  TAhE_604
                        |  TAhE_604  NAI_581
                        |  ZAhO_621
                        |  ZAhO_621  NAI_581
                        ;

/* extensional/intensional interval parameters */
/* These may be appended to any defined interval, or may stand in place of
   either time or space tenses.  If no other tense is present, this terminal
   stands for the time-space interval parameter with an unspecified interval.*/

   /* roroi = always and everywhere */
   /* roroiku'avi = always here (ku'a = intersection) */
   /* puroroi = always in the past
   /* paroi = once upon a time (somewhere) */
   /* paroiku'avi = once upon a time here */


/* The following are "Lexer-only rules", covered by steps 1-4 described
   at the beginning.  The grammar of these constructs is nonexistent,
   except possibly in cases where they interact with each other.  Even
   there, however, the effects are semantic rather than grammatical.  Where
   it is believed possible that conflicts could exist, the grammar of these
   constructs has been put in the above grammar, even though the
   lexer/Preparser will actually prevent these from being passed thru to
   the parse routine.  (Otherwise we have to put unacceptably fancy code in
   the PreParser to determine just when these can be passed thru, and when
   they can't.)  Constructs in this category include quotes and indicators
   as defined above.  (The above grammar handles utterance scope
   (free_modifier) and clause scope (gap) applications of the latter,
   however, and indicators should be allowed to be absorbed into almost any
   word without changing its grammar.

   SI_601, SA_595, and SU_603 are metalinguistic erasers.

token_1100              :  any_word_698
                        |  BAhE_503  any_word_698
                        |  anything_699
                        |  any_word_698  BU_511
                        |  any_word_698  DAhO_524
                        |  any_word_698  FUhO_536
                        |  any_word_698  FUhE_535
                        |  any_word_698  UI_612
                        |  any_word_698  UI_612  NAI_581
                        |  any_word_698  Y_619
                        |  any_word_698  CAI_515
                        |  any_word_698  CAI_515  NAI_581
                        |  UI_612  NAI_581
                        |  CAI_515  NAI_581
                        ;

null_1101               :  any_word_698  SI_601
                        |  possibly_unlexable_word  (PAUSE)  SI_601
                        |  utterance_20  SA_595
                        |  possibly unlexable string  (PAUSE)  SA_595
                           erases back to the last individual token
                           I or NIhO or start of text, ignoring the
                           insides of ZOI, ZO, and LOhU/LEhU quotes.
                           Start of text is defined for SU below.
                        |  text_C_3  SU_603
                        |  possibly unparsable text  (PAUSE)  SU_603
                           erases back to start of text which is the
                           beginning of a speaker's statement,
                           a parenthesis (TO/TOI), a LU/LIhU quote,
                           or a TUhE/TUhU utterance string.
                        ;


*/
%%

