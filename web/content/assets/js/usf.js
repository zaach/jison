var parser;
var parser2;

// IE, mainly
if (typeof console === 'undefined') {
  console = {};
  console.log = function (str) { 
    document.getElementById('out').value = uneval(str);
  };
}
var printOut = function (str) { 
  document.getElementById('out').value = JSON.stringify(str);
};

$(function () {
  $('#process_btn').click(processGrammar);
  $('#parse_btn').click(runParser);

  $('#examples').change(function (ev) {
    var file = this.options[this.selectedIndex].value;
    $(document.body).addClass('loading');
    var jison_uri = window.location.href.replace(/[^\/]+$/, '') + file;
    console.log('Going to load JISON file: ', jison_uri);
    $.get(jison_uri, function (data) {
      $('#grammar').val(data);
      $(document.body).removeClass('loading');
    });
  });
});

function processGrammar() {
  function onError(e) {
    console.log(e);
    $("#gen_out").text("Oops. Make sure your grammar is in the correct format.\n" + e.stack)
    .removeClass('good')
    .removeClass('warning')
    .addClass('bad');
  }
    
  var cfg;
  var type = $('#type')[0].options[$('#type')[0].selectedIndex].value || 'slr';

  var grammar = $('#grammar').val();
  try {
    cfg = JSON.parse(grammar);
  } catch(e) {
    try {
      cfg = Jison.ebnfParser.parse(grammar);
    } catch (e) {
      return onError(e);
    }
  }

  if (cfg.lex) {
    $('#parsing').show();
  }
  else {
    $('#parsing').hide();
  }

  Jison.print = function () {};
  parser = new Jison.Generator(cfg, {
    type: type,
    noDefaultResolve: true
  });
  if (parser.computeLookaheads) {
    parser.computeLookaheads();
  }

  $('#out').val('');
        
  $("#out").removeClass("good").removeClass("bad"); // .html('');
  $("#gen_out").removeClass("good").removeClass("bad").removeClass('warning');
  if (!parser.conflicts) {
    $("#gen_out").text('Generated successfully!').addClass('good');
  } else {
    $("#gen_out").text('Conflicts encountered:\n').addClass('bad');
  }

  nonterminalInfo(parser);
  productions(parser);

  if (type === 'll') {
    llTable(parser);
  }
  else {
    lrTable(parser);
  }

  var do_click = 0;
  var click_timer;

  // now that the table has been generated, add the click handlers:
  function click_handler(ev) {
    // delay 'click' action so dblclick gets a chance too.
    // (make sure 'this' remains accessible via closure)
    //
    // See also: 
    // http://stackoverflow.com/questions/6330431/jquery-bind-double-click-and-single-click-separately/7845282#7845282
    var self = $(this);

    do_click++;  // count clicks
    console.log("click_handler", ev, ", PREP: do_click = ", do_click);

    if (do_click === 1) {
        click_timer = setTimeout(function dblclick_delay() {
            // perform single-click action    
            console.log("click_handler", ev);
            if (!$(ev.target).is('a')) {
              self.toggleClass('open');
            }
            
            do_click = 0;             // after action has been performed, reset the counter
        }, 350);
    } else {
        clearTimeout(click_timer);    // prevent single-click action

        // perform double-click action: let the dblclick event handler handle this one...
        console.log("deferring to the dblclick_handler", ev);

        do_click = 0;                 // after action has been performed, reset the counter
    }
  }
  $(".action, .state").on("click", click_handler);

  function dblclick_handler(ev) {
    console.log("dblclick_handler", ev);
    do_click = 0;                     // after action has been performed, reset the counter
    var row = this.className.match(/(row_[0-9]+)/)[1];
    if ($(this).hasClass('open')) {
      $('.' + row).removeClass('open');
    }
    else {
      $('.' + row).addClass('open');
    }
    ev.preventDefault();              // cancel system double-click event
    return false;
  }
  $(".action, .state").on("dblclick", dblclick_handler);
}

function runParser() {
  if (!parser) {
    processGrammar();
  }
  if (!parser2) {
    parser2 = parser.createParser();
  }
  printOut('Parsing...');
  var source = $('#source').val();
  try {
    printOut(parser2.parse(source));
  } catch(e) {
    printOut(e.message || e);
  }
}

function nonterminalInfo(p) {
  var out = ['<h3>Nonterminals</h3><dl>'];
  for(var nt in p.nonterminals) {
    out.push('<dt>', nt, '</dt>');
    out.push('<dd>', 'nullable: ' + (p.nonterminals[nt].nullable ? 'Yes' : 'No') + '<br/>firsts: ' + p.nonterminals[nt].first + '<br/>follows: ' + p.nonterminals[nt].follows);
    out.push('<p>Productions: ');
    p.nonterminals[nt].productions.forEach(function (prod) {
      out.push('<a href="#prod_' + prod.id + '">' + prod.id + '</a>');
    });
    out.push('</p></dd>');
  }
  out.push('</dl>');
  $('#nonterminals').html(out.join('\n'));
}

function productions(p) {
  var out = ['<ol start="0">'];
  p.productions.forEach(function (prod) {
    out.push('<li id="prod_' + prod.id + '">', prod, '</li>');
  });
  out.push('</ol>');
  $('#productions').html('<h3>Productions</h3>' + out.join(''));
}


function printCell(cell) {
  var out = cell.join(',');

  out += '<div class="details">';
  for (var i = 0; i < cell.length; i++) {
    out += parser.productions[cell[i]] + '<br />';
  }
  out += '</div>';

  return out;
}

function llTable(p) {
  var out = ['<table border="1">', '<thead>', '<tr>'];
  out.push('<th>', '</th>');
  p.terminals.forEach(function (t) {
    out.push('<th>', t, '</th>');
  });
  out.push('</tr>', '</thead>');

  for (var nt in  p.table) {
    out.push('<tr><td>', nt, '</td>');
    p.terminals.forEach(function (t) {
      var cell = p.table[nt][t];
      if(cell) {
        out.push('<td id="cell_' + nt + '_' + t + '" class="cell_' + nt + ' ' + (cell.length > 1 ? 'conflict' : '') + ' action">', printCell(cell), '</td>');
      }
      else {
        out.push('<td>&nbsp;</td>');
      }
    });
    out.push('</tr>');
  }

  out.push('</table>');
  $('#table').html('<h3>LL(1) Parse Table</h3>' + out.join(''));
}

function printActionDetails(a, token) {
  var out = '<div class="details">';
  if (!a || !a[0]) return '';

  if (a[0] instanceof Array) {
    a.forEach(function (ar) { 
      out += printActionDetails_(ar, token); 
    });
  } 
  else {
    out += printActionDetails_(a, token);
  }

  return out + '</div>';
}

function printActionDetails_(a, token) {
  var out = '';
  if (a[0] == 1) {
    var link = '<a href="#state_' + a[1] + '">Go to state ' + a[1] + '</a>';
    out += '- Shift ' + parser.symbols[token] + ' then ' + link + '<br />';
  }
  else if (a[0] == 2) {
    var text = '- Reduce by ' + a[1] + ') ' + parser.productions[a[1]];
    out += text + '<br />';
  }
  return out;
}

function printAction(a) {
  var actions = {
    1: 's', 
    2: 'r',
    3: 'a'
  };
  if (!a[0]) return '';
  var out = '',
    ary = [];

  if (a[0] instanceof Array) {
    for(var i = 0; i < a.length; i++) {
      ary.push('<span class="action_' + (actions[a[i][0]]) + '">' + (actions[a[i][0]]) + (a[i][1] || '') + '</span>');
    }
  } else {
    ary.push('<span class="action_' + (actions[a[0]]) + '">' + (actions[a[0]]) + (a[1] || '') + '</span>');
  }

  out += ary.join(',');

  return out;
}

function sym2int(sym) { 
  return parser.symbols_[sym]; 
}

function lrTable(p) {
  var actions = {
    1: 's', 
    2: 'r',
    3: 'a'
  };
  var gs = p.symbols.slice(0).sort();
  var out = ['<table border="1">', '<thead>', '<tr>'];
  out.push('<th>&#8595;states', '</th>');
  var ntout = [];
  //gs.shift();
  gs.forEach(function (t) {
    if (t === '$accept') return;
    if (p.nonterminals[t]) {
      ntout.push('<th class="nonterm nt-' + t + '">', t, '</th>');
    }
    else if (t !== 'error' || p.hasErrorRecovery || 1) {
      out.push('<th>', t, '</th>');
    }
  });
  out.push.apply(out, ntout);
  out.push('</tr>', '</thead>');

  for (var i = 0, state; i < p.table.length; i++) {
    state = p.table[i];
    if (!state) continue;
    ntout = [];
    out.push('<tr><td class="row_' + i + ' state" id="state_' + i + '">', i, '<div class="details">');
    parser.states.item(i).forEach(function (item, k) {
      out.push(item, '<br />');
    });
    out.push('</div></td>');
    gs.forEach(function (ts) {
      if (ts === '$accept') return;
      if (ts === 'error' && !p.hasErrorRecovery && 0) {
        return;
      }
      var t = sym2int(ts);

      if (p.nonterminals[ts]) {
        if (typeof state[t] === 'number') {
          ntout.push('<td class="nonterm nt-' + t + '"><a href="#state_' + state[t] + '">', state[t], '</a></td>');
        }
        else {
          ntout.push('<td class="nonterm">&nbsp;</td>');
        }
      } else if (state[t]) {
        out.push('<td id="act-' + i + '-' + t + '" class="row_' + i + ' ' + (state[t] === 3 ? 'accept' : '') + ' action">', printAction(state[t]), printActionDetails(state[t], t));
      } else {
        out.push('<td id="act-' + i + '-' + t + '">&nbsp;</td>');
      }
    });
    out.push.apply(out, ntout);
    out.push('</tr>');
  }

  out.push('</table>');

  $('#table').html('<h3>' + parser.type + ' Parse Table</h3><p>Click cells to show details (double-click to show details for the entire row of cells)</p>' + out.join(''));

  p.resolutions.forEach(function (res) {
    var r = res[2];
    var el = document.getElementById('act-' + res[0] + '-' + p.symbols_[res[1]]);
    if (r.bydefault) {
      el.className += ' conflict';
    }
    el.title += r.msg + '\n' + '(' + r.s + ', ' + r.r + ') -> ' + r.action;
  });
}

