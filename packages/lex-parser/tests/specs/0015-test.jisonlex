//
// title: test multiline action with end marker plus illegal tail 1
//
// ...
//
// this tests the case where the desired end marker `%{` is **made to look like** another end marker: `%}}`.
// The tailing `}` is illegal in the grammar, hence would caught when occurring alone as well.
// 
// We check both in here.
//

%%
"["[^\]]"]" %{
return true;
%}}

