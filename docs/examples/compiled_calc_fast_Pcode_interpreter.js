

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
function exec_Pcode(stream, context) {
  // our accumulator and register bank:
  //      https://www.scirra.com/blog/76/how-to-write-low-garbage-real-time-javascript
  var a, r1, r2, rx = [];
  // our accumulator and register bank optimized for integers:
  var ai, ri1, ri2, rix = [];
  // our accumulator and register bank optimized for floating point values:
  var af, rf1, rf2, rfx = [];
  // our accumulator and register bank optimized for string values:
  var as, rs1, rs2, rsx = [];
  // our accumulator and register bank optimized for boolean values:
  var ab, rb1, rb2, rbx = [];
  // our accumulator and register bank optimized for variable references:
  var av, rv1, rv2, rvx = [];
  // our accumulator optimized for constant references:
  var cv;

  // our error-stack, where errors get shifted before we invoke error-filtering functions:
  // we 'unshift' errors into this stack so that the 'active error' is always at index 0,
  // which saves us the hassle of keeping track of the length of the array.
  // We ASSUME the number of error stack CHECKS is quite a bit higher than the number
  // of error stack PUSH+POP actions, so we decide a potentially less optimal 
  // unshift-and-shift-vs-push-and-pop is preferable.
  var ex = context.error_stack;

  // misc references to context/global tables:
  var vt = context.variables;
  var ct = context.constants;

  // function/procedure reference register
  var f;

  // scratch register
  var b;

  // skip/jump helpers:
  var n, n1, n2;

  // inline integer, floating point reconstruction helpers
  var irh, fprh;

  for (var i = 0, len = stream.length; i < len; ) {
    var opcode = stream[i++];

    // As we can 'inline' integers, indexes and floating point values using
    // at least *part* of the opcode word (for both short and long notation)
    // we can best first extract the general route via bitmask, after which
    // we do the appropriate work for the given section:
    // - opcode execution (all parameters come from registers or stack)
    // - integer / index extraction (long notation takes extra words) + opcode execution
    // - floating point extraction (long notation takes extra words) + opcode execution
    //
    // We want the fastest possible run-time, so we don't bitshift or otherwise
    // attempt to make the extracted parts more 'human developer readable' while
    // we work, hence the values in the switch/cases may be different from the
    // ones that the AST generator (parser, code optimizer, ...) has been using
    // to construct the opcode / word.
    // 
    // For the bit patterns, compare this one with the code in the benchmark.js repo
    // at:
    // 
    //     GerHobbelt/benchmark.js::/example/jsperf/fpcvt.js
    // 
    // 

    // As we expect most encodings to be regular numbers, those will be in 0x0000..0x7FFF and
    // we don't want to spend the least amount of time in the 'special values' overhead,
    // which would be added overhead if we did check for those *first* instead of at the *same time*
    // as we do here by looking at the top nibble immediately:
    // 
    // nibble value:
    // 0..7: regular 'long encoding' floating point values. Act as *implicit* NUM opcodes.
    // 8..C: 'short float' encoded floating point values. Act as *implicit* NUM opcodes.
    // D: part of this range is illegal ('DO NOT USE') but the lower half (0xD000..0xD7FF),
    //    about 2K codes worth, is used for the other opcodes.
    // E: rest of the range for 'short float' encoded floating point values. 
    //    Act as *implicit* NUM opcodes.
    // F: rest of the range for 'short float' encoded floating point values. 
    //    Act as *implicit* NUM opcodes. (0xF800..0xFFFF: reserved for future use) 
    switch (opcode & 0xF000) {
    // This range includes the Unicode extended character ranges ('Surrogates') and MUST NOT be used by us for 'binary encoding'
    // purposes as we would than clash with any potential Unicode validators out there! The key of the current
    // design is that the encoded output is, itself, *legal* Unicode -- though admittedly I don't bother with
    // the Unicode conditions surrounding shift characters such as these:
    // 
    // which reside in the other ranges that we DO employ for our own nefarious encoding purposes!
    // 
    // By the way: do note that the clash-potential is for the Surrogates range 0xD800-0xDFFF hence 
    // 0xD000-0xD7FF (2K) *is* at least theoretically available for our encoding. And we DO use them now
    // for encoding floating point 'special values'.
    case 0xD000:
      // specials: compared to `GerHobbelt/benchmark.js::/example/jsperf/fpcvt.js` we have 
      // extended the use of the 0xF000 range by placing all regular opcodes in there.
      switch (opcode) {
      case FPC_ENC_POSITIVE_ZERO:
        return 0;

      case FPC_ENC_NEGATIVE_ZERO:
        return -0;

      case FPC_ENC_POSITIVE_INFINITY:
        return Infinity;

      case FPC_ENC_NEGATIVE_INFINITY:
        return -Infinity;

      case FPC_ENC_NAN:
        return NaN;

      default:
        throw new Error('illegal fp encoding value in 0xDXXX unicode range');
      }
      break;

    case 0x8000:
    case 0x9000:
    case 0xA000:
    case 0xB000:
    case 0xC000:
      // 'human values' encoded as 'short floats':
      //
      // Bits in word:
      // - 0..9: integer mantissa; values 0..1023
      // - 10: sign
      // - 11..14: exponent 0..9 with offset -3 --> -3..+6
      // - 15: set to signal special values; this bit is also set for some special Unicode characters,
      //       so we can only set this bit and have particular values in bits 0..14 at the same time
      //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
      //
      var dm = c0 & 0x03FF;      // 10 bits
      var ds = c0 & 0x0400;      // bit 10 = sign
      var dp = c0 & 0x7800;      // bits 11..14: exponent

      //console.log('decode-short-0', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2;

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    // (0xF800..0xFFFF: reserved for future use)
    case 0xE000:
    case 0xF000:
      // 'human values' encoded as 'short floats':
      //
      // Bits in word:
      // - 0..9: integer mantissa; values 0..1023
      // - 10: sign
      // - 11..14: exponent 10..12 with offset -3 --> 7..9
      // - 15: set to signal special values; this bit is also set for some special Unicode characters,
      //       so we can only set this bit and have particular values in bits 0..14 at the same time
      //       in order to prevent a collision with those Unicode specials at 0xD800..0xDFFF.
      //
      var dm = c0 & 0x03FF;      // 10 bits
      var ds = c0 & 0x0400;      // bit 10 = sign
      var dp = c0 & 0x7800;      // bits 11..14: exponent

      //console.log('decode-short-0C', ds, dm, '0x' + dp.toString(16), dp >>> 11, c0, '0x' + c0.toString(16));
      dp >>>= 11;
      dp -= 3 + 2 + 2;            // like above, but now also compensate for exponent bumping (0xA --> 0xC, ...)
      if (dp > 12) {
        throw new Error('illegal fp encoding value in 0xF8XX-0xFFXX unicode range');
      }

      var sflt = dm * Math.pow(10, dp);
      if (ds) {
        sflt = -sflt;
      }
      //console.log('decode-short-1C', sflt, ds, dm, dp, c0, '0x' + c0.toString(16));
      return sflt;

    default:
      // 'regular' floating point values:
      //
      // Bits in word:
      // - 0..11: exponent; values -1024..+1023 with an offset of 1024 to make them all positive numbers
      // - 12: sign
      // - 13,14: length 1..4: the number of words following to define the mantissa
      // - 15: 0 (zero)
      //
      var len = c0 & 0x6000;
      var vs = c0 & 0x1000;
      var p = c0 & 0x0FFF;

      p -= 1024;
      //console.log('decode-normal-0', vs, p, len, '0x' + len.toString(16), c0, '0x' + c0.toString(16));

      // we don't need to loop to decode the mantissa: we know how much stuff will be waiting for us still
      // so this is fundamentally an unrolled loop coded as a switch/case:
      var m;
      var im;
      // no need to shift len before switch()ing on it: it's still the same number of possible values anyway:
      switch (len) {
      case 0x0000:
        // 1 more 15-bit word:
        im = s.charCodeAt(1);
        m = im / FPC_ENC_MODULO;
        opt.consumed_length++;
        //console.log('decode-normal-len=1', m, s.charCodeAt(1));
        break;

      case 0x2000:
        // 2 more 15-bit words:
        im = s.charCodeAt(1);
        im <<= 15;
        im |= s.charCodeAt(2);
        m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
        opt.consumed_length += 2;
        //console.log('decode-normal-len=2', m, s.charCodeAt(1), s.charCodeAt(2));
        break;

      case 0x4000:
        // 3 more 15-bit words: WARNING: this doesn't fit in an *integer* of 31 bits any more,
        // so we'll have to use floating point for at least one intermediate step!
        //
        // Oh, by the way, did you notice we use a Big Endian type encoding mechanism?  :-)
        im = s.charCodeAt(1);
        m = im / FPC_ENC_MODULO;
        im = s.charCodeAt(2);
        im <<= 15;
        im |= s.charCodeAt(3);
        m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
        opt.consumed_length += 3;
        //console.log('decode-normal-len=3', m, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3));
        break;

      case 0x6000:
        // 4 more 15-bit words, where the last one doesn't use all bits. We don't use
        // those surplus bits yet, so we're good to go when taking the entire word
        // as a value, no masking required there.
        //
        // WARNING: this doesn't fit in an *integer* of 31 bits any more,
        // so we'll have to use floating point for at least one intermediate step!
        im = s.charCodeAt(1);
        im <<= 15;
        im |= s.charCodeAt(2);
        m = im / (FPC_ENC_MODULO * FPC_ENC_MODULO);
        im = s.charCodeAt(3);
        im <<= 15;
        im |= s.charCodeAt(4);
        m += im / (FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO * FPC_ENC_MODULO);
        opt.consumed_length += 4;
        //console.log('decode-normal-len=4', m, s.charCodeAt(1) / FPC_ENC_MODULO, s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3), s.charCodeAt(4));
        break;
      }
      //console.log('decode-normal-1', vs, m, p, opt.consumed_length);
      m *= Math.pow(2, p);
      m *= 2;                       // we do this in two steps to allow handling even the largest floating point values, which have p=1023: Math.pow(2, p+1) would fail for those!
      if (vs) {
        m = -m;
      }
      //console.log('decode-normal-2', m);
      return m;
    }
  }












  for (; false; ) {
    switch (opcode & 0xF000) {
    case 0x0000:
      // This one section is special: it contains the regular opcodes 
      // (which are mostly ASCII-range numbers for the benefit of compression
      // (? that's a hypothesis which still needs to be field-tested! ?))
      // and direct NUM numbers.
    case 0x1000:
    case 0x2000:
    case 0x3000:
    case 0x4000:
    case 0x5000:
    case 0x6000:
    case 0x7000:
    case 0x8000:
    case 0x9000:
    case 0xA000:
    case 0xB000:
    case 0xC000:
    case 0xD000:
    case 0xE000:
    case 0xF000:

    } 
    switch (opcode) {
    case CONSTANT:
      cv = stream[i++];
      a = ct[cv];
      continue;

    case NUM:
      a = stream[i++];
      continue;

    // shorthand for NUM+SKIP: this value is a constant-folded value, while the skipped part of the stream remains for formatter walkers...
    case NUM_AND_SKIP:
      a = stream[i++];
      i += stream[i];
      continue;

    case STRING:
      a = stream[i++];
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
      a = vt[av];
      continue;

    case VAR_VALUE:             // shorthand for VAR | VAR_TO_VALUE
      a = vt[stream[i++]];
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

    case MOVE_R2_TO_R1:
      r1 = r2;
      continue;

    case EXCHANGE_R1_R2:
      b = r2;
      r2 = r1;
      r1 = b;
      continue;

    case EXCHANGE_A_R1:
      b = r1;
      r1 = a;
      a = b;
      continue;

    case EXCHANGE_A_R2:
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

    case PUSH:                 // move all registers up by one: push accumulator onto the stack. Only our 'stack' consists of a few registers and then the overflow stack `rx[]`:
      rx.push(r2);
      r2 = r1;
      r1 = a;
      continue;

    case POP:                 // move all registers down by one: pop accumulator from the stack. Only our 'stack' consists of a few registers and then the overflow stack `rx[]`:
      a = r1;
      r1 = r2;
      r2 = rx.pop();
      continue;

    case SHIFT_EX:              // shift the active error to make room for a new incoming error: multiple sources each can track their own own error status into an error filter/select function.
      ex.unshift(false);
      continue;

    case UNSHIFT_EX:
      a = ex.shift();
      continue;

// ------------------------------------------------

    case ASSIGN:                // rhs '=' lhs       -- '=' VAR exp 
      av = stream[i++];
      vt[av] = a;
      continue;

    case FUNCTION_0:             // function() call; can produce an error  
      f = stream[i++];
      a = f.call(context);
      continue;

    case FUNCTION_1:             // function(arg) call; can produce / filter an error 
      f = stream[i++];
      a = f.call(context, a);
      // NOTE: error filtering / creation is happening inside those functions which are concerned by this, thanks to this flow: 
      //       all functions have access to the entire calculus context, which includes the error stack, hence no-one keeps 
      //       them from manipulating that stack if one of them finds this is necessary, while I don't get to burden
      //       everyone else involved as well: this is a significant overhead minimization.
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
      n = stream[i++];
      a = f.apply(context, rx);   // all values are assumed to be waiting in the rx[] array already
      continue;

    case EQ:                     // EQ arg arg 
      a = (a === r1);
      continue;

    case NEQ:                    // NEQ arg arg 
      a = (a !== r1);
      continue;

    case LEQ:                    // LEQ arg arg 
      a = (r1 <= a);
      continue;

    case GEQ:                    // GEQ arg arg 
      a = (r1 >= a);
      continue;

    case LT:                     // LT arg arg 
      a = (r1 < a);
      continue;

    case GT:                     // GT arg arg 
      a = (r1 > a);
      continue;

    case AND:                    // AND arg arg 
      a = (a && r1);
      continue;

    case OR:                     // OR arg arg 
      a = (a || r1);
      continue;

    case XOR:                     // XOR arg arg 
      a = !!(!!a ^ !!r1);
      continue;

    case BITWISE_AND:            // BITWISE_AND arg arg 
      a = (a & r1);
      continue;

    case BITWISE_OR:             // BITWISE_OR arg arg 
      a = (a | r1);
      continue;

    case BITWISE_XOR:            // BITWISE_XOR arg arg 
      a = (a ^ r1);
      continue;

    case ADD:                    // '+' arg arg 
      a += r1;
      continue;

    case ADD_3:                  // '+' arg arg arg 
      a += r1 + r2;
      continue;

    case SUBTRACT:               // '-' arg arg 
      a -= r1;
      continue;

    case SUBTRACT_3:              // exp[r2] MOVE_TO_R2 exp[r1] MOVE_TO_R1 exp[a] SUBTRACT_3                         vs.    
                                  // exp[r2] MOVE_TO_R2 exp[r1] MOVE_TO_R1 exp[a] SUBTRACT MOVE_R2_TO_R1 SUBTRACT    vs.
                                  // exp[r2] MOVE_TO_R2 exp[r1] MOVE_TO_R1 exp[a] SUBTRACT SUBTRACT_R2               vs.
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

    case BITWISE_NOT:           // '~' arg 
      a = ~a;
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

    case CONDITION:             // cond '?' true ':' false -- check the conditional and self-modify stream to exec the correct branch
      if (a) {
        // take the branch and skip the ELSE:
        // skip the jump offset slot.
        i++;
      } else {
        // take the alternative branch and skip the IF:
        // use the jump offset (which is already corrected for this offset slot and the SKIP instruction at the end of the IF branch; see `compiled_calc_for_fast_engine.jison`.
        i += stream[i];
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

    case SKIP:                  // skip N opcodes; can also happen when the sorcerer has found a chunk which could be constant-folded: pretty-printers running off the same stream would still need the raw data within the skipped chunk!
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








