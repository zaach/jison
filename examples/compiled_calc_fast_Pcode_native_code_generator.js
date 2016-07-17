

// Sourcecode template for the P-code interpreter: this is a very basic
// bottom-up tree walker, or a very basic CPU simulation, if you are 
// inclined to look at it that way.
//
// The key here is that the 'sorcerer' tree-walker has run before and
// produced a suitable AST token stream for my kind particularly: me, I
// don't do 'shift', not really, I only do 'reduce', so the 'sorcerer'
// has to inject the 'which bits in there need shifting?' knowledge into
// the AST so that these points in the flow show up as 'reduce' actions
// for me. Of course, you may find a bit strange to talk about 'shift'
// and 'reduce' when we already seem to have left the grammar/language 
// realm in here, running some kind of 'assembly code' disguised as an
// 'AST token stream': yes, this is a classic 'tape', but 'assembly code'
// is itself yet another language, though probably a very simple one (SLR(0)?)
// and I want to emphasize the fact that you are **still** working with
// a language, hence a *grammar*, in here; you just happened to have
// translated language A (AST token stream produced by the expression parser)
// into language B (AST token stream which looks very much like 'assembly code'
// as produced by the 'sorcerer' tree walker).
//
// How do you develop such a beast?
//
// First, I came up with the P-code runner, a.k.a. 'interpreter' and checked
// if my ideas about fast and faster code actually worked more or less.
// Once that had been nailed down, I thus knew what 'assembly language' I
// had to feed this P-code interpreter and *that* drives the translation/transposition
// activity required from the 'sorcerer' middleware, so that one has
// been next. 
//
// After that, it's a couple of iterations to get everything working to my
// satisfaction, which I'ld say would be possibly be 'Agile' this day and age,
// but I say it's correct application of the control engineering feedback loop model
// (or Waterfall Model of old, just to get your knickers in a twist)   :-)
//
// Anyway, the key element is that the P-code runner must be as fast as possible,
// hence have the least bit of overhead, and we can help a lot accomplishing 
// just that by making sure we pick a better format for our 'incoming' P-code
// stream.


// critical condition: the P-code stream input is to be treated as **immutable**
// so it can be re-used time and again!
//
// Do note that the way we treat this stream is NOT EXACTLY what 'immutable'
// means in the world outside! We perform some actions which might be termed
// 'self-modifying code', but DO NOTE that we always 'self-modify' the stream
// in slots which have been reserved for this by the 'sorcerer', i.e. the
// P-code **generator** has intimate knowledge about our behaviour in here
// in has gone the extra mile and given us 'scratch space' in a way that 
// might actually be faster (optimal?) for us to *execute* in here, at the cost
// of:
// - a slightly longer P-code stream
// - the IMPLICIT condition that two P-code runners MUST NOT execute the same
//   P-code stream in parallel, *ever*!
function generate_native_code_for_Pcode(stream, context) {
  var sourcecode = {
    fetch_variables: {},      // hash map! every variable that is used, is loaded only once, at the start!
    store_variables: {},      // hash map! every variable that is written is stored only once, at the end!
    body: [],
  };

  var scratch = [];

  function string_escape(s) {
    return s.replace(/["]/g, '\\"');
  }

  for (var i = 0, len = stream.length; i < len; ) {
    var opcode = stream[i++];
    switch (opcode) {
    case NUM:
      scratch.push(stream[i++]);
      continue;

    // shorthand for NUM+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    case NUM_AND_SKIP:
      scratch.push(stream[i++]);
      i += stream[i];
      continue;

    case STRING:
      scratch.push('"' + string_escape(stream[i++]) + '"');
      continue;

    // shorthand for STRING+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    case STRING_AND_SKIP:
      a = stream[i++];
      i += stream[i];
      continue;

    case TRUE:
      a = true;
      continue;

    // shorthand for TRUE+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    case TRUE_AND_SKIP:
      a = true;
      i += stream[i];
      continue;

    case FALSE:
      a = false;
      continue;

    // shorthand for FALSE+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    case FALSE_AND_SKIP:
      a = false;
      i += stream[i];
      continue;

    case VAR:
      av = stream[i++];
      continue;

// Now follow a few opcodes which didn't show up in the AST language before 'sorcerer': these boys are here to 
// help us transform grammar 'shift's into 'reduce' actions after type and code analysis inside the sorcerer
// has done its job:

    case VAR_TO_VALUE:          // assembly: fetch from address
      a = context.variables[av];
      continue;

    case VAR_VALUE:             // shorthand for VAR | VAR_TO_VALUE
      a = context.variables[stream[i++]];
      continue;

    case MOVE_TO_R1:            // ~ first 'shift' after another 'reduce'
      r1 = a;
      continue;

    case MOVE_TO_R2:            // ~ second 'shift' after another 'reduce'
      r2 = a;
      continue;

    case MOVE_FROM_R1:
      a = r1;
      continue;

    case MOVE_FROM_R2:
      a = r2;
      continue;

    case EXCHANGE_R1:           // shorthand for MOVE_TO_R1 // MOVE_FROM_R1 (note that we cannot swap registers, except for this shorthand here!)
      b = r1;
      r1 = a;
      a = b;
      continue;

    case EXCHANGE_R2:           // shorthand for MOVE_TO_R2 // MOVE_FROM_R2 (note that we cannot swap registers, except for this shorthand here!)
      b = r2;
      r2 = a;
      a = b;
      continue;

    case MOVE_ALL_TO_RX:
      rx = [a, r1, r2];
      continue;

    case MOVE_TO_RX:            // add one more arg to the rx[] register array
      rx.push(a);
      continue;

    case UNSHIFT_RX_TO_ALL:     // can be used for example when doing long additions
      a = rx.unshift();
      r1 = rx.unshift();
      r2 = rx.unshift();
      continue;

    case UNSHIFT_RX_TO_R12:     // keep the accumulator intact...
      r1 = rx.unshift();
      r2 = rx.unshift();
      continue;

    case SHIFT_EX:              // shift the active error to make room for a new incoming error: multiple sources each can track their own own error status into an error filter/select function.
      ex.unshift(false);
      continue;

    case UNSHIFT_EX:
      a = ex.shift();
      continue;

// ------------------------------------------------

    case ASSIGN:                // rhs '=' lhs       -- '=' VAR exp 
      context.variables[av] = r1;
      continue;

    case PROCEDURE:             // function() call; can produce an error  
      f = stream[i++];
      a = f.call(context);
      continue;

    case FUNCTION_1:             // function(arg) call; can produce / filter an error 
      f = stream[i++];
      a = f.call(context, a);
      // NOTE: error filtering / creation is happening inside those functions which are concerned by this, thanks to this flow: 
      //       all functions have access to the entire calculus context, which includes the error stack, hence no-one keeps 
      //       them from manipulating that stack if one of them finds this is necessary, while I don't get to burden
      //       everyone else involved as well: this is a significant overhead minimalization.
      //       
      //       Also note that error PROPAGATION is completely implicit, taking ZERO statements to execute inside any function,
      //       thanks to this flow: as we track a separate error stack in the calculus context, any function which should
      //       propagate errors from input to output can simply do so by ... not caring at all! As the error stack will already
      //       have been set up before the function call, after exiting the function the error stack will still carry the same
      //       content, hence have propagated the error at precisely ZERO COST.
      //        
      //       The error stack tracking employed here could also be easily implemented in the alternative in the other example:
      //       the SLR(0)-based grammar-based tree walker-based calculator, so I don't consider it a 'win' for this particular
      //       Pcode interpreter over that one...
      continue;

    case FUNCTION_2:             // function(arg, arg) call; can produce / filter an error 
      f = stream[i++];
      a = f.call(context, a, r1);
      continue;

    case FUNCTION_3:             // function(arg, arg, arg) call; can produce / filter an error  
      f = stream[i++];
      a = f.call(context, a, r1, r2);
      continue;

    case FUNCTION_N:             // function(arg, arg, arg, ...) call 
      f = stream[i++];
      a = f.apply(context, rx);   // all values are assumed to be waiting in the rx[] array already
      continue;

    case ADD:                    // '+' arg arg 
      a += r1;
      continue;

    case ADD_3:                  // '+' arg arg arg 
      a += r1 + r2;
      continue;

    case SUBTRACT:               // '-' arg arg 
      a += r1;
      continue;

    case SUBTRACT_3:
      a -= r1 + r2;              // a = a - r1 - r2  === a = a - (r1 + r2)
      continue;

    case MULTIPLY:               // '*' arg arg 
      a *= r1;
      continue;

    case MULTIPLY_3:               // '*' arg arg arg 
      a *= r1 * r2;
      continue;

    case DIVIDE:                // '/' arg arg 
      b = a / r1;
      // WARNING: this operator can generate an error!
      if (isNaN(b) && !isNaN(a) && !isNaN(r1)) {
        // set error if not already set for this chunk:
        if (!ex[0]) {
          ex[0] = new Error("division by " + r1);
        }
      }
      a = b;
      continue;

    case MODULO:                // '%' arg arg 
      b = a % r1;
      // WARNING: this operator can generate an error!
      if (isNaN(b) && !isNaN(a) && !isNaN(r1)) {
        // set error if not already set for this chunk:
        if (!ex[0]) {
          ex[0] = new Error("modulo by " + r1);
        }
      }
      a = b;
      continue;

    case POWER:                 // '^' arg arg 
      b = Math.pow(a, r1);
      // WARNING: this operator can generate an error!
      if (isNaN(b) && !isNaN(a) && !isNaN(r1)) {
        // set error if not already set for this chunk:
        if (!ex[0]) {
          ex[0] = new Error("exponentiation by " + r1);
        }
      }
      a = b;
      continue;

    case UMINUS:                // '-' arg 
      a = -a;
      continue;

    case UPLUS:                 // '+' arg 
      a = +a;       // Shouldn't this be a no-op?  Not really, as STRING input gets cast to number here!
      continue;

    case NOT:                   // '!' arg 
      a = !a;
      continue;

    case FACTORIAL:             // '!' arg 
      b = factorial(a);
      // WARNING: this operator can generate an error!
      if (isNaN(b) && !isNaN(a) && !isNaN(r1)) {
        // set error if not already set for this chunk:
        if (!ex[0]) {
          ex[0] = new Error("factorial by " + r1);
        }
      }
      a = b;
      continue;

    case PERCENT:               // '%' arg 
      a /= 100;
      continue;

    case CONDITIONAL:           // cond '?' true ':' false -- check the conditional and self-modify stream to exec the correct branch
      if (a) {
        stream[i] = EXEC;
        n = stream[i + 1];
        stream[i + n1] = SKIP; 
      } else {
        stream[i] = SKIP;
        n = stream[i + 1];
        stream[i + n] = SKIP; 
      }
      // NOTE: error propagation of the 'active branch only' is implicitly happening thanks to this flow: the inactive
      //       branch is simply skipped, hence no errors in there will ever be seen as we simply do not perform any of
      //       its calculus. 
      //       
      //       This is where our hand-optimized Pcode interpreter with Reverse Polish opcode stream *wins*
      //       significantly compared to the SLR(0)-based grammar-based tree walker-based calculator as shown in the
      //       compiled_calc_exec example: that one only decided which branch to pick AFTER both have their values calculated! 
      continue;

    case EXEC:                  // a SKIP which was turned into a NOT-SKIP
      // gobble the length slot that accompanies this one!
      stream[i++];
      continue;

    case SKIP:                  // skip N opcodes; can also happen when the sorcerer has found a chunk which could be constant-folded: pretty-printers running of the same stream would still need the raw data within the skipped chunk!
      i += stream[i];
      continue;

    case ERROR:                 // flagged error part: shift the specified error unless one has already been set
      if (!ex[0]) {
        ex = stream[i];
      }
      i++;
      continue;

    case ERROR_AND_SKIP:        // shorthand for ERROR+SKIP opcodes; note the skip number comes first and includes the error value slot!
      if (!ex[0]) {
        ex = stream[i + 1];
      }
      i += stream[i];
      continue;
    }
  }
}








