

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

function main(args) {
  if (!args[1] || !args[2]) {
      console.log('Usage: ' + args[0] + ' CONSTANTS_JSON5_FILE JS_SRC_FILE');
      process.exit(1);
  }
  var constants = loadConstants(path.normalize(args[1]));
  var source = fs.readFileSync(path.normalize(args[2]), 'utf8');
  source = rewrite(source, constants);
  fs.writeFileSync(path.normalize(args[2]), source, 'utf8');
}
main(process.argv.slice(1));



function loadConstants(filepath) {
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

  var symdef_uniq_check = {};
  // Only these symbols are allowed to have the values 1 or 2:
  symdef_uniq_check[1] = 'EOF';
  symdef_uniq_check[2] = 'error';
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

  if (!predefined_symbols['EOF']) {
    predefined_symbols['EOF'] = 1;
  }
  if (!predefined_symbols['ERROR']) {
    predefined_symbols['ERROR'] = 2;
  }
  return predefined_symbols;
}




function rewrite(src, defs) {
  // Parse the code using an interface similar to require("esprima").parse.
  var output = src;
  var ast = recast.parse(src);

  output = recast.print(ast).code;

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

