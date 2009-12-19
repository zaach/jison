if (typeof require !== 'undefined')
    var typal = require("./typal").typal;

// returns an array with some set methods

var setMixin = {
    constructor: function (set, raw) {
        var arry = [];
        if (set && set.constructor === Array && !set.init)
            arry = raw ? set : set.slice(0);
        else if(arguments.length)
            arry = [].slice.call(arguments,0);
        return typal.mix.call(arry, setMixin);
    },
    concat: function (setB){
               this.push.apply(this, setB._items || setB); 
               return this; 
             },
    eq: function (set){
            return this.size() === set.size() && this.subset(set); 
          },
    indexOf: function (item){
            if(item && item.eq) {
              for(var k=0; k<this.length;k++)
                if(item.eq(this[k]))
                  return k;
            }
            return [].indexOf.call(this, item);
          },
    union: function(set){
              return (new Set(this._items)).concat(this.complement(set));
            },
    intersection: function(set){
              return this.filter(function(elm){
                return set.contains(elm);
              });
            },
    complement: function(set){
              var that = this;
              return set.filter(function(elm){
                return !that.contains(elm);
              });
            },
    subset: function(set){
              return this.every(function(elm){
                return set.contains(elm);
              });
            },
    superset: function(set){
              return set.subset(this);
            },
    joinSet: function(set){
              return this.concat(this.complement(set));
            },
    contains: function (item){ return this.indexOf(item) !== -1; },
    item: function (v, val){ return this[v]; },
    i: function (v, val){ return this[v]; },
    first: function (){ return this[0]; },
    last: function (){ return this[this.length-1]; },
    size: function (){ return this.length; },
    isEmpty: function (){ return this.length === 0; },
    copy: function (){ return new Set(this); }
};

//"push shift unshift forEach some every join".split(' ').forEach(function(e,i){
    //Set.prototype[e] = function(){ return Array.prototype[e].apply(this, arguments); };
//});
//
"filter slice map".split(' ').forEach(function(e,i){
    setMixin[e] = function(){ return new Set(Array.prototype[e].apply(this, arguments), true); };
});

// create Set class
var Set = typal.construct(setMixin).mix({
    // Singleton method for union uperation
    union: function (a, b){
        return new Set(a).union(b);
    }
});

if (typeof exports !== 'undefined')
    exports.Set = Set;
