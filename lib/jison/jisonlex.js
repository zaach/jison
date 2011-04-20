var jisonlex = require("./util/lex-parser").parser;

var parse_ = jisonlex.parse;
jisonlex.parse = exports.parse = function parse () {
    jisonlex.yy.ruleSection = false;
    return parse_.apply(jisonlex, arguments);
};

function encodeRE (s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1').replace(/\\\\u([a-fA-F0-9]{4})/g,'\\u$1'); }

jisonlex.yy = {
    prepareString: function (s) {
        // unescape slashes
        s = s.replace(/\\\\/g, "\\");
        s = encodeRE(s);
        return s;
    }
};
