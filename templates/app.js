// Tiny progressive enhancements — the page works fully without this script.
(function () {
  // Expand/collapse all glossary tiers
  var btn = document.getElementById('toggle-all-terms');
  if (btn) {
    btn.addEventListener('click', function () {
      var tiers = document.querySelectorAll('details.tier');
      var anyClosed = Array.prototype.some.call(tiers, function (d) { return !d.open; });
      tiers.forEach(function (d) { d.open = anyClosed; });
      btn.textContent = anyClosed ? 'Collapse all terms' : 'Expand all 3 tiers';
    });
  }

  // If a link targets something inside a closed <details>, open it first
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    var d = target.closest('details');
    while (d) { d.open = true; d = d.parentElement.closest('details'); }
  });
})();
