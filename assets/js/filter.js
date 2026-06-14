(function () {
  var controls = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.item-card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.item-section'));

  function matches(card, type, value) {
    if (card.dataset.pinned === 'true') return true;
    if (type === 'all') return true;
    if (type === 'tag') return ('|' + card.dataset.tags + '|').indexOf('|' + value + '|') !== -1;
    if (type === 'year') return card.dataset.year === value;
    return true;
  }

  function apply(type, value) {
    controls.forEach(function (c) {
      var on = (type === 'all' && c.dataset.filter === 'all') ||
               (c.dataset.filter === type && c.dataset.value === value);
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (card) {
      card.style.display = matches(card, type, value) ? '' : 'none';
    });
    // Hide a section (heading + grid) when it has no visible cards.
    sections.forEach(function (sec) {
      var any = Array.prototype.slice.call(sec.querySelectorAll('.item-card'))
        .some(function (c) { return c.style.display !== 'none'; });
      sec.style.display = any ? '' : 'none';
    });
    // Reflect the active filter in the URL hash so a filtered view is shareable.
    if (type === 'all') history.replaceState(null, '', location.pathname);
    else history.replaceState(null, '', '#' + type + '=' + encodeURIComponent(value));
  }

  controls.forEach(function (c) {
    c.addEventListener('click', function () { apply(c.dataset.filter, c.dataset.value); });
  });

  var m = location.hash.match(/^#(tag|year)=(.+)$/);
  if (m) apply(m[1], decodeURIComponent(m[2]));
  else apply('all');
})();
