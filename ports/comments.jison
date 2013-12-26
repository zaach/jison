//A parser for extracting comments out of a string

//Lexical Grammer
%lex

lineEnd (\n\r|\r\n|[\n\r])
commentName ([a-zA-Z]+("|"|[a-zA-Z]+)*(?=[\s]*))
%s area commentBody inlineCommentBody

%%
<area>("//"\n)
    %{
        yytext = '';
        this.popState();
        return 'areaEnd';
    %}
<area>(?=("//"|"/*"))
    %{
        this.popState();
        return 'areaEnd';
    %}
<area>(.|{lineEnd})
    %{
        return 'areaString';
    %}
<area>(?=<<EOF>>)
    %{
        this.popState();
        return 'areaEnd';
    %}
("//"){commentName}(?={lineEnd})
    %{
        this.begin('area');
        yytext = getTypes(yytext.substring(2, yytext.length));
        return 'areaType';
    %}


<commentBody>("*/")
    %{
        this.popState();
        return 'commentEnd';
    %}
<commentBody>(.|{lineEnd})
    %{
        return 'bodyString';
    %}
("/*"){commentName}
    %{
        this.begin('commentBody');
        yytext = getTypes(yytext.substring(2, yytext.length));
        return 'commentType';
    %}


<inlineCommentBody>(.)
    %{
        return 'inlineBodyString';
    %}
<inlineCommentBody>(?={lineEnd})
    %{
        this.popState();
        return 'inlineCommentEnd';
    %}
<inlineCommentBody>(?=<<EOF>>)
    %{
        this.popState();
        return 'inlineCommentEnd';
    %}
"//"{commentName}
    %{
        this.begin('inlineCommentBody');
        yytext = getTypes(yytext.substring(2, yytext.length));
        return 'inlineCommentType';
    %}


([A-Za-z0-9 .,?;]+) return 'string';
([ ]) return 'string';
{lineEnd} return 'string';
(.) return 'string';
<<EOF>> return 'eof';

/lex

//Parsing Grammer
%%

file
    : contents
        {return $1;}
    | contents eof
        {return $1;}
    | eof
        {
            return "";
        }
    ;

contents
    : content
        {
            $$ = $1;
        }
    | contents content
        {
            $$ = $1 + $2;
        }
    ;

content
    : string
        {
            $$ = $1;
        }
    | comment
        {
            $$ = $1;
        }
    | inlineComment
        {
            $$ = $1;
        }
    | area
        {
            $$ = $1;
        }
    ;

comment
    : commentType commentEnd
        {
            $$ = $1 + $2;
        }
    | commentType commentBody commentEnd
        {
            $$ = convertToSyntax($1, $2);
        }
    ;

commentBody
    : bodyString
        {
            $$ = $1;
        }
    | commentBody bodyString
        {
            $$ = $1 + $2;
        }
    ;

inlineComment
    : inlineCommentType inlineCommentBody inlineCommentEnd
        {
            $$ = convertToSyntax($1, $2);
        }
    ;

inlineCommentBody
    : inlineBodyString
        {
            $$ = $1;
        }
    | inlineCommentBody inlineBodyString
        {
            $$ = $1 + $2;
        }
    ;

area
    : areaType areaEnd
        {
            $$ = convertToSyntax($1, $2);
        }
    | areaType areaBody areaEnd
        {
            $$ = convertToSyntax($1, $2 + $3);
        }
    ;
areaBody
    : areaString
        {
            $$ = $1;
        }
    | areaBody areaString
        {
            $$ = $1 + $2;
        }
    ;
%%

var getTypes = function (types) {
    types = types.split(',');
    var Types = {};
    for (var i in types) {
        Types[types[i]] = true;
    }
    return Types;
};