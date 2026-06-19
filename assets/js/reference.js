(function () {
  var body = document.querySelector('.ref-body');
  var tocEl = document.querySelector('.ref-toc');
  if (!body) return;

  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')   // drop punctuation (incl. the § sign)
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  var headings = Array.prototype.slice.call(body.querySelectorAll('h2, h3'));
  var used = {};
  headings.forEach(function (h) {
    var base = slugify(h.textContent) || 'section';
    var id = base;
    var n = 2;
    while (used[id]) { id = base + '-' + n++; }
    used[id] = true;
    h.id = id;
    var a = document.createElement('a');
    a.className = 'anchor';
    a.href = '#' + id;
    a.setAttribute('aria-label', 'Link to this section');
    a.textContent = '#';
    h.appendChild(a);
  });

  if (tocEl && headings.length) {
    var ul = document.createElement('ul');
    headings.forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'lvl-' + (h.tagName === 'H3' ? '3' : '2');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      // exclude the trailing "#" anchor text from the TOC label
      a.textContent = h.firstChild ? h.firstChild.textContent : h.textContent;
      li.appendChild(a);
      ul.appendChild(li);
    });
    tocEl.appendChild(ul);
  }

  // --- Scrollspy ---
  var tocLinks = {};
  if (tocEl) {
    Array.prototype.slice.call(tocEl.querySelectorAll('a')).forEach(function (a) {
      tocLinks[a.getAttribute('href').slice(1)] = a;
    });
  }
  var visible = {};
  function refreshActive() {
    var current = null;
    headings.forEach(function (h) {
      if (visible[h.id]) { current = current || h.id; }
    });
    Object.keys(tocLinks).forEach(function (id) {
      tocLinks[id].classList.toggle('active', id === current);
    });
  }
  if ('IntersectionObserver' in window && headings.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      refreshActive();
    }, { rootMargin: '0px 0px -75% 0px', threshold: 0 });
    headings.forEach(function (h) { spy.observe(h); });
  }
})();
