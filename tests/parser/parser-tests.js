exports.testLR0 = require("./lr0");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
