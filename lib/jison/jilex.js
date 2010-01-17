if (typeof require !== 'undefined') {
    var jilex = require("./util/lex-parser").parser;
    exports.parse = function parse () { return jilex.parse.apply(jilex, arguments) };
}

function encodeRE (s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'); }

jilex.yy = {
    prepareString: function (s) {
        s = encodeRE(s);
        return s;
    }
};
