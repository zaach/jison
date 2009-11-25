/*
 * A base object to make classical/prototypal patterns easier
 * plus mixins and AOP sugar
 * */

var $base = (function () {

var regex = /^(before|after)/;

function layerMethod(k, fun) {
    var pos = k.match(regex)[0],
        key = k.replace(regex, ''),
        prop = this[key];

    if (pos === 'after') {
        this[key] = function () { var ret = prop.apply(this, arguments); fun.apply(this, arguments); return ret;}
    } else if (pos === 'before') {
        this[key] = function () { fun.apply(this, arguments); var ret = prop.apply(this, arguments); return ret;}
    }
}

function base_mix() {
    var self = this;
    for(var i=0,o,k; i<arguments.length; i++) {
        o=arguments[i];
        for(k in o) {
            if ({}.hasOwnProperty.call(o, k)) {
                if(k.match(regex) && this[k.replace(regex, '')])
                    layerMethod.call(this, k, o[k]);
                else
                    this[k] = o[k];
            }
        }
    }
    return this;
}

return {
    // extend object with own properties of each argument
    mix: base_mix,
    // sugar for object begetting and mixing
    // - Object.create(base).mix(etc, etc);
    // + base.new(etc, etc);
    beget: function base_new() {
        return base_mix.apply(Object.create(this), arguments);
    },
    // Creates a new Class constructor based on an object with a constructor method
    construct: function base_new() {
        var Klass = function(){ return this.constructor.apply(this, arguments); };
        var o = base_mix.apply(Object.create(this), arguments);
        Klass.prototype = o;
        Klass.prototype.$base = o; // reference to "super"
        return Klass;
    },
    constructor: function base_constructor() {return this;}
};
})();

if (typeof exports !== 'undefined')
    exports.$base = $base;
