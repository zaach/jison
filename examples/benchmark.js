

// round to the number of decimal digits:
function r(v, n) {
    var m = Math.pow(10, n | 0);
    v *= m;
    v = Math.round(v);
    return v / m;
}

// run the benchmark on function `f` for at least 5 seconds.
function bench(f, n) {
    var factor = 50;
    const run = 1;         // factor of 50 !  
    n = n | 0;
    n /= run;
    n = n | 0;
    n = Math.max(n, 10); // --> minimum number of tests: 10*run*factor
    perf.mark('monitor');

    // get the number of tests internal to the test function: 1 or more
    factor *= f();

    var ts = [];
    for (var i = 0; i < n; i++) {
        perf.mark('bench');
        for (var j = 0; j < run; j++) {
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
        if (consumed < 5000) {
            // stay in the loop until 5 seconds have expired!:
            i = Math.min(i, n - 2);
        }
    }

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
    console.log("Time: total: ", r(sum, 0) + 'ms',
        ", sample_count:", cnt,
        ", # runs:", cnt * sample_size,
        ", average:", r(avg / sample_size, 4) + 'ms',
        ", deviation:", r(100 * dev / avg, 2) + '%',
        ", peak_deviation:", r(100 * peak / avg, 2) + '%'
    );
}
