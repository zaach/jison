ArgParser = function(options, parserOpts) {  
  parserOpts = parserOpts || {};
  this.print = parserOpts.printFunc || this.print;
  this.script = parserOpts.script;
  this.printHelp = parserOpts.printHelp;
  if(this.printHelp == undefined)
    this.printHelp = true;

  var opts = options || [];
  if(opts.length == undefined) {
    // options is a hash not an array
    opts = [];
    for(var name in options) {
      var option = options[name];
      option.name = name;
      opts.push(option);
    }
  }
  this.options = opts.map(function(opt) {
    return new Option(opt);
  });
}

ArgParser.prototype = {
  print : function(str) {
    require("sys").puts(str);
    process.exit(0);
  },
  
  option : function(arg) {
    var match = new Option({});
    this.options.forEach(function(option) {
      if(option.matches(arg))
        match = option;
    });
    return match;
  },
  
  optName : function(arg) {
    var option = this.option(arg);
    return this.option(arg).name || arg;
  },
  
  "default" : function(arg) {
    return this.option(arg)["default"] || true;
  },
  
  expectsValue : function(arg) {
    return this.option(arg).expectsValue();
  },
  
  parse : function(args) {
    args = args || process.argv.slice(2);

    if(this.printHelp && (args.indexOf("--help") != -1
         || args.indexOf("-h") != -1))
      this.print(this.helpString());
  
    var ret = {};
    this.options.forEach(function(option) {
      ret[option.name] = option["default"];
    }, this);
    
    args = args.concat([""]).map(function(arg) {
      return new Arg(arg);
    });
    var positionals = [];
    var that = this;
    
    args.reduce(function(arg, val) {
      /* word */
      if(arg.isValue()) {
        positionals.push(arg.value);
      }
      /* -c */
      else if(arg.chars) {
        /* -cfv */
        (arg.chars).forEach(function(ch) {
          ret[this.optName(ch)] = this["default"](ch);
        }, that);
        /* -c 3 */
        if(val.isValue()) {
          if(that.expectsValue(arg.lastChar)) {
            ret[that.optName(arg.lastChar)] = val.value;
            return new Arg(""); // skip next turn - swallow arg
          }
        }
      }
      /* --config=tests.json */
      else if(arg.lg) {
        var value = arg.value;
        /* --debug */
        if(value == undefined)
          value = that["default"](arg.lg)
        ret[that.optName(arg.lg)] = value;
      }
      return val;
    });

    positionals.forEach(function(pos, index) {
      ret[this.optName(index)] = pos;
    }, this);

    return ret;
  },
  
  helpString : function() {
    var str = "usage: " + (this.script || "<script>");

    var positionals = this.options.filter(function(opt) {
      return opt.position != undefined;
    }).sort(function(opt1, opt2) {
      return opt1.position > opt2.position;
    });
    // assume there are no gaps in the specified pos. args
    positionals.forEach(function(pos) {
      str += " <" + (pos.name || "arg" + pos.position) + ">"; 
    });
    str += " [options]\n\n";

    positionals.forEach(function(pos) {
      str += pos.name + "\t" + (pos.help || "") + "\n"; 
    });
    str += "\noptions:\n"
    
    this.options.forEach(function(option) {
      if(option.position == undefined)
        str += option.string + "\t" + (option.help || "") + "\n";
    });
    return str;
  }
}

Option = function(opt) {
  this.string = opt.string || (opt.name ? "--" + opt.name : "");
  var matches = /^(?:\-(\w+?)(?:\s+([^-][^\s]*))?)?\,?\s*(?:\-\-(.+?)(?:=(.+))?)?$/
                .exec(this.string);
  this.sh = matches[1];
  this.metavar = matches[2] || matches[4]
  this.lg = matches[3];

  this.name = opt.name || this.lg || this.sh;
  this["default"] = opt["default"];
  this.help = opt.help;
  this.position = opt.position;
}

Option.prototype = {
  matches : function(arg) {
    return this.lg == arg || this.sh == arg || this.position == arg;
  },
  
  expectsValue : function() {
    return this.metavar || this["default"];
  }
}

Arg = function(str) {
  // "-l", "log.txt", or "--logfile=log.txt"
  this.str = str;
}

Arg.prototype = {
  shRegex : /^\-(\w+?)$/,

  lgRegex : /^\-\-(.+?)(?:=(.+))?$/,
  
  valRegex : /^[^\-]/,
  
  get chars() {
    var matches = this.shRegex.exec(this.str);
    return matches && matches[1].split("");
  },

  get value() {
    if(this.str) {
      var val = this.valRegex.test(this.str) ? this.str
                  : this.lgRegex.exec(this.str)[2];
      try { // try to infer type by JSON parsing the string
        val = JSON.parse(val)
      } catch(e) {}
      return val;
    }
  },
  
  get lg() {
    var matches = this.lgRegex.exec(this.str);
    return matches && matches[1];
  },

  get lastChar() {
    return this.str[this.str.length - 1];
  },

  isValue : function() {
    return this.str && this.valRegex.test(this.str);
  }
}

exports.ArgParser = ArgParser;
exports.parseArgs = function(opts, parserOpts, args) {
  return (new ArgParser(opts, parserOpts)).parse(args);
};
