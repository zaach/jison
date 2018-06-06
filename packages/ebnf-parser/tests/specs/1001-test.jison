//
// title: test idempotent transform 
//
// ...
//
// 
// function testParse(top, strings) {
//     return function() {
//         var expected = {
//             "options": {
//                 "ebnf": true
//             },
//             "ebnf": {"top": [top]},
//             "bnf": ebnf.transform({"top": [top]})
//         };
//         var grammar = "%ebnf\n%%\ntop : " + top + ";";
//         assert.deepEqual(bnf.parse(grammar), expected);
//     };
// }
// 
// 
// var tests = {
//     "*test idempotent transform*": function() {
//         var first = {
//             "nodelist": [["", "$$ = [];"], ["nodelist node", "$1.push($2);"]]
//         };
//         var second = ebnf.transform(JSON.parse(JSON.stringify(first)));
//         assert.deepEqual(second, first);
//     },

%ebnf
%%
nodelist 
:    /**/          {$$ = [];}
|    nodelist node {$1.push($2);}
;

