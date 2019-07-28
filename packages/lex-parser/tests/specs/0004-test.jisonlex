
//
// title: test escaped chars
//
// ...
//

%%
"\n"+ {return 'NL';}
\n+ {return 'NL2';}
"\\n"+ {return 'NL3';}
`
`+ {return 'NL4';}
\s+ {/* skip */}

