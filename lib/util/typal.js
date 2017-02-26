/*
 * Introduces a typal object to make classical/prototypal patterns easier
 * Plus some AOP sugar
 *
 * By Zachary Carter <zach@carter.name>
 * MIT Licensed
 * */

var typal = (function () {
'use strict';

var create = Object.create || function (o) { 
    function F(){} 
    F.prototype = o; 
    return new F(); 
};
var position = /^(before|after)/;

// basic method layering
// always returns original method's return value
function layerMethod(pos, key, prop, fun) {
    if (pos === 'after') {
        return function () {
            var ret = prop.apply(this, arguments);
            var args = [].slice.call(arguments);
            args.splice(0, 0, ret);
            fun.apply(this, args);
            return ret;
        };
    } else if (pos === 'before') {
        return function () {
            fun.apply(this, arguments);
            var ret = prop.apply(this, arguments);
            return ret;
        };
    }
    return fun;
}

// mixes each argument's own properties into calling object,
// overwriting them or layering them. i.e. an object method 'meth' is
// layered by mixin methods 'beforemeth' or 'aftermeth'
function typal_mix() {
    var self = this;
    var i, o, k;
    for (i = 0; i < arguments.length; i++) {
        o = arguments[i];
        if (!o) continue;
        if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
            this.constructor = o.constructor;
        }
        if (Object.prototype.hasOwnProperty.call(o, 'toString')) {
            this.toString = o.toString;
        }
        for (k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                var match = k.match(position);
                var key = k.replace(position, '');
                if (match && typeof this[key] === 'function') {
                    this[key] = layerMethod(match[0], key, this[key], o[k]);
                } else {
                    this[k] = o[k];
                }
            }
        }
    }
    return this;
}

// Same as typal_mix but also camelCases every object member and 'standardizes' the key set of every input
// argument through a caLLback function.
// 
// This is useful for processing options with dashes in their key, e.g. `token-stack` --> tokenStack.
function typal_camel_mix(cb) {
    var self = this;
    var i, o, k;

    // Convert dashed option keys to Camel Case, e.g. `camelCase('camels-have-one-hump')` => `'camelsHaveOneHump'` 
    function camelCase(s) {
        return s.replace(/-\w/g, function (match) { 
            return match.charAt(1).toUpperCase(); 
        });
    }

    // Convert first character to lowercase
    function lcase0(s) {
        return s.replace(/^\w/, function (match) { 
            return match.toLowerCase(); 
        });
    }

    for (i = 1; i < arguments.length; i++) {
        o = arguments[i];
        if (!o) continue;
        if (Object.prototype.hasOwnProperty.call(o, 'constructor')) {
            this.constructor = o.constructor;
        }
        if (Object.prototype.hasOwnProperty.call(o, 'toString')) {
            this.toString = o.toString;
        }
        if (cb) {
            o = cb(o);
        }
        for (k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) {
                var nk = camelCase(k);
                var match = k.match(position);
                var key = k.replace(position, '');
                // This anticipates before/after members to be camelcased already, e.g.
                // 'afterParse()' for layering 'parse()': 
                var alt_key = lcase0(key);
                if (match && typeof this[key] === 'function') {
                    this[key] = layerMethod(match[0], key, this[key], o[k]);
                }
                else if (match && typeof this[alt_key] === 'function') {
                    this[alt_key] = layerMethod(match[0], alt_key, this[alt_key], o[k]);
                } else {
                    this[nk] = o[k];
                }
            }
        }
    }
    return this;
}

return {
    // extend object with own properties of each argument
    mix: typal_mix,

    camelMix: typal_camel_mix,

    // sugar for object begetting and mixing
    // - Object.create(typal).mix(etc, etc);
    // + typal.beget(etc, etc);
    beget: function typal_beget() {
        return arguments.length ? typal_mix.apply(create(this), arguments) : create(this);
    },

    // Creates a new Class function based on an object with a constructor method
    construct: function typal_construct() {
        var o = typal_mix.apply(create(this), arguments);
        var constructor = o.constructor;
        var Klass = o.constructor = function () { return constructor.apply(this, arguments); };
        Klass.prototype = o;
        Klass.mix = typal_mix; // allow for easy singleton property extension
        return Klass;
    },

    // no op
    constructor: function typal_constructor() { return this; }
};

})();

if (typeof exports !== 'undefined')
    exports.typal = typal;
