(function ($) {

var Jison = require('jison'),
    bnf = require('jison/bnf');

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
        $.get("/jison/examples/"+file, function (data) {
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

    $("#out").removeClass("good").removeClass("bad").html('');
    $("#gen_out").removeClass("good").removeClass("bad");
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
        if (!r.bydefault) return;
        $("#gen_out").append(r.msg+"\n"+"("+r.s+", "+r.r+") -> "+r.action);
    });

    parser2 = parser.createParser();
}

function runParser () {
    if (!parser) processGrammer();
    printOut("Parsing...");
    var source = $("#source").val();
    try {
        $("#out").removeClass("bad").addClass('good');
        printOut(JSON.stringify(parser2.parse(source)));
    } catch(e) {
        $("#out").removeClass("good").addClass('bad');
        printOut(e.message || e);
    }
}

})(jQuery);

