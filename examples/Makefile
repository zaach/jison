#
# You can build each example to its own directory in ./output/<example>
#

JISON = node ../lib/cli.js -o ./output/$@/ --main

ALL_TARGETS =                                                   \
			ansic                                               \
			compiled_calc                                       \
			c99                                                 \
			basic                                               \
			basic2                                              \
			basic2_lex                                          \
			basic_lex                                           \
			bloop                                               \
			calc_LA_on_demand                                   \
			calculator                                          \
			ccalc 	                                            \
			calculator_json                                     \
			classy                                              \
			classy_ast                                          \
			comments                                            \
			dism                                                \
			dism_lr0                                            \
			dot                                                 \
			faking-multiple-start-rules 						\
			error-handling-and-yyclearin						\
			error-handling-and-yyerrok-loopfix					\
			error-handling-and-yyerrok-looping1					\
			error-handling-and-yyerrok-looping2					\
			error-handling-and-yyerrok-macro					\
			error-handling-and-yyerrok-part1					\
			error-handling-and-yyerrok-part2					\
			error-handling-and-yyerrok-part3					\
			error-handling-and-yyerrok-part4a					\
			error-handling-and-yyerrok-part4b					\
			error-handling-and-yyerrok-part5					\
			error-recognition-actions							\
			error-recovery-and-yyerror							\
			flow                                                \
			formula                                             \
			fsyacc-cgrammar										\
			gantt                                               \
			grammar                                             \
			handlebars                                          \
			happyhappy											\
			inherited_y                                         \
			issue-254                                           \
			issue-293                                           \
			jscore                                              \
			json_ast_js                                         \
			json_js                                             \
			lambdacalc                                          \
			lex                                                 \
			lojban-300											\
			mermaid                                             \
			mfcalc 												\
			nv_classy_ast                                       \
			olmenu-proto2 										\
			phraser                                             \
			precedence                                          \
			reduce_conflict                                     \
			regex                                               \
			semwhitespace                                       \
			tikiwikiparser                                      \
			unicode                                             \
			unicode2 											\
			with-includes                                       \
			with_custom_lexer 									\
			yacc-error-recovery




ERROR_HANDLING_TARGETS =                                        \
			error-handling-and-yyclearin						\
			error-handling-and-yyerrok-loopfix					\
			error-handling-and-yyerrok-looping1					\
			error-handling-and-yyerrok-looping2					\
			error-handling-and-yyerrok-macro					\
			error-handling-and-yyerrok-part1					\
			error-handling-and-yyerrok-part2					\
			error-handling-and-yyerrok-part3					\
			error-handling-and-yyerrok-part4a					\
			error-handling-and-yyerrok-part4b					\
			error-handling-and-yyerrok-part5					\
			error-recognition-actions							\
			error-recovery-and-yyerror							\
			yacc-error-recovery







all: $(ALL_TARGETS)

.PHONY: all clean superclean error-handling $(ALL_TARGETS)

clean:
	-rm -rf output/

superclean: clean


error-handling: $(ERROR_HANDLING_TARGETS)

misc: $(MISC_TARGETS)

ansic:
	$(JISON) ./$@.jison

basic:
	$(JISON) ./$@.jison

basic2:
	$(JISON) ./$@.jison

basic2_lex:
	$(JISON) ./$@.jison

basic_lex:
	$(JISON) ./$@.jison

bloop:
	$(JISON) ./$@.y ./floop.l

# cannot compile a lexer on its own, so we provide a bogus grammar to go with that.
floop:
	$(JISON) floop-standalone.y ./$@.l

calculator:
	$(JISON) ./$@.jison

calc_LA_on_demand:
	$(JISON) ./$@.jison

calculator_json:
	$(JISON) ./calculator.json

classy:
	$(JISON) ./$@.jison ./classy.jisonlex

# test input file: classy_test.src
classy_ast:
	$(JISON) ./$@.jison

comments:
	$(JISON) ./$@.jison

dism:
	$(JISON) ./$@.jison

dism_lr0:
	$(JISON) ./$@.jison

# ./documentation--custom-lexer-NIL.js
# ./documentation--custom-lexer-ULcase.js
# ./documentation--mygenerator.js

formula:
	$(JISON) ./$@.jison

handlebars:
#	$(JISON) ./handlebars.jison.y ./handlebars.jison.l

inherited_y:
	$(JISON) ./inherited.y

# build *AND* run the test:
issue-254:
	$(JISON) ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-293:
	$(JISON) ./$@.jison
	node ./output/$@/$@.js

jscore:
	$(JISON) ./$@.jison

json_js:
	-mkdir -p ./output/$@
	node ./json.js > ./output/$@/$@.js

json_ast_js:
	-mkdir -p ./output/$@
	node ./json_ast.js > ./output/$@/$@.js

lambdacalc:
	$(JISON) ./$@.jison

nv_classy_ast:
	$(JISON) ./$@.jison

phraser:
	$(JISON) ./$@.jison

precedence:
	$(JISON) ./$@.jison

reduce_conflict:
	$(JISON) ./$@.jison

regex:
	$(JISON) ./$@.jison

# input tst file:  ./semwhitespace_ex.src
semwhitespace:
	$(JISON) ./$@.jison semwhitespace_lex.jison

tikiwikiparser:
	$(JISON) ./$@.jison

mermaid:
	$(JISON) ./$@.jison

dot:
	$(JISON) ./$@.jison

error-handling-and-yyclearin:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-loopfix:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-looping1:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-looping2:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-macro:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part1:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part2:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part3:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part4a:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part4b:
	$(JISON) ./$@.jison

error-handling-and-yyerrok-part5:
	$(JISON) ./$@.jison

error-recognition-actions:
	$(JISON) ./$@.jison

error-recovery-and-yyerror:
	$(JISON) ./$@.jison

flow:
	$(JISON) ./$@.jison

fsyacc-cgrammar:
	$(JISON) ./$@.jison

gantt:
	$(JISON) ./$@.jison

happyhappy:
	$(JISON) ./$@.jison

unicode:
	$(JISON) ./$@.jison

lojban-300:
	$(JISON) ./$@.jison

mfcalc:
	$(JISON) ./$@.jison

olmenu-proto2:
	$(JISON) ./$@.jison

unicode2:
	$(JISON) ./$@.jison

yacc-error-recovery:
	$(JISON) ./$@.jison

with-includes:
	$(JISON) ./$@.jison

with_custom_lexer:
	$(JISON) ./$@.jison

grammar:
	$(JISON) ./$@.jison

lex:
	$(JISON) ./$@.jison lex_grammar.jisonlex

ccalc:
	$(JISON) ./$@-parse.y ./$@-lex.l

c99:
	$(JISON) ./$@.y ./$@.l

faking-multiple-start-rules:
	$(JISON) ./$@.jison

# example of the use of the `%import symbols ...` statement: multi-phase engines
compiled_calc:
	$(JISON) -t ./$@_parse.jison
	$(JISON) -t ./$@_exec.jison

