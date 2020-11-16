var jison = require('../');
var fs = require('fs');
var path = require('path');

const input = fs.readFileSync('./issue-58-gho.json', 'utf8');
//console.log('load:', input);
const grammar = JSON.parse(input);
const parser = new jison.Parser(grammar);
const source = parser.generate();
fs.mkdirSync('./output/issue-58-gho/', { recursive: true });
fs.writeFileSync('./output/issue-58-gho/code.output.js', source, 'utf8');
