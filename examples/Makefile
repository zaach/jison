#
# You can build each example to its own directory in ./output/<example>
#

JISON = node ../lib/cli.js -o ./output/$@/


ERROR_HANDLING_TARGETS =                                        \
			error-handling-and-yyclearin                        \
			error-handling-and-yyerrok-loopfix                  \
			error-handling-and-yyerrok-looping1                 \
			error-handling-and-yyerrok-looping2                 \
			error-handling-and-yyerrok-macro                    \
			error-handling-and-yyerrok-part1                    \
			error-handling-and-yyerrok-part2                    \
			error-handling-and-yyerrok-part3                    \
			error-handling-and-yyerrok-part4a                   \
			error-handling-and-yyerrok-part4b                   \
			error-handling-and-yyerrok-part5                    \
			error-recognition-actions                           \
			yacc-error-recovery



MISC_TARGETS =                                                   \
			basic                                               \
			basic2                                              \
			basic2_lex                                          \
			basic_lex                                           \
			basic_w_error_rule                                  \
			bloop                                               \
			calc_LA_on_demand                                   \
			calculator                                          \
			calculator_json                                     \
			ccalc                                               \
			classy                                              \
			classy_ast                                          \
			comments                                            \
			compiled_calc                                       \
			dism                                                \
			dism_lr0                                            \
			dot                                                 \
			$(ERROR_HANDLING_TARGETS)                           \
			error-only                                          \
			faking-multiple-start-rules                         \
			faking-multiple-start-rules-alt                     \
			flow                                                \
			formula                                             \
			grammar                                             \
			handlebars-BAD                                          \
			happyhappy                                          \
			inherited_y                                         \
			issue-254                                           \
			issue-289-BAD                                           \
			issue-293                                           \
			json_ast_js                                         \
			json_js                                             \
			klammergebirge                                      \
			lalr-but-not-slr                                    \
			lambdacalc                                          \
			lex                                                 \
			lr-but-not-lalr                                     \
			mfcalc                                              \
			no-prec-hack-needed									                \
			nv_classy_ast                                       \
			olmenu-proto2                                       \
			parser-to-lexer-communication-test                  \
			phraser                                             \
			precedence                                          \
			reduce_conflict                                     \
			regex                                               \
			semwhitespace                                       \
			test-epsilon-rules-early-reduce                     \
			test-literal-quote-tokens-in-grammar                \
			test-nonassociative-operator-0                      \
			test-nonassociative-operator-1                      \
			test-nonassociative-operator-2                      \
			theory-left-recurs-01                               \
			unicode                                             \
			unicode2                                            \
			with-includes                                       \
			with_custom_lexer



ALL_TARGETS =                                                   \
			$(MISC_TARGETS)                                     \
			$(ERROR_HANDLING_TARGETS)                           \
			ansic                                               \
			btyacc-ansiC                                        \
			btyacc-ansiC2                                       \
			btyacc-ftp                                          \
			btyacc-t1                                           \
			btyacc-t2                                           \
			c99                                                 \
			fsyacc-cgrammar                                     \
			gantt                                               \
			handlebars-BAD                                          \
			jscore                                              \
			lojban-300                                          \
			mermaid                                             \
			pascal-BAD                                              \
			tikiwikiparser                                      










all: $(ALL_TARGETS)

.PHONY: all clean superclean error-handling $(ALL_TARGETS) parser-to-lexer-communication-test--profiling


clean:
	-rm -rf output/

superclean: clean


error-handling: $(ERROR_HANDLING_TARGETS)

misc: $(MISC_TARGETS)

ansic:
	$(JISON) --main ./$@.jison

basic:
	$(JISON) --main ./$@.jison

basic_w_error_rule:
	$(JISON) --main ./$@.jison

basic2:
	$(JISON) --main ./$@.jison

basic2_lex:
	$(JISON) --main ./$@.jison

basic_lex:
	$(JISON) --main ./$@.jison

bloop:
	$(JISON) --main ./$@.y ./floop.l

# cannot compile a lexer on its own, so we provide a bogus grammar to go with that.
floop:
	$(JISON) --main $@-standalone.y ./$@.l

calculator:
	$(JISON) --main ./$@.jison

calc_LA_on_demand:
	$(JISON) --main ./$@.jison

calculator_json:
	$(JISON) --main ./calculator.json

classy:
	$(JISON) --main ./$@.jison ./classy.jisonlex

# test input file: classy_test.src
classy_ast:
	$(JISON) --main ./$@.jison

comments:
	$(JISON) --main ./$@.jison

dism:
	$(JISON) --main ./$@.jison

dism_lr0:
	$(JISON) --main ./$@.jison

# ./documentation--custom-lexer-NIL.js
# ./documentation--custom-lexer-ULcase.js
# ./documentation--mygenerator.js

formula:
	$(JISON) --main ./$@.jison

handlebars:
	$(JISON) --main ./handlebars.jison.y ./handlebars.jison.l

inherited_y:
	$(JISON) --main ./inherited.y

# build *AND* run the test:
issue-254:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-293:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-289:
	$(JISON) --main -t -p lalr ./$@.jison
	node ./output/$@/$@.js

jscore:
	$(JISON) --main ./$@.jison

json_js:
	-mkdir -p ./output/$@
	node ./json.js > ./output/$@/$@.js

json_ast_js:
	-mkdir -p ./output/$@
	node ./json_ast.js > ./output/$@/$@.js

lambdacalc:
	$(JISON) --main ./$@.jison

nv_classy_ast:
	$(JISON) --main ./$@.jison

phraser:
	$(JISON) --main ./$@.jison

precedence:
	$(JISON) --main ./$@.jison

reduce_conflict:
	$(JISON) --main ./$@.jison

regex:
	$(JISON) --main ./$@.jison

# input test file:  ./semwhitespace_ex.src
semwhitespace:
	$(JISON) --main ./$@.jison semwhitespace_lex.jison

tikiwikiparser:
	$(JISON) --main ./$@.jison

mermaid:
	$(JISON) --main ./$@.jison

dot:
	$(JISON) --main ./$@.jison

error-handling-and-yyclearin:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-loopfix:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-looping1:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-looping2:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-macro:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part1:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part2:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part3:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part4a:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part4b:
	$(JISON) --main ./$@.jison

error-handling-and-yyerrok-part5:
	$(JISON) --main ./$@.jison

error-recognition-actions:
	$(JISON) --main ./$@.jison

flow:
	$(JISON) --main ./$@.jison

fsyacc-cgrammar:
	$(JISON) --main ./$@.jison

gantt:
	$(JISON) --main ./$@.jison

happyhappy:
	$(JISON) --main ./$@.jison

unicode:
	$(JISON) --main ./$@.jison

lojban-300:
	$(JISON) --main ./$@.jison

mfcalc:
	$(JISON) --main ./$@.jison

no-prec-hack-needed:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

olmenu-proto2:
	$(JISON) --main ./$@.jison

unicode2:
	$(JISON) --main ./$@.jison

yacc-error-recovery:
	$(JISON) --main ./$@.jison

with-includes:
	$(JISON) --main ./$@.jison

with_custom_lexer:
	$(JISON) --main ./$@.jison

grammar:
	$(JISON) --main ./$@.jison

klammergebirge:
	$(JISON) --main ./$@.jison

lex:
	$(JISON) --main ./$@.jison lex_grammar.jisonlex

ccalc:
	$(JISON) --main ./$@-parse.y ./$@-lex.l

c99:
	$(JISON) --main ./$@.y ./$@.l

btyacc-ansiC:
	$(JISON) --main ./$@.y

btyacc-ansiC2:
	$(JISON) --main ./$@.y

btyacc-ftp:
	$(JISON) --main ./$@.y

btyacc-t1:
	$(JISON) --main ./$@.y

btyacc-t2:
	$(JISON) --main ./$@.y

error-only:
	$(JISON) --main ./$@.y

parser-to-lexer-communication-test--profiling:
	$(JISON) --main -p lalr ./parser-to-lexer-communication-test.jison
	node --prof ./output/$@/parser-to-lexer-communication-test.js
	# and now collect the profile info and dump it to a report file:
	node --prof-process $$( ls -t isolate-*-v8.log | head -n 1 ) | sed -f ./profile-report-filter.sed > ./output/$@/profile.$@.txt
	# and make sure the profile report is saved in a unique file which can be compared against other profile runs later on:
	cat ./output/$@/profile.$@.txt > ./output/$@/profile.$@.$$( date +%s%N ).txt

parser-to-lexer-communication-test:
	$(JISON) --main -p lr ./$@.jison
	node ./output/$@/$@.js

faking-multiple-start-rules:
	$(JISON) --main ./$@.jison

faking-multiple-start-rules-alt:
	$(JISON) --main ./$@.jison

pascal:
	$(JISON) --main ./$@.y ./$@.l

# couple of examples which test theoretical grammars published in various papers about LR et al:

# build *AND* run the test:
lalr-but-not-slr:
	$(JISON) --main -p lalr ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
lr-but-not-lalr:
	$(JISON) --main -p lr ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
theory-left-recurs-01:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
test-epsilon-rules-early-reduce:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
test-literal-quote-tokens-in-grammar:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
test-nonassociative-operator-0:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
test-nonassociative-operator-1:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
test-nonassociative-operator-2:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js



# example of the use of the `%import symbols ...` statement: multi-phase engines
compiled_calc:
	$(JISON) ./$@_parse.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_parse.js
	$(JISON) ./$@_codegen.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_codegen.js
	$(JISON) ./$@_print.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_print.js
	$(JISON) ./$@_sorcerer.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_sorcerer.js
	$(JISON) ./$@_BURG.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_BURG.js
	$(JISON) ./$@_parse_for_fast_engine.jison
	# test if the generated JavaScript is viable at all:
	node output/$@/$@_parse_for_fast_engine.js
	#$(JISON) --main -t ./$@_exec.jison
	$(JISON) --main ./$@_exec.jison
	# postprocess generated source code:
	#node ./$@_const_rewrite_postprocess.js ./$@_AST_symbols.json5 output/$@/$@_exec.js 
	node ./$@_const_rewrite_postprocess.js ./output/$@/$@_parse.js ./$@_OPA_defines.json5 output/$@/$@_exec.js 
	#node ./$@_const_rewrite_postprocess.js ./output/$@/$@_parse.js output/$@/$@_exec.js 
	#node ./$@_const_rewrite_postprocess.js ./$@_OPA_defines.json5 output/$@/$@_exec.js 
	# and run it!
	node output/$@/$@_exec.js $@_input.txt


handlebars-BAD:

pascal-BAD:

issue-289-BAD:


