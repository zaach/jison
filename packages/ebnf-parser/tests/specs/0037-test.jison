
// title: test options with string values which have embedded quotes
// 
// ...
// 

%options s1="s1\"val'ue" s2='s2\\x\'val"ue' s3="s3\"val\'ue" s4='s4\\x\'val\"ue' 
%% 
hello: world; 
%%

