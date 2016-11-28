# Jison Parser Php Port #
A jison wrapper that first processes a jison file and then injects a php template with the variables from a .js file. Written By: Robert Plummer, RobertLeePlummerJr@gmail.com  

## DIRECTIONS ##
1. After you've downloaded jison & node.js, navigate in command line interface to the folder that contains the ".jison" file that you want to process
2. Process the ".jison" file like this "nodejs /location_of_jison/ports/php/php.js my_jison_file.jison"

## CONFIGURATION ##
Configuration takes advantage of the commenting in javascript so as not to conflict with.

### In your ".jison" file ###
* A line that has a "//js" comment BEFORE the javascript line starts a javascript area of the parser section.  Which will be removed from the php.
* A line that simply has "//" ends whatever commenting is currently active.
* A that has a "//php" comment ON the line of php it starts a php area of the parser section.  In Javascript this is just a comment, in php though, the comment is removed so that it can be called.
* A line that has no comment, is left alone.

### Comments in the ".jison" file that start with "//option" can be used to configure the output of the php file. ###
* //option optionName:value
* Current Options:
  * "namespace" - default is "Jison"
  * "class" - default is your ".jison" file without the file extension
  * "fileName" - default is your ".jison" file without the file extension followed by ".php"

## EXAMPLE ##
```
contents
 : content
    {$$ = $1;} //<--this is left alone
 | contents content
	{
	    //js
		$$ = join($1, $2); //<--this is stripped in the php parser, no action taken in the javascript parser
		
		//php $$ = $SomeClass->someMethod($1, $2); //<-- this is uncommented from the php parser, no action taken in the javascript parser

		/*php
		    $$ = $SomeClass->someMethod($1, $2); //<-- this is uncommented from the php parser, no action taken in the javascript parser
		*/

        /* If you'd like to just strip out the javascript and do nothing else, you can do the following: */
		//js
		    $$ = join($1, $2); //<--this is stripped in the php parser, no action taken in the javascript parser
		//
	}
 ;
```
