(function ($) {

var parser,
    parser2;

//IE, mainly
if(typeof console === 'undefined'){
    console = {};
    console.log = function (str) {$("#out").html(uneval(str))};
}
// noop
print = function (){}

var printOut = function (str) { $("#out").html(str); };

$(document).ready(function () {
    $("#process_btn").click(processGrammar);
    $("#parse_btn").click(runParser);

    $("#examples").change(function(ev) {
        var file = this.options[this.selectedIndex].value;
        $(document.body).addClass("loading");
        $.get("/examples/"+file, function (data) {
                $("#grammar").val(data);
                $(document.body).removeClass("loading");
            });
    });

});

function processGrammar () {
    var type = "lalr";

    var grammar = $("#grammar").val();
    try {
        var cfg = JSON.parse(grammar);
    } catch(e) {
        try {
            var cfg = bnf.parse(grammar);
        } catch (e) {
            $("#gen_out").html("Oops. Make sure your grammar is in the correct format.\n"+e).addClass('bad');
            return;
        }
    }

    Jison.print = function () {};
    parser = new Jison.Generator(cfg, {type: type});

    $("#out").html('').removeClass("good, bad");
    if (!parser.conflicts) {
        $("#gen_out").html('Generated successfully!').addClass('good');
    } else {
        $("#gen_out").html('Conflicts encountered:<br/>').addClass('bad');
    }

    $("#download_btn").click(function () {
            window.location.href = "data:application/javascript;charset=utf-8;base64,"+Base64.encode(parser.generate());
        }).removeAttr('disabled');

    parser.resolutions.forEach(function (res) {
        var r = res[2];
        if (!r.bydefault) continue;
        $("#gen_out").append(r.msg+"\n"+"("+r.s+", "+r.r+") -> "+r.action);
    });
}

function runParser () {
    if (!parser) processGrammer();
    if (!parser2) parser2 = parser.createParser();
    printOut("Parsing...");
    var source = $("#source").val();
    try {
        $("#out").addClass('good');
        printOut(parser2.parse(source));
    } catch(e) {
        $("#out").addClass('bad');
        printOut(e.message || e);
    }
}

})(jQuery);

