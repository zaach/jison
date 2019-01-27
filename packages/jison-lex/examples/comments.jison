// title: Simple lexer example - a lexer spec without any errors
// test_input: /*a*//*b*///c
// ...
//  


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
        yytext = getTypes(yytext.substring(2, yyleng));
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
        yytext = getTypes(yytext.substring(2, yyleng));
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
        yytext = getTypes(yytext.substring(2, yyleng));
        return 'inlineCommentType';
    %}


([A-Za-z0-9 .,?;]+) return 'string';
([ ]) return 'string';
{lineEnd} return 'string';
(.) return 'string';
<<EOF>> return 'eof';

