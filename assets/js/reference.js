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
      // exclude the trailing "#" anchor text from the TOC label; strip trailing marker tokens
      var rawLabel = h.firstChild ? h.firstChild.textContent : h.textContent;
      a.textContent = rawLabel.replace(/\s*\[(OPEN|STUB|EXT)\]\s*$/, '').trim();
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

  // --- In-page search ---
  var searchMount = document.querySelector('.ref-search');
  if (searchMount) {
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search this page…';
    input.setAttribute('aria-label', 'Search this page');
    var count = document.createElement('div');
    count.className = 'ref-count';
    searchMount.appendChild(input);
    searchMount.appendChild(count);

    var hits = [];
    var cursor = -1;

    function clearHighlights() {
      body.querySelectorAll('mark.ref-hit').forEach(function (m) {
        var t = document.createTextNode(m.textContent);
        m.parentNode.replaceChild(t, m);
      });
      body.normalize();
      hits = [];
      cursor = -1;
    }

    function highlight(term) {
      var lower = term.toLowerCase();
      var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue.toLowerCase().includes(lower)) return NodeFilter.FILTER_REJECT;
          var p = node.parentNode;
          // skip code, the anchors, and already-marked nodes
          if (p.closest('code, pre, .anchor, mark, .katex, .marker')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var targets = [];
      while (walker.nextNode()) targets.push(walker.currentNode);
      targets.forEach(function (node) {
        var text = node.nodeValue, idx, last = 0, frag = document.createDocumentFragment();
        var lc = text.toLowerCase();
        while ((idx = lc.indexOf(lower, last)) !== -1) {
          if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
          var mark = document.createElement('mark');
          mark.className = 'ref-hit';
          mark.textContent = text.slice(idx, idx + term.length);
          frag.appendChild(mark);
          hits.push(mark);
          last = idx + term.length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    }

    function filterToc(term) {
      var lower = term.toLowerCase();
      Object.keys(tocLinks).forEach(function (id) {
        var li = tocLinks[id].parentNode;
        li.style.display = (!term || tocLinks[id].textContent.toLowerCase().includes(lower)) ? '' : 'none';
      });
    }

    function run() {
      clearHighlights();
      var term = input.value.trim();
      filterToc(term);
      if (!term) { count.textContent = ''; return; }
      highlight(term);
      count.textContent = hits.length + (hits.length === 1 ? ' match' : ' matches');
      if (hits.length) { cursor = 0; focusHit(); }
    }

    function focusHit() {
      hits.forEach(function (m, i) { m.classList.toggle('current', i === cursor); });
      if (hits[cursor]) hits[cursor].scrollIntoView({ block: 'center' });
    }

    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && hits.length) {
        e.preventDefault();
        cursor = (cursor + (e.shiftKey ? -1 + hits.length : 1)) % hits.length;
        focusHit();
      }
    });
  }

  // --- Marker badges + status panel ---
  var MARKERS = [
    { key: 'open', label: 'OPEN', token: '[OPEN]' },
    { key: 'stub', label: 'STUB', token: '[STUB]' },
    { key: 'ext',  label: 'EXT',  token: '[EXT]'  }
  ];
  var markerNodes = { open: [], stub: [], ext: [] };

  MARKERS.forEach(function (m) {
    var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue.includes(m.token)) return NodeFilter.FILTER_REJECT;
        if (node.parentNode.closest('code, pre, .anchor, .marker, .katex')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    targets.forEach(function (node) {
      var parts = node.nodeValue.split(m.token);
      var frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i > 0) {
          var span = document.createElement('span');
          span.className = 'marker marker--' + m.key;
          span.textContent = m.label;
          frag.appendChild(span);
          markerNodes[m.key].push(span);
        }
        if (part) frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  });

  var statusMount = document.querySelector('.ref-status');
  if (statusMount) {
    var row = document.createElement('div');
    row.className = 'ref-status-row';
    MARKERS.forEach(function (m) {
      var nodes = markerNodes[m.key];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="n">' + nodes.length + '</span>' + m.label;
      btn.disabled = nodes.length === 0;
      var i = 0;
      btn.addEventListener('click', function () {
        if (!nodes.length) return;
        nodes[i % nodes.length].scrollIntoView({ block: 'center' });
        i++;
      });
      row.appendChild(btn);
    });
    statusMount.appendChild(row);
  }
})();
