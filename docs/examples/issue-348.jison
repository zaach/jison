/* description: Declarative Kite MCMS Interface Parser */

// Original grammar as posted in the github issue can be found here:
//
//     ./issue-348-grammar.txt
//
// compare with this JISON file to see what had to be done to turn this
// into a (more or less) viable jison grammar.
//
// As stated in the issue: I *DID* *NOT* take this further than merely
// making the grammar compile and work. Caveat emptor.

/* Some variables */
%{
  // no local variables needed in the parser action code chunks now!
  //
  // check out how you're supposed to transfer data up the parser
  // rule chain: `$$`, etc.
  //
  // Also note the copious use of *named references*, e.g. `$STRING`
  // instead of `$4`: this makes the grammar way more maintainable!
%}


/* lexical grammar */
%lex

%%

\s+                   /* skip whitespace */

// GerHobbelt.jison doesn't need quotes around literal regex parts, hence `mc|ms` vs. `"mc"|"ms"`
mc|ms                 return 'TYPE';          
define                return 'DEFINE';
as                    return 'AS';
with                  return 'WITH';
name                  return 'NAME';
is                    return 'IS';
orientation           return 'ORIENTATION';
horizontal            return 'HORIZONTAL';
vertical              return 'VERTICAL';
maximum               return 'MAXIMUM';
max                   return 'MAX';
selection             return 'SELECTION';
select                return 'SELECT';
and                   return 'AND';
correct               return 'CORRECT';
minimum               return 'MINIMUM';
min                   return 'MIN';
stem                  return 'STEM';
text                  return 'TEXT';
option                return 'OPTION';
score                 return 'SCORE';
for                   return 'FOR';
end                   return 'END';
all                   return 'ALL';
at                    return 'AT';
least                 return 'LEAST';
exactly               return 'EXACTLY';
any                   return 'ANY';
points                return 'POINTS';
point                 return 'POINT';
// ^-- TBD: 
// #1: are these Reserved Words?  Or do they clash with STRING at some point in the future?
// #2: a single regex and a hash-table lookup in the action code would make for a much faster lexer.

// quoted string:
\"([^\"\r\n]*)\"      yytext = this.matches[1]; return 'STRING';

[0-9]+                return 'NUMBER';
[a-zA-Z0-9.-]+        return 'STRING';

","                   return ',';
"="                   return '=';

/lex


/* declare tokens */
%token NUMBER
%token STRING
%token TYPE

%ebnf       // this is an EBNF grammar, thanks to using the braces in the grammar spec.


%% /* language grammar */


mcms
  : DEFINE TYPE withRule AS stem options scores done {setType($TYPE);}
  ;
  
withRule
  : %empty | WITH attributeList
  ;
  
attributeList
  : %empty | (attribute moreAttributes)
  ;
  
moreAttributes
  : %empty | ("," attribute)
  ;

attribute
  : nameAttr | orientAttr | minSelectAttr | maxSelectAttr
  ;

nameAttr
  : NAME equals STRING {addAttribute("name", $STRING);}
  ;

orientAttr
  : ORIENTATION equals (HORIZONTAL | VERTICAL)[o] {addAttribute("orientation", $o);}
  ;

equals
  : "=" | IS
  ;
  
maxSelectAttr
  : (MAX | MAXIMUM) selectSpec {addAttribute("maxSelect", $selectSpec);}
  ;
  
selectSpec
  : (SELECT | SELECTION) equals NUMBER {$$ = $NUMBER;}
  ;
  
minSelectAttr
  : (MIN | MINIMUM) selectSpec {addAttribute("minSelect", $selectSpec);}
  ;

stem
  : %empty 
  | STEM TEXT equals STRING {setStem($STRING);}
  ;

options
  : anOption moreOptions
  ;

anOption
  : OPTION TEXT equals STRING correctSpec {addOption($STRING, $correctSpec);}
  ;

moreOptions
  : %empty | options
  ;

correctSpec
  : %empty           {$$ = false;}
  | (AND IS CORRECT) {$$ = true;}
  ;
  
scores
  : aScore moreScores
  ;
  
aScore
  : SCORE pointSpec FOR quantity {addScore($pointSpec, $quantity.scoreCriteria, $quantity.numCorrect);}
  ;
  
pointSpec
  : NUMBER (POINT | POINTS) {$$ = $1;}
  ;
  
quantity
  : (ALL | ((AT LEAST) | EXACTLY | ANY) NUMBER)[cr] CORRECT {$$ = {scoreCriteria: $cr, numCorrect: $CORRECT};}
  ;
  
moreScores
  : %empty | scores
  ;
  
done
  : END TYPE {printDeclaration();}
  ;

%%

var declaration = {
  interactionType: null,
  attributes: [],
  stemText: null,
  options: [],
  scores: []
};

function setType(theType) {
  declaration.interactionType = (theType == "mc" ? "Multiple Choice" : "Multiple Select");
}

function addAttribute(theName, theValue) {
  console.warn('addAttribute: ', {
    name: theName, 
    value: theValue
  });
  declaration.attributes.push({name: theName, value: theValue});
}

function setStem(text) {
  declaration.stemText = text;
}

function addOption(optionText, correctFlag) {
  declaration.options.push({text: optionText, isCorrect: correctFlag});
}

function addScore(pointSpec, scoreCriteria, numCorrect) {
  declaration.scores.push({points: pointSpec, criteria: scoreCriteria, correctNum: numCorrect});
}

function printDeclaration() {
  console.warn('dump: ', declaration);
  println(declaration.interactionType + " interaction:");
  println("Has attributes:");
  for (var anAttr in declaration.attributes) {
    anAttr = declaration.attributes[anAttr];
    println("\t" + anAttr.name + " = " + anAttr.value);
  }
  println("\nHas Options:");
  for (var anOpt in declaration.options) {
    anOpt = declaration.options[anOpt];
    println("\t" + anOpt.text + " = " + "isCorrect = " + anOpt.isCorrect);
  }
  println("\nHas Scores:");
  for (var aScore in declaration.scores) {
    aScore = declaration.scores[aScore];
    println("\t" + aScore.points + " for " + aScore.criteria + (aScore.numCorrect > 0 ? aScore.numCorrect : ""));
  }
  println("end " + declaration.interactionType + "interaction");
}


function println(str) {
  console.log(str);
}


// feature of the GH fork: specify your own main.
//
// compile with
// 
//      jison -o test.js --main that/will/be/me.jison
//
// then run
//
//      node ./test.js
//
// to see the output.

var assert = require("assert");

parser.main = function () {
    var input = `
define mc with orientation=horizontal as
  stem text is "this is a test"
  option text = "option 1" and is correct
  option text = "option 2"
  option text = "option 3"
  score 1 point for all correct
end mc
`;

    var rv = parser.parse(input);
    console.log("test #1: ==> ", rv);
    assert.equal(rv, "define", "test returns TRUE because the start rule has an action block, so no default action inserted and $$ has been set to $1 === 'DEFINE' then");

    // if you get past the assert(), you're good.
    console.log("tested OK");
};

