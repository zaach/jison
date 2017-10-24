'use strict';

importScripts('jison.js');
Jison.print = function () {};

// request to parse a grammar
self.addEventListener('message', function (e) {
  if (typeof e.data !== 'string') {
    return;
  }
  
  var grammar = e.data;
  
  var cfg;
  
  try {
      cfg = JSON.parse(grammar);
  } catch (ex) {
      // intentionally throw an error here if it fails to parse
      cfg = bnf.parse(grammar);
  }
  
  self.postMessage({result: {cfg: cfg, type: "lalr"}});
});
