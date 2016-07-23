//
// Support functions for the 'compiled calculator' advanced example
// 


// Symbol table interface for constants, functions and variables:
// 
// Note the use of a local closure to keep track of 'global values' which
// are considered *internal* to the symbol table and library functions provided.
// 


// public interface methods

var lookup_constant;                        // function(name)
var lookup_function;                        // function(name)
var lookup_or_register_variable;            // function(name)
var mark_calculation_start;                 // function(round#)
var generate_opcode_param_count_table;      // function ()                                    


// The closure = symbol tables' setup function:
function init_symbol_tables() {
  // internal 'globals': these are what this closure was created for:
  var calc_round;
  var timestamp;

  // variables' symbol table / registry store:
  var variables = {}; 

  // set up the interface functions:

  lookup_constant = function lookup_constant_f(s) {
    return false;
  };

  lookup_function = function lookup_function_f(s) {
    return false;
  };

  lookup_or_register_variable = function lookup_or_register_variable_closure(s) {
    // if variable doesn't exist yet, create it and assign it the 'NaN' value
    if (variables[s] === undefined) {
      variables[s] = NaN;
    }
    return variables[s];
  };

  mark_calculation_start = function mark_calculation_start_f(round) {
    calc_round = round;

    // sample the time only once per calculus run: all date/time functions,
    // which reference 'current time' will refer to this cached timestamp!
    timestamp = new Date();
  };

  // produce a fast map for [opcode#]->number of arguments or given opcode
  generate_opcode_param_count_table = function generate_opcode_param_count_table_f() {
    var src = fast_opcode_def_table;
    var dst = [];

    for (var i = 0, len = src.length; i < len; i++) {
      var o = src[i];
      dst[o.id] = o.args.length;
    }
    return dst;
  };


  // ---------------------
  
  const fast_opcode_def_table = [
    {
      name: 'NUM',
      id: NUM,
      args: [OPA_VALUE],
    },
    // shorthand for NUM+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    {
      name: 'NUM_AND_SKIP',
      id: NUM_AND_SKIP,
      args: [OPA_VALUE, OPA_OFFSET],
    },
    {
      name: 'STRING',
      id: STRING,
      args: [OPA_STRING],
    },
    // shorthand for STRING+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    {
      name: 'STRING_AND_SKIP',
      id: STRING_AND_SKIP,
      args: [OPA_STRING, OPA_OFFSET],
    },
    // shorthand for TRUE+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    {
      name: 'TRUE_AND_SKIP',
      id: TRUE_AND_SKIP,
      args: [OPA_OFFSET],
    },
    // shorthand for FALSE+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    {
      name: 'FALSE_AND_SKIP',
      id: FALSE_AND_SKIP,
      args: [OPA_OFFSET],
    },
    {
      name: 'VAR',
      id: VAR,
      args: [OPA_VARIABLE_REF],
    },
    // shorthand for VAR | VAR_TO_VALUE
    {
      name: 'VAR_VALUE',
      id: VAR_VALUE,
      args: [OPA_VARIABLE_REF],
    },
    // rhs '=' lhs       -- '=' VAR exp      (variable reference for lhs VAR is implicit, i.e. included with this ASSIGN opcode)
    {
      name: 'ASSIGN',
      id: ASSIGN,
      args: [OPA_VARIABLE_REF],
    },
    {
      name: 'FUNCTION_0',
      id: FUNCTION_0,
      args: [OPA_FUNCTION_REF],
    },
    {
      name: 'FUNCTION_1',
      id: FUNCTION_1,
      args: [OPA_FUNCTION_REF],
    },
    {
      name: 'FUNCTION_2',
      id: FUNCTION_2,
      args: [OPA_FUNCTION_REF],
    },
    {
      name: 'FUNCTION_3',
      id: FUNCTION_3,
      args: [OPA_FUNCTION_REF],
    },
    {
      name: 'FUNCTION_N',
      id: FUNCTION_N,
      args: [OPA_FUNCTION_REF],
    },
    // cond '?' true ':' false -- check the conditional and self-modify stream to exec the correct branch
    {
      name: 'CONDITION',
      id: CONDITION,
      args: [OPA_OFFSET],
    },
    // a SKIP which was turned into a NOT-SKIP
    {
      name: 'EXEC',
      id: EXEC,
      args: [OPA_OFFSET],
    },
    // skip N opcodes; can also happen when the sorcerer has found a chunk which could be constant-folded: pretty-printers running off the same stream would still need the raw data within the skipped chunk!
    {
      name: 'SKIP',
      id: SKIP,
      args: [OPA_OFFSET],
    },
    // flagged error part: shift the specified error unless one has already been set
    {
      name: 'ERROR',
      id: ERROR,
      args: [OPA_ERROR_INFO_OBJ],
    },
    // shorthand for ERROR+SKIP opcodes; note the skip number comes first and includes the error value slot!
    {
      name: 'ERROR_AND_SKIP',
      id: ERROR_AND_SKIP,
      args: [OPA_ERROR_INFO_OBJ],
    },
    // comment line
    {
      name: 'COMMENT',
      id: COMMENT,
      args: [OPA_STRING],
    },
  ];
}


// and set up the closure:
init_symbol_tables();

