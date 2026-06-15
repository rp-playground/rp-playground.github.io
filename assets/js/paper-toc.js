// Progressive enhancement for the reading list (pages with `collapsible: true`).
// Transforms the rendered markdown — flat h2/h3 + paragraphs — into collapsible
// sections (open) and articles (closed), and builds a nested index on top.
// Without this script the page is still fully readable; it only adds behaviour.
(function () {
  "use strict";

  var paper = document.querySelector(".paper");
  if (!paper) return;

  // Collect the content nodes that follow the <header>, in document order.
  var nodes = [];
  for (var i = 0; i < paper.children.length; i++) {
    var child = paper.children[i];
    if (child.classList && child.classList.contains("paper-header")) continue;
    nodes.push(child);
  }
  if (!nodes.length) return;

  // Bail out if there are no sections to collapse.
  var hasH2 = nodes.some(function (n) { return n.tagName === "H2"; });
  if (!hasH2) return;

  var usedIds = Object.create(null);
  function slugify(text, prefix) {
    var base = (text || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    if (!base) base = "item";
    var id = prefix + "-" + base;
    var n = 2;
    while (usedIds[id]) { id = prefix + "-" + base + "-" + n; n++; }
    usedIds[id] = true;
    return id;
  }

  // Group the flat node list into [{ h2, id, title, items: [{ h3, id, title }] }].
  var sections = [];
  var current = null;
  var currentItem = null;

  nodes.forEach(function (node) {
    if (node.tagName === "H2") {
      current = {
        heading: node,
        id: slugify(node.textContent, "section"),
        title: node.textContent,
        body: [],   // content nodes between the h2 and its first h3
        items: []
      };
      sections.push(current);
      currentItem = null;
    } else if (node.tagName === "H3" && current) {
      currentItem = {
        heading: node,
        id: slugify(node.textContent, "paper"),
        title: node.textContent,
        body: []
      };
      current.items.push(currentItem);
    } else if (current) {
      (currentItem ? currentItem.body : current.body).push(node);
    }
    // Nodes before the first h2 (intro) are left untouched in place.
  });

  // Build a <details> for an article: closed by default, title in the summary.
  function buildItem(item) {
    var details = document.createElement("details");
    details.className = "paper-item";
    details.id = item.id;

    var summary = document.createElement("summary");
    summary.textContent = item.title;
    details.appendChild(summary);

    item.body.forEach(function (n) { details.appendChild(n); });
    item.heading.parentNode && item.heading.parentNode.removeChild(item.heading);
    return details;
  }

  // Build a <details> for a section: open by default.
  function buildSection(section) {
    var details = document.createElement("details");
    details.className = "toc-section";
    details.id = section.id;
    details.open = true;

    var summary = document.createElement("summary");
    summary.textContent = section.title;
    details.appendChild(summary);

    section.body.forEach(function (n) { details.appendChild(n); });
    section.items.forEach(function (item) { details.appendChild(buildItem(item)); });

    section.heading.parentNode && section.heading.parentNode.removeChild(section.heading);
    return details;
  }

  // Mark where the accordion begins (before the first section's heading) so any
  // intro text stays above untouched. A placeholder is used because building the
  // sections removes their original headings from the DOM.
  var marker = document.createComment("reading-list-index");
  sections[0].heading.parentNode.insertBefore(marker, sections[0].heading);

  var built = sections.map(buildSection);

  // Build the index.
  var nav = document.createElement("nav");
  nav.className = "toc";
  var navTitle = document.createElement("div");
  navTitle.className = "toc-title";
  navTitle.textContent = "Index";
  nav.appendChild(navTitle);

  var list = document.createElement("ul");
  sections.forEach(function (section) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = "#" + section.id;
    a.textContent = section.title;
    li.appendChild(a);

    if (section.items.length) {
      var sub = document.createElement("ul");
      section.items.forEach(function (item) {
        var subLi = document.createElement("li");
        var subA = document.createElement("a");
        subA.href = "#" + item.id;
        subA.textContent = item.title;
        subLi.appendChild(subA);
        sub.appendChild(subLi);
      });
      li.appendChild(sub);
    }
    list.appendChild(li);
  });
  nav.appendChild(list);

  // Insert index, then the rebuilt sections, at the marked position.
  marker.parentNode.insertBefore(nav, marker);
  built.forEach(function (d) { marker.parentNode.insertBefore(d, marker); });
  marker.parentNode.removeChild(marker);

  // Index links: expand the target (and its ancestor section) before scrolling,
  // so links work even when the target is collapsed.
  nav.addEventListener("click", function (e) {
    var link = e.target.closest("a");
    if (!link) return;
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();

    var el = target;
    while (el && el !== paper) {
      if (el.tagName === "DETAILS") el.open = true;
      el = el.parentNode;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    if (history.replaceState) history.replaceState(null, "", "#" + id);
  });
})();
