/*
 * Introduce a typal object to make classical/prototypal patterns easier
 * plus mixins and AOP sugar
 * */

var typal = (function () {

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

function typal_mix() {
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
    // extend object with own typalperties of each argument
    mix: typal_mix,
    // sugar for object begetting and mixing
    // - Object.create(typal).mix(etc, etc);
    // + typal.beget(etc, etc);
    beget: function typal_new() {
        return typal_mix.apply(Object.create(this), arguments);
    },
    // Creates a new Class constructor typald on an object with a constructor method
    construct: function typal_new() {
        var Klass = function(){ return this.constructor.apply(this, arguments); };
        var o = typal_mix.apply(Object.create(this), arguments);
        Klass.prototype = o;
        Klass.prototype.typal = o; // reference to "super"
        return Klass;
    },
    constructor: function typal_constructor() {return this;}
};
})();

if (typeof exports !== 'undefined')
    exports.typal = typal;
