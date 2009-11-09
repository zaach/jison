// Basic set operations

// For IE/JScript
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(fun /*, thisp*/) {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this)
        fun.call(thisp, this[i], i, this);
    }
  };
}
if(!Array.prototype.indexOf){
  Array.prototype.indexOf = function(obj){
   for(var i=0; i<this.length; i++){
    if(this[i]==obj){
     return i;
    }
   }
   return -1;
  }
}

if (!Array.prototype.every) {
  Array.prototype.every = function(fun /*, thisp*/) {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this &&
          !fun.call(thisp, this[i], i, this))
        return false;
    }

    return true;
  };
}
if (!Array.prototype.some) {
  Array.prototype.some = function(fun /*, thisp*/) {
    var i = 0,
        len = this.length >>> 0;

    if (typeof fun != "function")
      throw new TypeError();

    var thisp = arguments[1];
    for (; i < len; i++)
    {
      if (i in this &&
          fun.call(thisp, this[i], i, this))
        return true;
    }

    return false;
  };
}
if (!Array.prototype.filter) {
  Array.prototype.filter = function(fun /*, thisp*/) {
    var len = this.length >>> 0;
    if (typeof fun != "function")
      throw new TypeError();

    var res = new Array();
    var thisp = arguments[1];
    for (var i = 0; i < len; i++)
    {
      if (i in this)
      {
        var val = this[i]; // in case fun mutates this
        if (fun.call(thisp, val, i, this))
          res.push(val);
      }
    }

    return res;
  };
}

function Set(set, raw) {
  if(set && set.constructor === Array)
    this._items = set && (raw ? set : set.slice(0)) || [];
  else 
    this._items = [].slice.call(arguments,0);

  var that = this;

  this.length = {toValue: function(){return that.size(); }};
}
  Set.prototype = {
    concat : function (setB){
               return [].push.apply(this._items, setB._items), this; 
             },
    eq : function (set){
            return this.size() === set.size() && this.subset(set); 
          },
    indexOf : function (item){
            if(item && item.eq) {
              for(var k=0; k<this._items.length;k++)
                if(item.eq(this._items[k]))
                  return k;
            }
            return this._items.indexOf(item);
          },
    union : function(set){
              return (new Set(this._items)).concat(this.complement(set));
            },
    intersection : function(set){
              return this.filter(function(elm){
                return set.contains(elm);
              });
            },
    complement : function(set){
              var that = this;
              return set.filter(function(elm){
                return !that.contains(elm);
              });
            },
    subset : function(set){
              return this.every(function(elm){
                return set.contains(elm);
              });
            },
    superset : function(set){
              return set.subset(this);
            },
    joinSet : function(set){
              return this.concat(this.complement(set));
            },
    contains : function (item){ return this.indexOf(item) !== -1; },
    item : function (v, val){ return this._items[v]; },
    i : function (v, val){ return this._items[v]; },
    first : function (){ return this._items[0]; },
    last : function (){ return this._items[this._items.length-1]; },
    size : function (){ return this._items.length; },
    isEmpty : function (){ return this._items.length === 0; },
    copy : function (){ return new Set(this._items); },
    toString : function (){ return this._items.toString(); }
  };

    "push shift forEach some every join".split(' ').forEach(function(e,i){
        Set.prototype[e] = function(){ return Array.prototype[e].apply(this._items, arguments); };
    });
    "filter slice".split(' ').forEach(function(e,i){
        Set.prototype[e] = function(){ return new Set(Array.prototype[e].apply(this._items, arguments), true); };
    });


