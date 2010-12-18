var IO = require("../lib/jison/util/io");

exports.bundle = function(modules) {
    var moduleDefs = [];
    
    for (var i = 0; i < modules.length; i++) {
        var baseID = modules[i].id;
        var path = modules[i].path;
        
        var requires = [];
        var text = IO.read(path).replace(/require\s*\(\s*["']([\/\.\w-]+)["']\s*\)/g, function(match, requireID) {
            if (/^\./.test(requireID)) {
                var newID = IO.resolve(baseID, requireID)
                //console.log("//replacing " + requireID + " in " + baseID + " with " + newID);
                requireID = newID;
            }
            requires.push(requireID);
            return "require("+JSON.stringify(requireID)+")";
        });
        
        moduleDefs.push("require.def("+JSON.stringify(baseID)+",{factory:function(require,exports,module){\n" + text + "\n//*/\n},requires:"+JSON.stringify(requires)+"})");
    }
    
    return "var require = (" + req + ")()\n" + moduleDefs.join(";\n\n") + ";";
}

var req = function() {
    var modules = {};
    var factories = {};
    var r = function(id) {
        if (!modules[id]) {
        console.log(id);
            modules[id] = {};
            factories[id](r, modules[id], { id : id });
        }
        return modules[id];
    };
    r.def = function(id, params) {
        console.log('def', id);
        factories[id] = params.factory;
    };
    return r;
}
