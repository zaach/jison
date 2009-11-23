exports.testRegExpLexer = require("./regexlex");

if (require.main === module.id)
    require("os").exit(require("test").run(exports)); 
