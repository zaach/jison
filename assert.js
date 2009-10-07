var assert = {};

assert.equal = function (expected, actual) {
  if(expected == actual){
    return true;
  }
  throw new Error("ECMAScript assertion failed:  (" + expected + "!="+actual+")");
}

assert.equiv = function (expected, actual) {
  if(expected === actual){
    return true;
  }
  throw new Error("ECMAScript assertion failed:  (" + expected + "!=="+actual+")");
}
