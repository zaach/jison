#
# You can build each example to its own directory in ./output/<example>
#

JISON = node ../dist/cli-cjs-es5.js -o ./output/$@/


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



GITHUB_ISSUE_TARGETS =                                          \
			issue-205                                           \
			issue-205-2                                         \
			issue-205-3                                         \
			issue-205-4                                         \
			issue-254                                           \
			issue-289                                           \
			issue-293                                           \
			issue-342                                           \
			issue-344-BAD                                       \
			issue-344-2-BAD                                     \
			issue-348                                           \
			issue-357-url-lexing                                \
			issue-360


CODEGEN_TARGETS =                                               \
		codegen-feature-tester-base                             \
		codegen-feature-tester-base-debug                       \
		codegen-feature-tester-base-try-catch                   \
		codegen-feature-tester-base-no-try-catch                \
		codegen-feature-tester-no-default-action                \
		codegen-feature-tester-base-error-recovery-10           \
		codegen-feature-tester-all-default-action               \
		codegen-feature-tester-yylineno                         \
		codegen-feature-tester-no-err-api-usage                 \
		codegen-feature-tester-no-error-recovery                \
		codegen-feature-tester-no-location-assignment           \
		codegen-feature-tester-no-location-info                 \
		codegen-feature-tester-no-location-tracking             \
		codegen-feature-tester-no-parseerror                    \
		codegen-feature-tester-no-value-assignment              \
		codegen-feature-tester-no-value-tracking                \
		codegen-feature-tester-no-value-work                    \
		codegen-feature-tester-no-yyclearin                     \
		codegen-feature-tester-no-yyerrok                       \
		codegen-feature-tester-no-yyerror                       \
		codegen-feature-tester-no-yyleng                        \
		codegen-feature-tester-no-yylineno                      \
		codegen-feature-tester-no-yyloc                         \
		codegen-feature-tester-no-yyrecovering                  \
		codegen-feature-tester-no-yysp                          \
		codegen-feature-tester-no-yysstack                      \
		codegen-feature-tester-no-yystack                       \
		codegen-feature-tester-no-yytext



BASIC_TARGETS =                                                 \
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
			$(CODEGEN_TARGETS)                                  \
			comments                                            \
			compiled_calc                                       \
			dism                                                \
			dism_lr0                                            \
			dot                                                 \
			error-only                                          \
			faking-multiple-start-rules                         \
			faking-multiple-start-rules-alt                     \
			flow                                                \
			formula                                             \
			grammar                                             \
			handlebars                                          \
			happyhappy                                          \
			inherited_y                                         \
			json_ast_js                                         \
			json_js                                             \
			klammergebirge                                      \
			lalr-but-not-slr                                    \
			lambdacalc                                          \
			lex                                                 \
			lr-but-not-lalr                                     \
			mfcalc                                              \
			no-prec-hack-needed                                 \
			nv_classy_ast                                       \
			olmenu-proto2                                       \
			parser-to-lexer-communication-test                  \
			parser-to-lexer-communication-test-w-debug          \
			parser-to-lexer-communication-test--profiling       \
			phraser                                             \
			precedence                                          \
			reduce_conflict                                     \
			regex                                               \
			semwhitespace                                       \
			test-EOF-bugfix                                     \
			test-epsilon-rules-early-reduce                     \
			test-literal-quote-tokens-in-grammar                \
			test-nonassociative-operator-0                      \
			test-nonassociative-operator-1                      \
			test-nonassociative-operator-2                      \
			test-propagation-rules-reduction-1                  \
			test-unused-rules-reporting                         \
			test-unused-rules-reporting-alt                     \
			theory-left-recurs-01                               \
			unicode                                             \
			unicode2                                            \
			with-includes                                       \
			with_custom_lexer



MISC_TARGETS =                                                  \
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
			handlebars                                          \
			happyhappy                                          \
			inherited_y                                         \
			$(GITHUB_ISSUE_TARGETS)                             \
			json_ast_js                                         \
			json_js                                             \
			klammergebirge                                      \
			lalr-but-not-slr                                    \
			lambdacalc                                          \
			lex                                                 \
			lr-but-not-lalr                                     \
			mfcalc                                              \
			no-prec-hack-needed                                 \
			$(CODEGEN_TARGETS)                                  \
			nv_classy_ast                                       \
			olmenu-proto2                                       \
			parser-to-lexer-communication-test                  \
			parser-to-lexer-communication-test-w-debug          \
			parser-to-lexer-communication-test--profiling       \
			phraser                                             \
			precedence                                          \
			reduce_conflict                                     \
			regex                                               \
			semwhitespace                                       \
			test-EOF-bugfix                                     \
			test-epsilon-rules-early-reduce                     \
			test-literal-quote-tokens-in-grammar                \
			test-nonassociative-operator-0                      \
			test-nonassociative-operator-1                      \
			test-nonassociative-operator-2                      \
			test-propagation-rules-reduction-1                  \
			test-unused-rules-reporting                         \
			test-unused-rules-reporting-alt                     \
			theory-left-recurs-01                               \
			unicode                                             \
			unicode2                                            \
			with-includes                                       \
			with_custom_lexer



ALL_TARGETS =                                                   \
			$(BASIC_TARGETS)                                    \
			$(GITHUB_ISSUE_TARGETS)                             \
			$(MISC_TARGETS)                                     \
			$(ERROR_HANDLING_TARGETS)                           \
			$(CODEGEN_TARGETS)                                  \
			ansic                                               \
			btyacc-ansiC                                        \
			btyacc-ansiC2                                       \
			btyacc-ftp                                          \
			btyacc-t1                                           \
			btyacc-t2                                           \
			c99                                                 \
			fsyacc-cgrammar                                     \
			gantt                                               \
			handlebars                                          \
			jscore                                              \
			lojban-300                                          \
			mermaid                                             \
			pascal                                              \
			tikiwikiparser










all: $(ALL_TARGETS)

.PHONY: all clean superclean error-handling-tests basic-tests github-issue-tests misc-tests $(ALL_TARGETS) comparison


clean:
	-rm -rf output/

superclean: clean



error-handling-tests: $(ERROR_HANDLING_TARGETS)

basic-tests: $(BASIC_TARGETS)

github-issue-tests: $(GITHUB_ISSUE_TARGETS)

misc-tests: $(MISC_TARGETS)



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
issue-205:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-205-2:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-205-3:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-205-4:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-254:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-289:
	$(JISON) --main -p lalr --no-partial-lr-upgrade-on-conflict ./$@.jison
	node ./output/$@/$@.js
	$(JISON) --main -p lalr ./$@.jison -o ./output/$@/$@-HQ.js
	node ./output/$@/$@-HQ.js
	$(JISON) --main -p lr ./$@.jison -o ./output/$@/$@-LR.js
	node ./output/$@/$@-LR.js

# build *AND* run the test:
issue-293:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-342:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

issue-344-BAD:

issue-344-2-BAD:

# build *AND* run the test:
issue-344:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-344-2:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-348:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test:
issue-357-url-lexing:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

# build *AND* run the test (JSON input!):
issue-360:
	$(JISON) --main --export-ast+ ./$@.json
	node ./output/$@/$@.js $@.test-input-1.txt

jscore:
	$(JISON) --main ./$@.jison

json_js:
	-mkdir -p ./output/$@
	#node ./json.js > ./output/$@/$@.js

json_ast_js:
	-mkdir -p ./output/$@
	#node ./json_ast.js > ./output/$@/$@.js

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
	#$(JISON) --main ./$@-parse.y ./$@-lex.l

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

profiling:                                                          \
			parser-to-lexer-communication-test                      \
			parser-to-lexer-communication-test-w-debug              \
			parser-to-lexer-communication-test--profiling           \
			parser-to-lexer-communication-test-w-debug--profiling

parser-to-lexer-communication-test--profiling:
	-rm -f isolate-*-v8.log
	$(JISON) --main -p lalr ./parser-to-lexer-communication-test.jison
	node --prof ./output/$@/parser-to-lexer-communication-test.js
	# and now collect the profile info and dump it to a report file:
	node --prof-process $$( ls -t isolate-*-v8.log | head -n 1 ) | sed -f ./profile-report-filter.sed > ./output/$@/profile.$@.txt
	# and make sure the profile report is saved in a unique file which can be compared against other profile runs later on:
	cp ./isolate-*-v8.log ./output/$@/
	cat ./output/$@/profile.$@.txt > ./output/$@/profile.$@.$$( date +%s%N ).txt
	cat ./output/$@/profile.$@.txt > ../profile.$@.$$( date +%s%N ).txt

parser-to-lexer-communication-test-w-debug--profiling:
	-rm -f isolate-*-v8.log
	$(JISON) --main -p lalr ./parser-to-lexer-communication-test-w-debug.jison
	node --prof ./output/$@/parser-to-lexer-communication-test-w-debug.js
	# and now collect the profile info and dump it to a report file:
	node --prof-process $$( ls -t isolate-*-v8.log | head -n 1 ) | sed -f ./profile-report-filter.sed > ./output/$@/profile.$@.txt
	# and make sure the profile report is saved in a unique file which can be compared against other profile runs later on:
	cp ./isolate-*-v8.log ./output/$@/
	cat ./output/$@/profile.$@.txt > ./output/$@/profile.$@.$$( date +%s%N ).txt
	cat ./output/$@/profile.$@.txt > ../profile.$@.$$( date +%s%N ).txt

parser-to-lexer-communication-test:
	$(JISON) --main -p lalr ./$@.jison
	node ./output/$@/$@.js

parser-to-lexer-communication-test-w-debug:
	$(JISON) --main -p lalr ./$@.jison
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
test-EOF-bugfix:
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

# build *AND* run the test:
test-propagation-rules-reduction-1:
	$(JISON) --main -c 0 -I ./$@.jison
	$(JISON) --main -c 0 -I ./test-propagation-rules-reduction-2.jison
	node ./output/$@/$@.js
	node ./output/$@/test-propagation-rules-reduction-2.js

test-unused-rules-reporting:
	$(JISON) --main ./$@.jison
	node ./output/$@/$@.js

test-unused-rules-reporting-alt:
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





CGT=codegen-feature-tester

comparison:                                                                 \
		clean                                                               \
		$(ALL_TARGETS)                                                      \
		$(CODEGEN_TARGETS)                                                  \
		reference-output/README.md
	# only run a DIFF once we have generated all outputs:
	# that way we get to see all diffs at once and probably have a
	# faster turn-around cycle when we go and fix any diffs observed
	# here.
	#-diff -C 1 -r -t --tabsize=4 -a -I ' generated by ' -B -E -Z -w ./reference-output/ ./output/    > ./comparison.diff-report.patch
	diff -q -r -t --tabsize=4 -a -I ' generated by ' -B -E -Z -w -X comparison-diff-filter-extensions.txt ./reference-output/ ./output/


codegen-feature-tester-base:
	$(JISON) --main ./$(CGT)-base.jison -o ./output/$(CGT)/$(CGT)-base.js
	node ./output/$(CGT)/$(CGT)-base.js

codegen-feature-tester-base-debug:
	$(JISON) --main ./$(CGT)-base.jison -o ./output/$(CGT)/$(CGT)-base-debug.js --debug
	node ./output/$(CGT)/$(CGT)-base-debug.js

codegen-feature-tester-base-try-catch:
	$(JISON) --main ./$(CGT)-base.jison -o ./output/$(CGT)/$(CGT)-base-try-catch.js --try-catch
	node ./output/$(CGT)/$(CGT)-base-try-catch.js

codegen-feature-tester-base-no-try-catch:
	$(JISON) --main ./$(CGT)-base.jison -o ./output/$(CGT)/$(CGT)-base-no-try-catch.js --no-try-catch
	node ./output/$(CGT)/$(CGT)-base-no-try-catch.js

codegen-feature-tester-base-error-recovery-10:
	$(JISON) --main ./$(CGT)-base.jison -o ./output/$(CGT)/$(CGT)-base-error-recovery-10.js -Q=10
	node ./output/$(CGT)/$(CGT)-base-error-recovery-10.js

codegen-feature-tester-no-default-action:
	$(JISON) --main ./$(CGT)-no-default-action.jison -o ./output/$(CGT)/$(CGT)-no-default-action.js --default-action=none,none
	node ./output/$(CGT)/$(CGT)-no-default-action.js

codegen-feature-tester-all-default-action:
	$(JISON) --main ./$(CGT)-all-default-action.jison -o ./output/$(CGT)/$(CGT)-all-default-action.js
	node ./output/$(CGT)/$(CGT)-all-default-action.js

codegen-feature-tester-no-yyleng:
	$(JISON) --main ./$(CGT)-no-yyleng.jison -o ./output/$(CGT)/$(CGT)-no-yyleng.js
	node ./output/$(CGT)/$(CGT)-no-yyleng.js

codegen-feature-tester-no-yylineno:
	$(JISON) --main ./$(CGT)-no-yylineno.jison -o ./output/$(CGT)/$(CGT)-no-yylineno.js
	node ./output/$(CGT)/$(CGT)-no-yylineno.js

codegen-feature-tester-yylineno:
	$(JISON) --main ./$(CGT)-yylineno.jison -o ./output/$(CGT)/$(CGT)-yylineno.js
	node ./output/$(CGT)/$(CGT)-yylineno.js

codegen-feature-tester-no-yytext:
	$(JISON) --main ./$(CGT)-no-yytext.jison -o ./output/$(CGT)/$(CGT)-no-yytext.js
	node ./output/$(CGT)/$(CGT)-no-yytext.js

codegen-feature-tester-no-yyloc:
	$(JISON) --main ./$(CGT)-no-yyloc.jison -o ./output/$(CGT)/$(CGT)-no-yyloc.js
	node ./output/$(CGT)/$(CGT)-no-yyloc.js

codegen-feature-tester-no-parseerror:
	$(JISON) --main ./$(CGT)-no-parseerror.jison -o ./output/$(CGT)/$(CGT)-no-parseerror.js
	node ./output/$(CGT)/$(CGT)-no-parseerror.js

codegen-feature-tester-no-yyerror:
	$(JISON) --main ./$(CGT)-no-yyerror.jison -o ./output/$(CGT)/$(CGT)-no-yyerror.js
	node ./output/$(CGT)/$(CGT)-no-yyerror.js

codegen-feature-tester-no-yyrecovering:
	$(JISON) --main ./$(CGT)-no-yyrecovering.jison -o ./output/$(CGT)/$(CGT)-no-yyrecovering.js
	node ./output/$(CGT)/$(CGT)-no-yyrecovering.js

codegen-feature-tester-no-yyerrok:
	$(JISON) --main ./$(CGT)-no-yyerrok.jison -o ./output/$(CGT)/$(CGT)-no-yyerrok.js
	node ./output/$(CGT)/$(CGT)-no-yyerrok.js

codegen-feature-tester-no-yyclearin:
	$(JISON) --main ./$(CGT)-no-yyclearin.jison -o ./output/$(CGT)/$(CGT)-no-yyclearin.js
	node ./output/$(CGT)/$(CGT)-no-yyclearin.js

codegen-feature-tester-no-value-tracking:
	$(JISON) --main ./$(CGT)-no-value-tracking.jison -o ./output/$(CGT)/$(CGT)-no-value-tracking.js
	node ./output/$(CGT)/$(CGT)-no-value-tracking.js

codegen-feature-tester-no-value-assignment:
	$(JISON) --main ./$(CGT)-no-value-assignment.jison -o ./output/$(CGT)/$(CGT)-no-value-assignment.js
	node ./output/$(CGT)/$(CGT)-no-value-assignment.js

codegen-feature-tester-no-location-tracking:
	$(JISON) --main ./$(CGT)-no-location-tracking.jison -o ./output/$(CGT)/$(CGT)-no-location-tracking.js
	node ./output/$(CGT)/$(CGT)-no-location-tracking.js

codegen-feature-tester-no-location-assignment:
	$(JISON) --main ./$(CGT)-no-location-assignment.jison -o ./output/$(CGT)/$(CGT)-no-location-assignment.js
	node ./output/$(CGT)/$(CGT)-no-location-assignment.js

codegen-feature-tester-no-yystack:
	$(JISON) --main ./$(CGT)-no-yystack.jison -o ./output/$(CGT)/$(CGT)-no-yystack.js
	node ./output/$(CGT)/$(CGT)-no-yystack.js

codegen-feature-tester-no-yysstack:
	$(JISON) --main ./$(CGT)-no-yysstack.jison -o ./output/$(CGT)/$(CGT)-no-yysstack.js
	node ./output/$(CGT)/$(CGT)-no-yysstack.js

codegen-feature-tester-no-yysp:
	$(JISON) --main ./$(CGT)-no-yysp.jison -o ./output/$(CGT)/$(CGT)-no-yysp.js
	node ./output/$(CGT)/$(CGT)-no-yysp.js

codegen-feature-tester-no-error-recovery:
	$(JISON) --main ./$(CGT)-no-error-recovery.jison -o ./output/$(CGT)/$(CGT)-no-error-recovery.js
	node ./output/$(CGT)/$(CGT)-no-error-recovery.js

# (!info.actionsUseYYLOC && !info.actionsUseLocationTracking && !info.actionsUseLocationAssignment)
codegen-feature-tester-no-location-info:
	$(JISON) --main ./$(CGT)-no-location-info.jison -o ./output/$(CGT)/$(CGT)-no-location-info.js
	node ./output/$(CGT)/$(CGT)-no-location-info.js

# (!info.actionsUseValueTracking && !info.actionsUseValueAssignment) {
codegen-feature-tester-no-value-work:
	$(JISON) --main ./$(CGT)-no-value-work.jison -o ./output/$(CGT)/$(CGT)-no-value-work.js
	node ./output/$(CGT)/$(CGT)-no-value-work.js

# (!info.actionsUseYYERROK && !info.actionsUseYYRECOVERING && !info.actionsUseYYCLEARIN && !info.actionsUseYYERROR) {
codegen-feature-tester-no-err-api-usage:
	$(JISON) --main ./$(CGT)-no-err-api-usage.jison -o ./output/$(CGT)/$(CGT)-no-err-api-usage.js
	node ./output/$(CGT)/$(CGT)-no-err-api-usage.js












