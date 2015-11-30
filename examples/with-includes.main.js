
parser.main = function (args) {
    if (!args[1]) {
      console.log('Usage: ' + args[0] + ' FILE');
      process.exit(1);
    }

    var tty = require('tty');
    if (tty.isatty(process.stdout.fd)) {
      console.log('not redirected');
    }
    else {
      console.log('redirected');
    }

    var input_chunks = [];

    function process_one_line(source) {
      try {
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2) + '\n');
      } catch (ex) {
        process.stdout.write("Parse error:\n" + JSON.stringify(ex, null, 2) + "\nfor input:\n" + source + '\n');
      }
    }

    function act() {
      // see if we got an entire line's worth from stdin already?
      var source = input_chunks.join("").split('\n');
      while (source.length > 1) {
        process_one_line(source[0]);
        source.shift();
      }
      input_chunks = source;
    }

    if (args[1] === '-') {
      // read from stdin, echo output to stdout
      process.stdin.setEncoding('utf8');

      process.stdin.on('readable', function() {
        var chunk = process.stdin.read();
        //console.log("chunk:", JSON.stringify(chunk, null, 2));
        if (chunk !== null) {
          input_chunks.push(chunk);
          act();
        }
      });

      process.stdin.on('end', function() {
        input_chunks.push('\n');
        act();
        process.exit(0);
      });      
    } else {
      try {
        var source = require('fs').readFileSync(require('path').normalize(args[1]), 'utf8');
        var rv = parser.parse(source);

        process.stdout.write(JSON.stringify(rv, null, 2));
        return +rv || 0;
      } catch (ex) {
        process.stdout.write("Parse error:\n" + JSON.stringify(ex, null, 2) + "\nfor input file:\n" + args[1]);
        return 66;
      }
    }
};

