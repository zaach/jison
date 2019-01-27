//
// title: test %code section declarations
//
// ...
//

%code section %{ x; %}
%code imports %{
  import JSON5 from '@gerhobbelt/json5';

  import helpers from '../helpers-lib';
%}
%%
. //

