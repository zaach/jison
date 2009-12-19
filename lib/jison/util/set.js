// Set class to wrap arrays

if (typeof require !== 'undefined')
    var typal = require("./typal").typal;

var setMixin = {
    constructor: function (set, raw) {
        this._items = [];
        if (set && set.constructor === Array)
            this._items = raw ? set: set.slice(0);
        else if(arguments.length)
            this._items = [].slice.call(arguments,0);
    },
    concat: function (setB) {
        this._items.push.apply(this._items, setB._items || setB); 
        return this; 
    },
    eq: function (set) {
        return this.size() === set.size() && this.subset(set); 
    },
    indexOf: function (item) {
        if(item && item.eq) {
            for(var k=0; k<this._items.length;k++)
                if(item.eq(this._items[k]))
                    return k;
        }
        return this._items.indexOf(item);
    },
    union: function (set) {
        return (new Set(this._items)).concat(this.complement(set));
    },
    intersection: function (set) {
    return this.filter(function (elm) {
            return set.contains(elm);
        });
    },
    complement: function (set) {
        var that = this;
        return set.filter(function (elm) {
            return !that.contains(elm);
        });
    },
    subset: function (set) {
        return this.every(function (elm) {
            return set.contains(elm);
        });
    },
    superset: function (set) {
        return set.subset(this);
    },
    joinSet: function (set) {
        return this.concat(this.complement(set));
    },
    contains: function (item) { return this.indexOf(item) !== -1; },
    item: function (v, val) { return this._items[v]; },
    i: function (v, val) { return this._items[v]; },
    first: function () { return this._items[0]; },
    last: function () { return this._items[this._items.length-1]; },
    size: function () { return this._items.length; },
    isEmpty: function () { return this._items.length === 0; },
    copy: function () { return new Set(this._items); },
    toString: function () { return this._items.toString(); }
};

"push shift unshift forEach some every join".split(' ').forEach(function (e,i) {
    setMixin[e] = function () { return Array.prototype[e].apply(this._items, arguments); };
});
"filter slice map".split(' ').forEach(function (e,i) {
    setMixin[e] = function () { return new Set(Array.prototype[e].apply(this._items, arguments), true); };
});

var Set = typal.construct(setMixin).mix({
    union: function (a, b) {
        return new Set(a).union(b);
    }
});

if (typeof exports !== 'undefined')
    exports.Set = Set;

