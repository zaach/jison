
function debug_trace() {
    if (typeof Jison !== 'undefined' && Jison.print) {
        Jison.print.apply(null, arguments);
    } else if (typeof print !== 'undefined') {
        print.apply(null, arguments);
    } else if (typeof console !== 'undefined' && console.log) {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift('');           // prevent `%.` printf-style expansions; see https://nodejs.org/api/console.html#console_console_log_data_args
        console.log.apply(null, args);
    }
}
