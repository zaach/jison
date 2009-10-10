var assert = {passed:0,total:0};

assert.equal = function (expected, actual) {
  this.total++;
  if(expected == actual){
    this.passed++;
    return true;
  }
  throw new Error("ECMAScript assertion failed:  (" + expected + "!="+actual+")");
}

assert.equiv = function (expected, actual) {
  this.total++;
  if(expected === actual){
    this.passed++;
    return true;
  }
  throw new Error("ECMAScript assertion failed:  (" + expected + "!=="+actual+")");
}

assert.done = function(){
  print('assertions:',this.total,'passed:',this.passed);
}
