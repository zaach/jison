(function ($) {

var worker = new Worker('../assets/js/worker.js');

var parser,
    parser2;

//IE, mainly
if (typeof console === 'undefined') {
    console = {};
    console.log = function (str) {
        $("#out").text(uneval(str));
    };
}
// noop
print = function () {};

var printOut = function (str) {
    $("#out").text(str);
};

function debounce(timeout, fn) {
    var timer;

    return function() {
        clearTimeout(timer);

        timer = setTimeout(function() {
            fn();
            timer = null;
        }, timeout);
    };
}

$(document).ready(function () {
    //$("#process_btn").click(processGrammar);
    $("#parse_btn").click(runParser);

    $("#examples").change(function(ev) {
        var file = this.options[this.selectedIndex].value;
        $(document.body).addClass("loading");
        $.get(file, function (data) {
                $("#grammar").val(data);
                $(document.body).removeClass("loading");
                processGrammar();
            });
    });
    
    // recompile the grammar using a web worker,
    // as the user types
    var onChange = debounce(700, processGrammar);
    $('#grammar').bind('input propertychange', onChange);
    processGrammar();
});

function processGrammar() {
    function onError(e) {
        console.log(e);
        $("#gen_out").text("Oops. Make sure your grammar is in the correct format.\n" + e.stack)
        .removeClass('good')
        .removeClass('warning')
        .addClass('bad');
    }
    
    function onSuccess(result) {
        try {
            parser = Jison.Generator(result.cfg, {type: result.type});
        } catch (e) {
            return onError(e);
        }
        
        $("#out").removeClass("good").removeClass("bad").html('');
        $("#gen_out").removeClass("good").removeClass("bad").removeClass('warning');
        if (!parser.conflicts) {
        $("#gen_out").text('Generated successfully!').addClass('good');
        } else {
        $("#gen_out").text('Conflicts encountered:\n').addClass('bad');
        }

        $("#download_btn").click(function () {
            window.location.href = "data:application/javascript;charset=utf-8;base64," + Base64.encode(parser.generate());
        }).removeAttr('disabled');

        parser.resolutions.forEach(function (res) {
            var r = res[2];
            if (!r.bydefault) return;
            $("#gen_out").append(r.msg + "\n" + "(" + r.s + ", " + r.r + ") -> " + r.action);
        });

        parser2 = parser.createParser();
    }    
    
    // for newer browsers
    function callWorker(grammar) {
        worker.addEventListener('error', onError);
        worker.addEventListener('message', function(e) {
            onSuccess(e.data.result);
        });

        // ask the web worker to parse the grammar for us    
        worker.postMessage(grammar);
    }
    
    // for older browsers (IE <=9, Android <=4.3)
    function callNonWorker(grammar) {
        Jison.print = function () {};
        var cfg;

        try {
            cfg = JSON.parse(grammar);
        } catch (e) {
            try { 
                cfg = bnf.parse(grammar);
            } catch (e) {
                return onError(e);
            }
        }
        
        onSuccess({cfg: cfg, type: 'lalr'});
    }
    
    $("#gen_out").html("Parsing...")
    .removeClass('good')
    .removeClass('bad')
    .addClass('warning');
    $('#download_btn').attr('disabled', true);
      
    var grammar = $("#grammar").val();
      
    if (typeof Worker !== 'undefined') {
        callWorker(grammar);
    } else {
        callNonWorker(grammar);
    }
}

function runParser() {
    if (!parser) {
        processGrammar();
    }
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

