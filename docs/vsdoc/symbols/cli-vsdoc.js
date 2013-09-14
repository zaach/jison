
/* vsdoc for cli */

(function (window) {
    

    window.cli = {
        /// <summary></summary>
        /// <returns type="cli"/>
                
        main: function(opts, opts.file, opts.lexfile, opts.outfile, opts.json, opts.moduleName, opts.debug, opts['module-type'], opts['parser-type']) {
            /// <summary>Generates a parser and writes it to a file.</summary>
            /// <param name="opts" type="Object">Options object.</param>
            /// <param name="opts.file" type="String">Path to a file containing a grammar. If no file is specified input will be
            ///  read from stdin.</param>
            /// <param name="opts.lexfile" type="String">Path to a file containing a lexical grammar.</param>
            /// <param name="opts.outfile" type="String">The path and filename where the parser should be written to. Defaults to the
            ///  path and filename given for &lt;code&gt;file&lt;/code&gt; with the file extension
            ///  replaced by &lt;code&gt;js&lt;/code&gt;.</param>
            /// <param name="opts.json" type="Boolean">Set to true if `file` is in json format.</param>
            /// <param name="opts.moduleName" type="String">The internal name for your module in the generated parser.</param>
            /// <param name="opts.debug" type="Boolean">Debug mode.</param>
            /// <param name="opts['module-type']" type="String">The module type of the generated parser. Options are: &lt;code&gt;commonjs&lt;/code&gt;,
            ///  &lt;code&gt;amd&lt;/code&gt;, &lt;code&gt;and&lt;/code&gt; &lt;code&gt;js&lt;/code&gt;.</param>
            /// <param name="opts['parser-type']" type="String">The type of parser to generate. Options are: &lt;code&gt;lr0&lt;/code&gt;,
            ///  &lt;code&gt;slr&lt;/code&gt;, &lt;code&gt;lalr&lt;/code&gt;, and &lt;code&gt;lr&lt;/code&gt;.</param>
        }, 
        
        generateParserString: function(opts, opts.json, opts.moduleName, opts.debug, opts['parser-type'], opts['module-type'], grammar) {
            /// <summary>Generates a parser and returns it as a string.</summary>
            /// <param name="opts" type="Object">An options object.</param>
            /// <param name="opts.json" type="Boolean">See the description in {@link cli.main}</param>
            /// <param name="opts.moduleName" type="String">See the description in {@link cli.main}</param>
            /// <param name="opts.debug" type="Object">See the description in {@link cli.main}</param>
            /// <param name="opts['parser-type']" type="Object">See the description in {@link cli.main}</param>
            /// <param name="opts['module-type']" type="Object">See the description in {@link cli.main}</param>
            /// <param name="grammar" type="String|Object">The grammar to generate a parser from.</param>
            /// <returns type="String">Returns the generated parser as a string.</returns>
        }, 
        
        processGrammars: function(file, lexFile, jsonMode) {
            /// <summary>Processes grammar files of various format.</summary>
            /// <param name="file" type="String">Contents of a jison grammar file.</param>
            /// <param name="lexFile" type="String">Contents of a lexer grammar file.</param>
            /// <param name="jsonMode" type="Boolean">Set to true if &lt;code&gt;file&lt;/code&gt; is in
            ///  json format.</param>
            /// <returns type="Object">Returns the parsed grammar object.</returns>
        }, 
        
        cli_init: function() {
            /// <summary>Initialization function, grabs commandline arguments and passes them to
            ///  {@link cli.main} if this script was called from the commandline.</summary>
        }
        
    };

    var $x = window.cli;
    $x.__namespace = "true";
    $x.__typeName = "cli";
})(this);
