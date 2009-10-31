var JSParse = exports.JSParse = require("../parse").JSParse;

var QUnit = exports.QUnit = require("qunit").QUnit;

QUnit.log = function (r, msg){
  print('  ',r, msg);
};
QUnit.done = function (fails, total){
  print('failures:',fails,', total:', total);
};
QUnit.moduleStart = print;
QUnit.testStart = print;

