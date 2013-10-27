<?php
require_once 'filter.php';

$parser = new jison\filter();
$text = file_get_contents('example');
var_export($parser->parse($text));
echo "\n";