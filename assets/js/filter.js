(function () {
  var controls = Array.prototype.slice.call(document.querySelectorAll('.filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.item-card'));
  var sections = Array.prototype.slice.call(document.querySelectorAll('.item-section'));
  var search = document.querySelector('.search');

  // Cache each card's searchable text once (title + summary + tags + byline).
  cards.forEach(function (card) {
    card.__text = (card.textContent || '').toLowerCase().replace(/\s+/g, ' ');
  });

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.section-tab'));
  var hasTabs = tabs.length > 0;

  var state = { type: 'all', value: undefined, query: '', section: hasTabs ? tabs[0].dataset.section : null };

  function matchesFilter(card, type, value) {
    if (card.dataset.pinned === 'true') return true;
    if (type === 'all') return true;
    if (type === 'tag') return ('|' + card.dataset.tags + '|').indexOf('|' + value + '|') !== -1;
    if (type === 'period') return card.dataset.period === value;
    return true;
  }

  function matchesSearch(card, query) {
    if (!query) return true;
    return card.__text.indexOf(query) !== -1;
  }

  function render() {
    controls.forEach(function (c) {
      var on = (state.type === 'all' && c.dataset.filter === 'all') ||
               (c.dataset.filter === state.type && c.dataset.value === state.value);
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    cards.forEach(function (card) {
      var show = matchesFilter(card, state.type, state.value) && matchesSearch(card, state.query);
      card.style.display = show ? '' : 'none';
    });
    // Count visible cards per section.
    var totalVisible = 0;
    var counts = {};
    sections.forEach(function (sec) {
      var n = Array.prototype.slice.call(sec.querySelectorAll('.item-card'))
        .filter(function (c) { return c.style.display !== 'none'; }).length;
      counts[sec.dataset.section || ''] = n;
      totalVisible += n;
      var secBadge = sec.querySelector('.section-count');
      if (secBadge) secBadge.textContent = '(' + n + ')';
    });

    if (hasTabs) {
      // Auto-switch off an empty tab when another one still has matches.
      if ((counts[state.section] || 0) === 0 && totalVisible > 0) {
        for (var i = 0; i < tabs.length; i++) {
          if ((counts[tabs[i].dataset.section] || 0) > 0) { state.section = tabs[i].dataset.section; break; }
        }
      }
      tabs.forEach(function (tab) {
        var key = tab.dataset.section;
        var n = counts[key] || 0;
        var on = key === state.section;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.disabled = n === 0;
        var badge = tab.querySelector('.tab-count');
        if (badge) badge.textContent = '(' + n + ')';
      });
      // Show only the active section.
      sections.forEach(function (sec) {
        sec.style.display = (sec.dataset.section === state.section) ? '' : 'none';
      });
    } else {
      // No tabs: hide a section when it has no visible cards.
      sections.forEach(function (sec) {
        sec.style.display = (counts[sec.dataset.section || ''] > 0) ? '' : 'none';
      });
    }
    // Show an empty-state note when a search/filter leaves nothing anywhere.
    var note = document.querySelector('.search-empty');
    if (note) note.style.display = totalVisible > 0 ? 'none' : '';
    // Reflect filter + search in the URL hash so the view is shareable.
    var parts = [];
    if (state.type === 'tag') parts.push('tag=' + encodeURIComponent(state.value));
    else if (state.type === 'period') parts.push('period=' + encodeURIComponent(state.value));
    if (state.query) parts.push('q=' + encodeURIComponent(state.query));
    history.replaceState(null, '', parts.length ? '#' + parts.join('&') : location.pathname);
  }

  controls.forEach(function (c) {
    c.addEventListener('click', function () {
      state.type = c.dataset.filter;
      state.value = c.dataset.value;
      render();
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      state.query = search.value.trim().toLowerCase();
      render();
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.section = tab.dataset.section;
      render();
    });
  });

  // "+ N more" toggle for the collapsed (lower-frequency) tags.
  var moreBtn = document.querySelector('.tags-more');
  var tagList = document.querySelector('.tag-list');
  var extras = Array.prototype.slice.call(document.querySelectorAll('.filter-extra'));
  function setExpanded(expanded) {
    extras.forEach(function (e) { e.hidden = !expanded; });
    // Expanded, the full list can be long: cap its height and scroll inside.
    if (tagList) tagList.classList.toggle('scrolling', expanded);
    if (!moreBtn) return;
    moreBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    moreBtn.textContent = expanded ? 'show less' : ('+ ' + moreBtn.dataset.more + ' more');
  }
  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      setExpanded(moreBtn.getAttribute('aria-expanded') !== 'true');
    });
  }

  // Restore filter + search from the URL hash (e.g. #tag=attention&q=kaggle).
  location.hash.replace(/^#/, '').split('&').forEach(function (p) {
    if (!p) return;
    var i = p.indexOf('=');
    var k = p.slice(0, i);
    var v = decodeURIComponent(p.slice(i + 1));
    if (k === 'tag') { state.type = 'tag'; state.value = v; }
    else if (k === 'period') { state.type = 'period'; state.value = v; }
    else if (k === 'q') { state.query = v.toLowerCase(); }
  });
  if (search && state.query) search.value = state.query;
  // If the restored tag is one of the collapsed extras, reveal them so it shows.
  if (state.type === 'tag' && extras.some(function (e) { return e.dataset.value === state.value; })) {
    setExpanded(true);
  }
  render();
})();
