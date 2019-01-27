// title: Simple lexer example - a lexer spec without any errors
// ...
//  



PLUGIN_ID                       [A-Z]+
INLINE_PLUGIN_ID                [a-z]+
SMILE                           [a-z]+

%s bold box center colortext italic header6 header5 header4 header3 header2 header1 link strikethrough table titlebar underscore wikilink

%%

"{"{INLINE_PLUGIN_ID}.*?"}"
    %{
        yytext = parserlib.inlinePlugin(yytext);
        return 'INLINE_PLUGIN';
    %}

"{"{PLUGIN_ID}"(".*?")}"
    %{
        yy.pluginStack = parserlib.stackPlugin(yytext, yy.pluginStack);

        if (parserlib.size(yy.pluginStack) == 1) {
            return 'PLUGIN_START';
        } else {
            return 'CONTENT';
        }
    %}

"{"{PLUGIN_ID}"}"
    %{
        if (yy.pluginStack) {
            if (
                parserlib.size(yy.pluginStack) > 0 &&
                parserlib.substring(yytext, 1, -1) == yy.pluginStack[parserlib.size(yy.pluginStack) - 1].name
            ) {
                if (parserlib.size(yy.pluginStack) == 1) {
                    yytext = yy.pluginStack[parserlib.size(yy.pluginStack) - 1];
                    yy.pluginStack = parserlib.pop(yy.pluginStack);
                    return 'PLUGIN_END';
                } else {
                    yy.pluginStack = parserlib.pop(yy.pluginStack);
                    return 'CONTENT';
                }
            }
        }
        return 'CONTENT';
    %}

("~np~")
    %{
        yy.npStack = parserlib.push(yy.npStack, true);
        this.yy.npOn = true;

        return 'NP_START';
    %}

("~/np~")
    %{
        this.yy.npStack = parserlib.pop(yy.npStack);
        if (parserlib.size(yy.npStack) < 1) yy.npOn = false;
        return 'NP_END';
    %}

"---"
    %{
        yytext = parserlib.hr();
        return 'HORIZONTAL_BAR';
    %}

"(:"{SMILE}":)"
    %{
        yytext = parserlib.substring(yytext, 2, -2);
        yytext = parserlib.smile(yytext);
        return 'SMILE';
    %}

"[[".*?
    %{
        yytext = parserlib.substring(yytext, 2, -1);
        return 'CONTENT';
    %}

<bold>[_][_]                %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'BOLD_END'); %}
[_][_]                      %{ this.begin('bold');          return parserlib.npState(this.yy.npOn, 'CONTENT', 'BOLD_START'); %}
<box>[\^]                   %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'BOX_END'); %}
[\^]                        %{ this.begin('box');           return parserlib.npState(this.yy.npOn, 'CONTENT', 'BOX_START'); %}
<center>[:][:]              %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'CENTER_END'); %}
[:][:]                      %{ this.begin('center');        return parserlib.npState(this.yy.npOn, 'CONTENT', 'CENTER_START'); %}
<colortext>[\~][\~]         %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'COLORTEXT_END'); %}
[\~][\~][#]                 %{ this.begin('colortext');     return parserlib.npState(this.yy.npOn, 'CONTENT', 'COLORTEXT_START'); %}
<header6>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER6_END'); %}
[\n]("!!!!!!")              %{ this.begin('header6');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER6_START'); %}
<header5>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER5_END'); %}
[\n]("!!!!!")               %{ this.begin('header5');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER5_START'); %}
<header4>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER4_END'); %}
[\n]("!!!!")                %{ this.begin('header4');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER4_START'); %}
<header3>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER3_END'); %}
[\n]("!!!")                 %{ this.begin('header3');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER3_START'); %}
<header2>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER2_END'); %}
[\n]("!!")                  %{ this.begin('header2');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER2_START'); %}
<header1>[\n]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER1_END'); %}
[\n]("!")                   %{ this.begin('header1');       return parserlib.npState(this.yy.npOn, 'CONTENT', 'HEADER1_START'); %}
<italic>['][']              %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'ITALIC_END'); %}
['][']                      %{ this.begin('italic');        return parserlib.npState(this.yy.npOn, 'CONTENT', 'ITALIC_START'); %}
<link>("]")                 %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'LINK_END'); %}
("[")                       %{ this.begin('link');          return parserlib.npState(this.yy.npOn, 'CONTENT', 'LINK_START'); %}
<strikethrough>[-][-]       %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'STRIKETHROUGH_END'); %}
[-][-]                      %{ this.begin('strikethrough'); return parserlib.npState(this.yy.npOn, 'CONTENT', 'STRIKETHROUGH_START'); %}
<table>[|][|]               %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'TABLE_END'); %}
[|][|]                      %{ this.begin('table');         return parserlib.npState(this.yy.npOn, 'CONTENT', 'TABLE_START'); %}
<titlebar>[=][-]            %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'TITLEBAR_END'); %}
[-][=]                      %{ this.begin('titlebar');      return parserlib.npState(this.yy.npOn, 'CONTENT', 'TITLEBAR_START'); %}
<underscore>[=][=][=]       %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'UNDERSCORE_END'); %}
[=][=][=]                   %{ this.begin('underscore');    return parserlib.npState(this.yy.npOn, 'CONTENT', 'UNDERSCORE_START'); %}
<wikilink>[)][)]            %{ this.popState();             return parserlib.npState(this.yy.npOn, 'CONTENT', 'WIKILINK_END'); %}
[(][(]                      %{ this.begin('wikilink');      return parserlib.npState(this.yy.npOn, 'CONTENT', 'WIKILINK_START'); %}

"<"(.|\n)*?">"                              return 'HTML'
(.)                                         return 'CONTENT'
(\n)
    %{
        if (parserlib.npState(this.yy.npOn, false, true) == true) {
            yytext = parserlib.formatContent(yytext);
        }

        return 'CONTENT';
    %}

<<EOF>>                                     return 'EOF'

