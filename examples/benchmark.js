
/**
 * Provide a generic performance timer, which strives to produce highest possible accuracy time measurements.
 * 
 * methods:
 * 
 * - `start()` (re)starts the timer and 'marks' the current time for ID="start". 
 *   `.start()` also CLEARS ALL .mark_delta() timers!
 *
 * - `mark(ID)` calculates the elapsed time for the current timer in MILLISECONDS (floating point) 
 *   since `.start()`. `.mark_delta()` then updates the 'start/mark time' for the given ID.
 *
 *   ID *may* be NULL, in which case `.mark()` will not update any 'start/mark time'.
 *    
 * - `mark_delta(ID, START_ID)` calculates the elapsed time for the current timer in MILLISECONDS (floating point) since 
 *   the last call to `.mark_delta()` or `.mark()` with the same ID. `.mark_delta()` then updates the 
 *   'start/mark time' for the given ID.
 *
 *   When the optional START_ID is specified, the delta is calculated against the last marked time 
 *   for that START_ID.
 *
 *   When the ID is NULL or not specified, then the default ID of "start" will be assumed.
 *   
 *   This results in consecutive calls to `.mark_delta()` with the same ID to produce 
 *   each of the time intervals between the calls, while consecutive calls to
 *   `.mark()` with he same ID would produce an increase each time instead as the time 
 *   between the `.mark()` call and the original `.start()` increases.
 * 
 * Notes:
 * 
 * - when you invoke `.mark()` or `.mark_delta()` without having called .start() before, 
 *   then the timer is started at the mark.
 * 
 * - `.start()` will erase all stored 'start/mark times' which may have been
 *   set by `.mark()` or `.mark_delta()` before -- you may call `.start()` multiple times for
 *   the same timer instance, after all.
 * 
 * - you are responsible to manage the IDs for `.mark()` and `.mark_delta()`. The ID MUST NOT be "start" 
 *   as ID = "start" identifies the .start() timer.
 * 
 * References for the internal implementation:
 * 
 *    - http://updates.html5rocks.com/2012/08/When-milliseconds-are-not-enough-performance-now
 *    - http://ejohn.org/blog/accuracy-of-javascript-time/
 *
 * @class 
 * @constructor
 */
function PerformanceTimer() {
  /* @private */ var start_time = false;
  var obj = {
  };
  // feature detect:
  /* @private */ var f, tv;
  /* @private */ var p = (typeof window !== 'undefined' && window.performance);
  if (p && p.timing.navigationStart && p.now) {
    f = function () {
      return p.now();
    };
  } else if (p && typeof p.webkitNow === 'function') {
    f = function () {
      return p.webkitNow();
    };
  } else {
    p = (typeof process !== 'undefined' && process.hrtime);
    if (typeof p === 'function') {
      tv = p();
      if (tv && tv.length === 2) {
        f = function () {
          var rv = p();
          return rv[0] * 1e3 + rv[1] * 1e-6;
        };
      } 
    } 
    if (!f) {
      f = function () {
        return Date.now();
      };
      try {
        f();
      } catch (ex) {
        f = function () {
          return +new Date();
        };
      }
    }
  }

  obj.start = function () {
    start_time = {
      start: f()
    };
    return obj;
  };
  
  obj.mark = function (id, start_id) {
    if (start_time === false) this.start();
    var end_time = f();
    var begin_time = start_time[start_id || id || "start"];
    if (!begin_time) {
      begin_time = end_time;
    }
    var rv = end_time - begin_time;
    if (id) {
      start_time[id] = end_time;
    }
    return rv;
  };
  
  obj.mark_delta = function (id) {
    if (start_time === false) this.start();
    id = id || "start";
    var end_time = f();
    var begin_time = start_time[id];
    if (!begin_time) {
      begin_time = end_time;
    }
    var rv = end_time - begin_time;
    start_time[id] = end_time;
    return rv;
  };
  
  obj.reset_mark = function (id) {
    id = id || "start";
    start_time[id] = null;
    return obj;
  };

  obj.get_mark = function (id) {
    id = id || "start";
    return start_time[id];
  };

  obj.mark_sample_and_hold = function (id) {
    if (start_time === false) this.start();
    id = id || "start";
    // sample ...
    var end_time = f();
    var begin_time = start_time[id];
    if (!begin_time) {
      begin_time = end_time;
      // ... and hold
      start_time[id] = begin_time;
    }
    var rv = end_time - begin_time;
    return rv;
  };

  return obj;
}

var perf = PerformanceTimer();



// round to the number of decimal digits:
function r(v, n) {
    var m = Math.pow(10, n | 0);
    v *= m;
    v = Math.round(v);
    return v / m;
}

// run the benchmark on function `f` for at least 5 seconds.
function bench(f, n, minimum_run_time, setup_f, destroy_f) {
    var factor = 50;
    const run = 1;         // factor of 50 !  
    n |= 0;
    n /= run;
    n |= 0;
    n = Math.max(n, 1); // --> minimum number of tests: 1*run*factor
    
    minimum_run_time |= 0;
    if (!minimum_run_time) {
        minimum_run_time = 5000;     // default: 5 seconds minimum run time!
    }
    minimum_run_time = Math.max(minimum_run_time, 1000);    // absolute minimum run time: 1 second

    perf.mark('monitor');

    if (setup_f) {
        setup_f(f, n, minimum_run_time);
    }

    // get the number of tests internal to the test function: 1 or more
    var internal_cnt = f();
    if (typeof internal_cnt === 'number' && (internal_cnt | 0) === internal_cnt) {
        factor *= internal_cnt;
    }

    var ts = [];
    for (var i = 0; i < n; i++) {
        perf.mark('bench');
        for (var j = 0; j < run; j++) {
            // 50 x f(): that seems a sort of 'sweet spot' for NodeJS v5, at least for some benchmarks...
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();

            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
            f();
        }
        ts.push(perf.mark('bench'));
        var consumed = perf.mark_sample_and_hold('monitor');
        //console.log('consumed', consumed, ts[ts.length - 1], i);
        if (consumed < minimum_run_time) {
            // stay in the loop until 5 seconds have expired!:
            i = Math.min(i, n - 2);
        }
    }

    if (destroy_f) {
        destroy_f(f, n, minimum_run_time);
    }

    var consumed = perf.mark_sample_and_hold('monitor');
    
    var sum = 0;
    for (var i = 0, cnt = ts.length; i < cnt; i++) {
        sum += ts[i];
    }
    var avg = sum / cnt;

    var dev = 0;
    var peak = 0;
    for (var i = 0; i < cnt; i++) {
        var delta = Math.abs(ts[i] - avg);
        dev += delta;
        peak = Math.max(peak, delta);
    }
    dev /= cnt;
    var sample_size = run * factor;
    console.log(["Time: total: ", r(sum, 0) + 'ms',
        ", sample_count: ", cnt,
        ", # runs: ", cnt * sample_size,
        ", # runs/sec: ", r(cnt * sample_size * 1000 / sum, 1),
        ", average: ", r(avg / sample_size, 4) + 'ms',
        ", deviation: ", r(100 * dev / avg, 2) + '%',
        ", peak_deviation: ", r(100 * peak / avg, 2) + '%',
        ", total overhead: ", r(consumed - sum, 0) + 'ms'].join('')
    );
}
