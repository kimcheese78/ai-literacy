// Progressive enhancements — the page reads fine without any of this.
(function () {
  'use strict';

  function data(id) {
    var el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  }

  // --- Glossary: expand/collapse all tiers ---
  var btn = document.getElementById('toggle-all-terms');
  if (btn) {
    btn.addEventListener('click', function () {
      var tiers = document.querySelectorAll('#glossary details.tier');
      var anyClosed = Array.prototype.some.call(tiers, function (d) { return !d.open; });
      tiers.forEach(function (d) { d.open = anyClosed; });
      btn.textContent = anyClosed ? 'Collapse all terms' : 'Expand all 3 tiers';
    });
  }

  // --- Anchor links into closed <details> should open them ---
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    var d = target.closest('details');
    while (d) { d.open = true; d = d.parentElement.closest('details'); }
  });

  // --- Next-word predictor ---
  (function () {
    var cfg = data('nw-data');
    var bars = document.getElementById('nw-bars');
    if (!cfg || !bars) return;
    var sentence = document.getElementById('nw-sentence');
    var done = document.getElementById('nw-done');
    var words = [];
    var step = 0;

    function renderSentence(withBlank) {
      sentence.innerHTML = '';
      sentence.appendChild(document.createTextNode(cfg.base + ' '));
      words.forEach(function (w) {
        var s = document.createElement('span');
        s.className = 'chosen';
        s.textContent = w;
        sentence.appendChild(s);
        sentence.appendChild(document.createTextNode(' '));
      });
      if (withBlank) {
        var b = document.createElement('span');
        b.className = 'nw-blank';
        b.setAttribute('aria-hidden', 'true');
        sentence.appendChild(b);
      } else {
        sentence.appendChild(document.createTextNode('.'));
      }
    }

    function renderBars() {
      bars.innerHTML = '';
      cfg.steps[step].forEach(function (pair) {
        var b = document.createElement('button');
        b.className = 'nw-bar';
        b.type = 'button';
        b.innerHTML =
          '<span class="word"></span><span class="track"><span class="fill" style="width:0%"></span></span><span class="pct">' +
          pair[1] + '%</span>';
        b.querySelector('.word').textContent = pair[0];
        b.addEventListener('click', function () { choose(pair[0]); });
        bars.appendChild(b);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { b.querySelector('.fill').style.width = pair[1] + '%'; });
        });
      });
    }

    function choose(word) {
      words.push(word);
      step += 1;
      if (step < cfg.steps.length) {
        renderSentence(true);
        renderBars();
      } else {
        renderSentence(false);
        bars.innerHTML = '';
        done.hidden = false;
        done.textContent = cfg.done + ' ';
        var r = document.createElement('button');
        r.type = 'button';
        r.textContent = cfg.reset;
        r.addEventListener('click', function () {
          words = []; step = 0; done.hidden = true; done.textContent = '';
          renderSentence(true); renderBars();
        });
        done.appendChild(r);
      }
    }

    renderSentence(true);
    renderBars();
  })();

  // --- Token chopper ---
  (function () {
    var examples = data('chop-data');
    var line = document.getElementById('chop-line');
    var next = document.getElementById('chop-next');
    if (!examples || !line || !next) return;
    var colors = ['#0f8a76', '#b45309', '#a13d63', '#5b5bd6'];
    var count = document.getElementById('chop-count');
    var i = 0;
    function show(ex) {
      line.innerHTML = '';
      ex.tokens.forEach(function (t, k) {
        var s = document.createElement('span');
        s.className = 'tk';
        s.style.setProperty('--tk', colors[k % colors.length]);
        s.textContent = t.replace(/ /g, ' ');
        line.appendChild(s);
      });
      count.innerHTML = ex.note;
    }
    next.hidden = false;
    next.addEventListener('click', function () {
      i = (i + 1) % examples.length;
      show(examples[i]);
    });
  })();

  // --- Spot the hallucination ---
  (function () {
    var cfg = data('hallu-data');
    var roundEl = document.getElementById('hallu-round');
    if (!cfg || !roundEl) return;
    var qEl = document.getElementById('hallu-q');
    var aEl = document.getElementById('hallu-a');
    var choices = document.getElementById('hallu-choices');
    var reveal = document.getElementById('hallu-reveal');
    var verdict = document.getElementById('hallu-verdict');
    var explain = document.getElementById('hallu-explain');
    var nextBtn = document.getElementById('hallu-next');
    var finalEl = document.getElementById('hallu-final');
    var dots = document.querySelectorAll('#hallu .guess-dot');
    var round = 0;

    function updateDots() {
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === round);
        d.classList.toggle('done', i < round);
      });
    }

    function showRound() {
      var r = cfg.rounds[round];
      qEl.textContent = r.q;
      aEl.textContent = r.a;
      choices.hidden = false;
      reveal.hidden = true;
      updateDots();
    }

    function choose(pick) {
      var r = cfg.rounds[round];
      var correct = (pick === 'real') === r.real;
      verdict.textContent = correct
        ? (r.real ? 'Correct — that one was real.' : 'Correct — that one was made up.')
        : (r.real ? 'Not quite — that one was actually real.' : 'Not quite — that one was made up.');
      verdict.className = 'guess-verdict ' + (correct ? 'is-correct' : 'is-wrong');
      explain.textContent = r.explain;
      choices.hidden = true;
      reveal.hidden = false;
      nextBtn.textContent = round < cfg.rounds.length - 1 ? 'Next example →' : 'See the takeaway';
    }

    choices.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-choice]');
      if (!b) return;
      choose(b.getAttribute('data-choice'));
    });

    nextBtn.addEventListener('click', function () {
      round += 1;
      if (round < cfg.rounds.length) {
        showRound();
      } else {
        roundEl.hidden = true;
        dots.forEach(function (d) { d.classList.add('done'); d.classList.remove('active'); });
        finalEl.hidden = false;
        finalEl.textContent = cfg.final;
      }
    });

    showRound();
  })();

  // --- Human or AI? ---
  (function () {
    var cfg = data('hoa-data');
    var roundEl = document.getElementById('hoa-round');
    if (!cfg || !roundEl) return;
    var promptEl = document.getElementById('hoa-prompt');
    var textA = document.getElementById('hoa-text-a');
    var textB = document.getElementById('hoa-text-b');
    var pair = document.getElementById('hoa-pair');
    var reveal = document.getElementById('hoa-reveal');
    var verdict = document.getElementById('hoa-verdict');
    var explain = document.getElementById('hoa-explain');
    var nextBtn = document.getElementById('hoa-next');
    var finalEl = document.getElementById('hoa-final');
    var dots = document.querySelectorAll('#hoa .guess-dot');
    var round = 0;

    function updateDots() {
      dots.forEach(function (d, i) {
        d.classList.toggle('active', i === round);
        d.classList.toggle('done', i < round);
      });
    }

    function showRound() {
      var r = cfg.rounds[round];
      promptEl.textContent = r.prompt;
      textA.textContent = r.a;
      textB.textContent = r.b;
      pair.hidden = false;
      reveal.hidden = true;
      updateDots();
    }

    function choose(pick) {
      var r = cfg.rounds[round];
      var aiPick = r.aiIsA ? 'a' : 'b';
      var correct = pick === aiPick;
      verdict.textContent = correct
        ? 'Correct — ' + aiPick.toUpperCase() + ' reads as the more typical AI style.'
        : 'Not quite — ' + aiPick.toUpperCase() + ' reads as the more typical AI style.';
      verdict.className = 'guess-verdict ' + (correct ? 'is-correct' : 'is-wrong');
      explain.textContent = r.explain;
      pair.hidden = true;
      reveal.hidden = false;
      nextBtn.textContent = round < cfg.rounds.length - 1 ? 'Next pair →' : 'See the takeaway';
    }

    pair.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-choice]');
      if (!b) return;
      choose(b.getAttribute('data-choice'));
    });

    nextBtn.addEventListener('click', function () {
      round += 1;
      if (round < cfg.rounds.length) {
        showRound();
      } else {
        roundEl.hidden = true;
        dots.forEach(function (d) { d.classList.add('done'); d.classList.remove('active'); });
        finalEl.hidden = false;
        finalEl.textContent = cfg.final;
      }
    });

    showRound();
  })();

  // --- Temperature dial ---
  (function () {
    var stops = data('temp-data');
    var range = document.getElementById('temp-range');
    if (!stops || !range) return;
    var label = document.getElementById('temp-label');
    var out = document.getElementById('temp-out');
    var note = document.getElementById('temp-note');
    range.addEventListener('input', function () {
      var s = stops[Number(range.value)];
      label.textContent = s.label;
      out.textContent = s.out;
      note.textContent = s.note;
    });
  })();

})();
