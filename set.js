// Basic set operations

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
            if(item.eq) {
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
