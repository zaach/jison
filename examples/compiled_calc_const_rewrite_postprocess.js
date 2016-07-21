

// Little script which takes our defined constants and replaces them 
// everywhere they appear in the given source file: using direct numbers is
// faster than referencing global constants on all platforms.
// (Or rather: this code makes us platform independent... now we don't need
// a very smart JS JIT compiler any more for doing this as we now perform 
// this task manually...)

var recast = require('recast');
var fs = require('fs');
var path = require('path');
var json5 = require('json5');
var assert = require("assert");

var types = recast.types;
var n = types.namedTypes;
var b = types.builders;

var devDebug = false;

function addCommentHelper(node, comment) {
    var comments = node.comments || (node.comments = []);
    comments.push(comment);
}

function addLeadingComment(node, comment) {
    comment.leading = true;
    comment.trailing = false;
    addCommentHelper(node, comment);
}

function addDanglingComment(node, comment) {
    comment.leading = false;
    comment.trailing = false;
    addCommentHelper(node, comment);
}

function addTrailingComment(node, comment) {
    comment.leading = false;
    comment.trailing = true;
    addCommentHelper(node, comment);
}

function addComment(type, value, start, end, loc) {
    var comment;

    // assert(typeof start === 'number', 'Comment must have valid position');

    // state.lastCommentStart = start;

    comment = {
        type: type,
        value: value,
        loc: { 
          start: { 
            line: 1, 
            column: 32 
          },
          end: { 
            line: 1, 
            column: 234 
          },
          //lines: Lines {},
          indent: 32 
        },
    };
    // if (extra.range) {
    //     comment.range = [start, end];
    // }
    // if (extra.loc) {
    //     comment.loc = loc;
    // }
    // extra.comments.push(comment);
    // if (extra.attachComment) {
    //     extra.leadingComments.push(comment);
    //     extra.trailingComments.push(comment);
    // }
    // if (extra.tokenize) {
    //     comment.type = comment.type + 'Comment';
    //     if (extra.delegate) {
    //         comment = extra.delegate(comment);
    //     }
    //     extra.tokens.push(comment);
    // }
    // 
    return comment;
}



function main(args) {
  if (args.length < 2) {
      console.log('Usage: ' + args[0] + ' CONSTANTS_JSON5_FILE [CONSTANTS_JSON5_FILE ...] JS_SRC_FILE');
      process.exit(1);
  }


  var constants = {};
  for (var i = 1, len = args.length - 1; i < len; i++) {
    constants = loadConstants(path.normalize(args[i]), constants);
  }
  if (!constants['EOF']) {
    constants['EOF'] = 1;
  }
  // if (!constants['ERROR']) {
  //   constants['ERROR'] = 2;
  // }


  var source = fs.readFileSync(path.normalize(args[args.length - 1]), 'utf8');
  source = rewrite(source, constants);
  fs.writeFileSync(path.normalize(args[args.length - 1]), source, 'utf8');
}

main(process.argv.slice(1));



function loadConstants(filepath, previously_defined_constants) {
  var predefined_symbols;

  var source = fs.readFileSync(filepath, 'utf8');
  // It's either a JSON file or a JISON generated output file:
  //
  //     symbols_: {
  //       "symbol": ID, ...
  //     },
  try {
    predefined_symbols = json5.parse(source);
  } catch (ex) {
      if (devDebug) {
          console.error('%import symbols JSON fail: ', ex);
      }
      try {
          var m = /[\r\n]\s*symbols_:\s*(\{[\s\S]*?\}),\s*[\r\n]/.exec(source);
          if (m && m[1]) {
              source = m[1];
              predefined_symbols = json5.parse(source);
          }
      } catch (ex) {
          if (devDebug) {
              console.error('%import symbols JISON output fail: ', ex);
          }
          throw new Error('Error: `%import symbols <path>` must point to either a JSON file containing a symbol table (hash table) or a previously generated JISON JavaScript file, which contains such a symbol table. Error message: ' + ex.message);
      }
  }
  
  if (!predefined_symbols || typeof predefined_symbols !== 'object') {
      throw new Error('Error: `%import symbols <path>` must point to either a JSON file containing a symbol table (hash table) or a previously generated JISON JavaScript file, which contains such a symbol table.');
  }

  // Make sure all predefined symbols are unique and *numeric* and do not include predefined tokens JISON already defines to a fixed ID on its own:
  delete predefined_symbols['$accept'];
  delete predefined_symbols['$end'];
  delete predefined_symbols['error'];
  delete predefined_symbols['$eof'];
  delete predefined_symbols['EOF'];

  // also nuke all 'constants' which are **not** **all-caps**: those can only screw us up!
  Object.keys(predefined_symbols).forEach(function cvt_symbol_id_to_numeric(sym) {
    if (!/^[A-Z_][A-Z_0-9]+$/.test(sym)) {
      delete predefined_symbols[sym];
    }
  });  

  var symdef_uniq_check = {};
  // // Only these symbols are allowed to have the values 1 or 2:
  // symdef_uniq_check[1] = 'EOF';
  // symdef_uniq_check[2] = 'error';
  Object.keys(predefined_symbols).forEach(function cvt_symbol_id_to_numeric(sym) {
    var v = predefined_symbols[sym];
    
    // Symbol value may be defined as boolean TRUE, in which case we let JISON pick the value for us:
    if (v === true) return;

    // Symbol value may be defined as a one-character string:
    if (typeof v !== 'number') {
        if (typeof v !== 'string' || v.length !== 1) {
            throw new Error('Error: `%import symbols <path>`: symbol table contains invalid entry at key \'' + sym + '\': a non-numeric symbol ID value must be a single-character string.');
        }
        v = v.charCodeAt(0);
    }
    v = v | 0;
    if (!v || v < 0) {
        throw new Error('Error: `%import symbols <path>`: symbol table contains invalid entry at key \'' + sym + '\': a symbol ID value must be an integer value, 3 or greater.');
    }
    if (symdef_uniq_check[v]) {
        if (symdef_uniq_check[v] !== sym) {
            throw new Error('Error: `%import symbols <path>`: symbol table contains duplicate ID values for keys \'' + sym + '\' and \'' + symdef_uniq_check[v] + '\'');
        }
    }
    symdef_uniq_check[v] = sym;
    predefined_symbols[sym] = v;
  });

  // if (!predefined_symbols['EOF']) {
  //   predefined_symbols['EOF'] = 1;
  // }
  // if (!predefined_symbols['ERROR']) {
  //   predefined_symbols['ERROR'] = 2;
  // }

  // and add the previously defined constants: when there's any collisions, report these and fail!
  for (var key in previously_defined_constants) {
    if (previously_defined_constants.hasOwnProperty(key)) {
      if (key in predefined_symbols) {
        throw new Error('Constant "' + key + '" is defined in at least two input files! This is illegal; code rewrite operation ABORTED!');
      }
      predefined_symbols[key] = previously_defined_constants[key];
    }
  }

  // console.log('end of const load for file: ', predefined_symbols);
  return predefined_symbols;
}




function rewriteDefinedConstant(node, defs) {
  var newnode = b.literal(defs[node.name]);
  // console.log("node comments: ", {
  //   node_name: node.name,
  //   definition: defs[node.name],
  //   comments: node.comments
  // });
  
  var comment_added = false;

  if (node.comments) {
    node.comments.forEach(function (comment) {
      if (!comment_added) {
        comment_added = true;
        comment.value = ' [' + node.name.replace(/\*\//g, '*\\/') + ']: ' + comment.value.replace(/^ /, '');
        // console.log('extra indent: ', node.name.length - ('' + defs[node.name]).length);
        // comment.indent += Math.max(0, node.name.length - ('' + defs[node.name]).length);
      }
      // console.log("comment: ", comment);
      addTrailingComment(newnode, comment);
    });
  }

  if (!comment_added) {
    var cmt = addComment('Block', ' ' + node.name + ' ' /*, start, end, loc */ );
    addTrailingComment(newnode, cmt);
  }

  return newnode;
}


function rewrite(src, defs) {
  // Parse the code using an interface similar to require("esprima").parse.
  var output = src;
  var ast = recast.parse(src);





  recast.visit(ast, {
      /**
       * Traverse and potentially modify an abstract syntax tree using a
       * convenient visitor syntax:
       *
       *   recast.visit(ast, {
       *     names: [],
       *     visitIdentifier: function(path) {
       *       var node = path.value;
       *       this.visitor.names.push(node.name);
       *       this.traverse(path);
       *     }
       *   });
       */
      names: {},

      visitIdentifier: function(path) {
        var node = path.value;

        // this.visitor.names[node.name] = node;

        var known_skip = false;
        for (;;) {
          if (defs.hasOwnProperty(node.name)) {
            if (typeof defs[node.name] === 'number') {
              // this.NAME = bla;
              // x = { NAME: bluh };
              if (n.MemberExpression.check(path.parent.value)) {
                known_skip = true;
                break;
              }

              // var NAME = duh;
              if (n.VariableDeclarator.check(path.parent.value)) {
                known_skip = true;
                break;
              }

              // bla: [CONST1, CONST2, ...]
              if (n.ArrayExpression.check(path.parent.value)) {
                return rewriteDefinedConstant(node, defs);
              }

              if (n.Property.check(path.parent.value)) {
                // now see if this is LHS or RHS of an ObjectExpression:
                if (n.ObjectExpression.check(path.parent.parent.value)) {
                  if (path.parent.value.kind === 'init' && path.parent.value.key.name !== node.name) {
                    // id: CONST, ...
                    return rewriteDefinedConstant(node, defs);
                  }
                  // else: CONST: blah,                 -- do NOT replace!
                  known_skip = true;
                  break;
                }
                break;
              }

              // case CONST1:
              if (n.SwitchCase.check(path.parent.value)) {
                return rewriteDefinedConstant(node, defs);
              }
              // if(... === CONST1) ...
              if (n.LogicalExpression.check(path.parent.value)) {
                return rewriteDefinedConstant(node, defs);
              }
              // x = CONST1 + ...
              if (n.BinaryExpression.check(path.parent.value)) {
                return rewriteDefinedConstant(node, defs);
              }

              if (!known_skip) {
                console.log('Identifier: ', {
                  node_name: node.name,
                  //node_type: node.type,
                  definition: defs[node.name],
                  //parent: path.parent
                  parent_chain: path.parent.value.type + ' | ' + path.parent.parent.value.type,
                  parent_type: path.parent.value.type,
                });
              }

              return rewriteDefinedConstant(node, defs);
            }
          }
          break;
        }

        if (defs.hasOwnProperty(node.name)) {
          if (typeof defs[node.name] === 'number') {
            if (!known_skip) {
              console.log('UNIDENTIFIED: ', {
                node_name: node.name,
                node_type: node.type,
                definition: defs[node.name],
                //parent: path.parent
                parent_chain: path.parent.value.type + ' | ' + path.parent.parent.value.type,
                parent_type: path.parent.value.type,
              });
            }
          }
        }

        this.traverse(path);
      }
  });



  // // This script converts for and do-while loops into equivalent while loops.
  // // Note that for-in statements are left unmodified, as they do not have a
  // // simple analogy to while loops. Also note that labeled continue statements
  // // are not correctly handled at this point, and will trigger an assertion
  // // failure if encountered.

  // recast.visit(ast, {
  //     visitForStatement: function(path) {
  //         var fst = path.node;

  //         // path.replace(
  //         //     fst.init,
  //         //     b.whileStatement(
  //         //         fst.test,
  //         //         insertBeforeLoopback(fst, fst.update)
  //         //     )
  //         // );

  //         this.traverse(path);
  //     },

  //     visitDoWhileStatement: function(path) {
  //         var dwst = path.node;
  //         return b.whileStatement(
  //             b.literal(true),
  //             insertBeforeLoopback(
  //                 dwst,
  //                 b.ifStatement(
  //                     dwst.test,
  //                     b.breakStatement()
  //                 )
  //             )
  //         );
  //     }
  // });


  // function insertBeforeLoopback(loop, toInsert) {
  //     var body = loop.body;

  //     if (!n.Statement.check(toInsert)) {
  //         toInsert = b.expressionStatement(toInsert);
  //     }

  //     if (n.BlockStatement.check(body)) {
  //         body.body.push(toInsert);
  //     } else {
  //         body = b.blockStatement([body, toInsert]);
  //         loop.body = body;
  //     }

  //     recast.visit(body, {
  //         visitContinueStatement: function(path) {
  //             var cst = path.node;

  //             assert.equal(
  //                 cst.label, null,
  //                 "Labeled continue statements are not yet supported."
  //             );

  //             path.replace(toInsert, path.node);
  //             return false;
  //         },

  //         // Do not descend into nested loops.
  //         visitWhileStatement: function() {
  //           return false;
  //         },
  //         visitForStatement: function() {
  //           return false;
  //         },
  //         visitForInStatement: function() {
  //           return false;
  //         },
  //         visitDoWhileStatement: function() {
  //           return false;
  //         }
  //     });

  //     return body;
  // }








  // This script should reprint the contents of the given file without
  // reusing the original source, but with identical AST structure.

  // recast.visit(ast, {
  //     visitNode: function(path) {
  //         this.traverse(path);
  //         path.node.original = null;
  //     }
  // });






if (0) {
  recast.visit(ast, {
      visitIfStatement: function(path) {
          var stmt = path.node;
          stmt.consequent = fix(stmt.consequent);

          var alt = stmt.alternate;
          if (!n.IfStatement.check(alt)) {
              stmt.alternate = fix(alt);
          }

          this.traverse(path);
      },

      visitWhileStatement: visitLoop,
      visitDoWhileStatement: visitLoop,
      visitForStatement: visitLoop,
      visitForInStatement: visitLoop
  });
}

  function visitLoop(path) {
      var loop = path.node;
      loop.body = fix(loop.body);
      this.traverse(path);
  }

  function fix(clause) {
      if (clause) {
          if (!n.BlockStatement.check(clause)) {
              clause = b.blockStatement([clause]);
          }
      }

      return clause;
  }







  output = recast.print(ast).code;

  // // Whenever Recast cannot reprint a modified node using the original source code, 
  // // it falls back to using a generic pretty printer. 
  // // So the worst that can happen is that your changes trigger some harmless 
  // // reformatting of your code.
  // //
  // // If you really don't care about preserving the original formatting, 
  // // you can access the pretty printer directly:
  // output = recast.prettyPrint(ast, { 
  //   tabWidth: 2,
  //   quote: 'single' 
  // }).code;

  return output;
}


















function buggered() {

// Let's turn this function declaration into a variable declaration.
var code = [
    "function add(a, b) {",
    "  return a +",
    "    // Weird formatting, huh?",
    "    b;",
    "}"
].join("\n");

// Parse the code using an interface similar to require("esprima").parse.
var ast = recast.parse(code);

// Now do whatever you want to ast. Really, anything at all!
//
// See ast-types (especially the def/core.js) module for a thorough overview of the ast api.

// Grab a reference to the function declaration we just parsed.
var add = ast.program.body[0];

// Make sure it's a FunctionDeclaration (optional).
var n = recast.types.namedTypes;
n.FunctionDeclaration.assert(add);

// If you choose to use recast.builders to construct new AST nodes, all builder
// arguments will be dynamically type-checked against the Mozilla Parser API.
var b = recast.types.builders;

// This kind of manipulation should seem familiar if you've used Esprima or the
// Mozilla Parser API before.
ast.program.body[0] = b.variableDeclaration("var", [
    b.variableDeclarator(add.id, b.functionExpression(
        null, // Anonymize the function expression.
        add.params,
        add.body
    ))
]);

// Just for fun, because addition is commutative:
add.params.push(add.params.shift());
// When you finish manipulating the AST, let recast.print work its magic:

var output = recast.print(ast).code;
// The output string now looks exactly like this, weird formatting and all:

var add = function(b, a) {
  return a +
    // Weird formatting, huh?
    b;
}

// The magic of Recast is that it reprints only those parts of the syntax tree that you modify. In other words, the following identity is guaranteed:

recast.print(recast.parse(source)).code === source

// Whenever Recast cannot reprint a modified node using the original source code, it falls back to using a generic pretty printer. So the worst that can happen is that your changes trigger some harmless reformatting of your code.
//
// If you really don't care about preserving the original formatting, you can access the pretty printer directly:

var output = recast.prettyPrint(ast, { tabWidth: 2 }).code;

// And here's the exact output:

var add = function(b, a) {
  return a + b;
}

// Note that the weird formatting was discarded, yet the behavior and abstract structure of the code remain the same.

var result = recast.print(transform(recast.parse(source, {
  sourceFileName: "source.js"
})), {
  sourceMapName: "map.json"
});

console.log(result.code); // Resulting string of code.
console.log(result.map); // JSON source map.

var SourceMapConsumer = require("source-map").SourceMapConsumer;
var smc = new SourceMapConsumer(result.map);
console.log(smc.originalPositionFor({
  line: 3,
  column: 15
})); // { source: 'source.js',
     //   line: 2,
     //   column: 10,
     //   name: null }

}

