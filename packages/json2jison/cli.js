#!/usr/bin/env node

// Converts json grammar format to Jison grammar format

var version = require('./package.json').version;

var path = require('path');
var fs = require('fs');

var json2jison = require('./json2jison');



var opts = require('@gerhobbelt/nomnom')
  .unknownOptionTreatment(false)              // do not accept unknown options!
  .script('json2jison')
  .option('file', {
    flag: true,
    position: 0,
    help: 'file containing a grammar in JSON format'
  })
  .option('outfile', {
    abbr: 'o',
    metavar: 'FILE',
    help: 'Filename and base module name of the generated jison grammar file'
  })
  .option('version', {
    abbr: 'V',
    flag: true,
    help: 'print version and exit',
    callback: function() {
       return version;
    }
  });


exports.main = function main (opts) {
    if (opts.file) {
        var raw = fs.readFileSync(path.normalize(opts.file), 'utf8');
	      var outpath = (opts.outfile || opts.file);
    	  var name = path.basename(outpath).replace(/\..*$/g, '');
    	  outpath = path.dirname(outpath);

        var outfile = path.resolve(outpath, name + '.jison');
        console.log('RAW:', raw);
        fs.writeFileSync(outfile, json2jison.convert(raw), 'utf8');
        console.log(`JISON grammar has been written to file "${outfile}"`);
    } else {
        input(function (raw) {
            console.log(json2jison.convert(raw));
        });
    }
};


function input (cb) {
    var stdin = process.openStdin(),
        data = '';

    stdin.setEncoding('utf8');
    stdin.addListener('data', function (chunk) {
        data += chunk;
    });
    stdin.addListener('end', function () {
        cb(data);
    });
}



if (require.main === module) {
    exports.main(opts.parse());
}

