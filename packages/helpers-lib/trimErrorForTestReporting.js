var cycleref = [];
var cyclerefpath = [];

var linkref = [];
var linkrefpath = [];

var path = [];

function shallow_copy(src) {
    if (typeof src === 'object') {
        if (src instanceof Array) {
            return src.slice();
        }

        var dst = {};
        if (src instanceof Error) {
            dst.name = src.name;
            dst.message = src.message;
            dst.stack = src.stack;
        }

        for (var k in src) {
            if (Object.prototype.hasOwnProperty.call(src, k)) {
                dst[k] = src[k];
            }
        }
        return dst;
    }
    return src;
}


function shallow_copy_and_strip_depth(src, parentKey) {
    if (typeof src === 'object') {
        var dst;

        if (src instanceof Array) {
            dst = src.slice();
            for (var i = 0, len = dst.length; i < len; i++) {
                path.push('[' + i + ']');
                dst[i] = shallow_copy_and_strip_depth(dst[i], parentKey + '[' + i + ']');
                path.pop();
            }
        } else {
            dst = {};
            if (src instanceof Error) {
                dst.name = src.name;
                dst.message = src.message;
                dst.stack = src.stack;
            }

            for (var k in src) {
                if (Object.prototype.hasOwnProperty.call(src, k)) {
                    var el = src[k];
                    if (el && typeof el === 'object') {
                        dst[k] = '[cyclic reference::attribute --> ' + parentKey + '.' + k + ']';
                    } else {
                        dst[k] = src[k];
                    }
                }
            }
        }
        return dst;
    }
    return src;
}


function trim_array_tail(arr) {
    if (arr instanceof Array) {
        for (var len = arr.length; len > 0; len--) {
            if (arr[len - 1] != null) {
                break;
            }
        }
        arr.length = len;
    }
}

function treat_value_stack(v) {
    if (v instanceof Array) {
        var idx = cycleref.indexOf(v);
        if (idx >= 0) {
            v = '[cyclic reference to parent array --> ' + cyclerefpath[idx] + ']';
        } else {
            idx = linkref.indexOf(v);
            if (idx >= 0) {
                v = '[reference to sibling array --> ' + linkrefpath[idx] + ', length = ' + v.length + ']';
            } else {
                cycleref.push(v);
                cyclerefpath.push(path.join('.'));
                linkref.push(v);
                linkrefpath.push(path.join('.'));

                v = treat_error_infos_array(v);

                cycleref.pop();
                cyclerefpath.pop();
            }
        }
    } else if (v) {
        v = treat_object(v);
    }
    return v;
}

function treat_error_infos_array(arr) {
    var inf = arr.slice();
    trim_array_tail(inf);
    for (var key = 0, len = inf.length; key < len; key++) {
        var err = inf[key];
        if (err) {
            path.push('[' + key + ']');

            err = treat_object(err);

            if (typeof err === 'object') {
                if (err.lexer) {
                    err.lexer = '[lexer]';
                }
                if (err.parser) {
                    err.parser = '[parser]';
                }
                trim_array_tail(err.symbol_stack);
                trim_array_tail(err.state_stack);
                trim_array_tail(err.location_stack);
                if (err.value_stack) {
                    path.push('value_stack');
                    err.value_stack = treat_value_stack(err.value_stack);
                    path.pop();
                }
            }

            inf[key] = err;

            path.pop();
        }
    }
    return inf;
}

function treat_lexer(l) {
    // shallow copy object:
    l = shallow_copy(l);
    delete l.simpleCaseActionClusters;
    delete l.rules;
    delete l.conditions;
    delete l.__currentRuleSet__;

    if (l.__error_infos) {
        path.push('__error_infos');
        l.__error_infos = treat_value_stack(l.__error_infos);
        path.pop();
    }

    return l;
}

function treat_parser(p) {
    // shallow copy object:
    p = shallow_copy(p);
    delete p.productions_;
    delete p.table;
    delete p.defaultActions;

    if (p.__error_infos) {
        path.push('__error_infos');
        p.__error_infos = treat_value_stack(p.__error_infos);
        path.pop();
    }

    if (p.__error_recovery_infos) {
        path.push('__error_recovery_infos');
        p.__error_recovery_infos = treat_value_stack(p.__error_recovery_infos);
        path.pop();
    }

    if (p.lexer) {
        path.push('lexer');
        p.lexer = treat_lexer(p.lexer);
        path.pop();
    }

    return p;
}

function treat_hash(h) {
    // shallow copy object:
    h = shallow_copy(h);

    if (h.parser) {
        path.push('parser');
        h.parser = treat_parser(h.parser);
        path.pop();
    }

    if (h.lexer) {
        path.push('lexer');
        h.lexer = treat_lexer(h.lexer);
        path.push();
    }

    return h;
}

function treat_error_report_info(e) {
    // shallow copy object:
    e = shallow_copy(e);
    
    if (e && e.hash) {
        path.push('hash');
        e.hash = treat_hash(e.hash);
        path.pop();
    }

    if (e.parser) {
        path.push('parser');
        e.parser = treat_parser(e.parser);
        path.pop();
    }

    if (e.lexer) {
        path.push('lexer');
        e.lexer = treat_lexer(e.lexer);
        path.pop();
    }    

    if (e.__error_infos) {
        path.push('__error_infos');
        e.__error_infos = treat_value_stack(e.__error_infos);
        path.pop();
    }

    if (e.__error_recovery_infos) {
        path.push('__error_recovery_infos');
        e.__error_recovery_infos = treat_value_stack(e.__error_recovery_infos);
        path.pop();
    }

    trim_array_tail(e.symbol_stack);
    trim_array_tail(e.state_stack);
    trim_array_tail(e.location_stack);
    if (e.value_stack) {
        path.push('value_stack');
        e.value_stack = treat_value_stack(e.value_stack);
        path.pop();
    }

    return e;
}

function treat_object(e) {
    if (e && typeof e === 'object') {
        var idx = cycleref.indexOf(e);
        if (idx >= 0) {
            // cyclic reference, most probably an error instance.
            // we still want it to be READABLE in a way, though:
            e = shallow_copy_and_strip_depth(e, cyclerefpath[idx]);
        } else {
            idx = linkref.indexOf(e);
            if (idx >= 0) {
                e = '[reference to sibling --> ' + linkrefpath[idx] + ']';
            } else {
                cycleref.push(e);
                cyclerefpath.push(path.join('.'));
                linkref.push(e);
                linkrefpath.push(path.join('.'));

                e = treat_error_report_info(e);
                
                cycleref.pop();
                cyclerefpath.pop();
            }
        }
    }
    return e;
}


// strip off large chunks from the Error exception object before
// it will be fed to a test log or other output.
// 
// Internal use in the unit test rigs.
export default function trimErrorForTestReporting(e) {
    cycleref.length = 0;
    cyclerefpath.length = 0;
    linkref.length = 0;
    linkrefpath.length = 0;
    path = ['*'];

    if (e) {
        e = treat_object(e);
    }

    cycleref.length = 0;
    cyclerefpath.length = 0;
    linkref.length = 0;
    linkrefpath.length = 0;
    path = ['*'];

    return e;
}
