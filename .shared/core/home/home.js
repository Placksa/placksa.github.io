/* Homepage. Everything on this page is rendered from catalog.js — add a widget
   there and its card, its menu row and its search entries all follow. */
(function () {
  'use strict';

  var C = window.CHROME;
  var site = C.site;
  var boot = JSON.parse(document.getElementById('homeBoot').textContent);

  // Per-widget glyphs for the placeholder thumbnail, keyed by catalog id.
  // Falls back to a generic mark, so a new widget is never blank.
  var GLYPH = {
    'multi-poll': 'M3 13h4v9H3zM10 7h4v15h-4zM17 2h4v20h-4z',
    'bubble-alerts': 'M12 2C6.5 2 2 5.86 2 10.62c0 2.7 1.45 5.1 3.7 6.68V22l4.1-2.3c.71.12 1.45.19 2.2.19 5.5 0 10-3.86 10-8.62S17.5 2 12 2z',
    'group-chat-overlay': 'M9 2C4.58 2 1 4.98 1 8.65c0 1.98 1.05 3.76 2.7 4.98v3.3l3.2-1.79c.67.13 1.38.2 2.1.2 4.42 0 8-2.98 8-6.69S13.42 2 9 2z M17.4 8.02c3.2.62 5.6 3 5.6 5.85 0 1.67-.83 3.18-2.17 4.24V21l-2.7-1.5c-.57.1-1.16.15-1.77.15-3.1 0-5.78-1.42-7.06-3.5.42.04.85.06 1.29.06 5.1 0 9.2-3.5 9.2-7.86 0-.11 0-.22-.01-.33z',
    _: 'M4 4h16v5H4zM4 11h16v9H4z'
  };

  var PLAT_LOGO = {
    twitch: ['twitch/logo-twitch.svg', 19],
    youtube: ['youtube/logo-youtube.svg', 21],
    kick: ['kick/logo-kick.svg', 19],
    tiktok: ['tiktok/logo-tiktok.svg', 19]
  };

  function hex(h, a) {
    var n = parseInt(h.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function platforms(list) {
    var marks = (list || []).map(function (p) {
      var spec = PLAT_LOGO[p];
      if (!spec) return '';
      var label = (C.PLATFORM[p] || [p])[0];
      return '<img class="plat" style="height:' + spec[1] + 'px" ' +
        'src="' + C.esc(C.root('.shared/assets/images/' + spec[0])) + '" alt="' + C.esc(label) + '" title="' + C.esc(label) + '">';
    }).join('');
    return '<span class="plat-row">' + marks + '</span>';
  }

  function badge(tier) {
    if (tier === 'pro') return '<span class="badge badge-pro">PRO</span>';
    if (tier === 'freemium') {
      return '<span class="badge-split"><span class="badge badge-free">FREE</span>' +
        '<span class="badge badge-pro">PRO</span></span>';
    }
    return '<span class="badge badge-free">FREE</span>';
  }

  function card(c) {
    var href = C.root(c.docsUrl);
    // Cards do use a colour, but leaving it out should never break a build.
    var accent = c.accent || '#3b82f6';
    // The placeholder is the card's own background, so a card with no art still
    // looks designed. A real thumb.png layers over it and removes itself if missing.
    var art = c.thumb
      ? '<img class="art" src="' + C.esc(C.root(c.thumb)) + '" alt="" onerror="this.remove()">'
      : '';

    // Settings and Get PRO go elsewhere, so they sit above the cover link.
    var extra = '';
    if (c.settingsUrl) extra += '<a href="' + C.esc(C.root(c.settingsUrl)) + '">Settings</a>';
    if (c.proHref) extra += '<a href="' + C.esc(c.proHref) + '" target="_blank" rel="noopener">Get PRO</a>';

    return '<article class="tile" style="--brand:' + accent +
        ';--wash-a:' + hex(accent, 0.22) + ';--wash-b:' + hex(accent, 0.05) + '">' +
      // Covers the card — thumbnail, title and body all lead to the docs.
      '<a class="tile-cover" href="' + C.esc(href) + '" aria-label="' + C.esc(c.name) + ' documentation"></a>' +
      '<div class="thumb">' + art +
        '<svg class="ghost" viewBox="0 0 24 24" fill="' + accent + '"><path d="' + (GLYPH[c.id] || GLYPH._) + '"></path></svg>' +
        (c.eyebrow
          ? '<span class="eyebrow-chip" style="border-color:' + hex(accent, 0.38) + ';color:' + accent + '">' +
            C.esc(c.eyebrow) + '</span>'
          : '') +
      '</div>' +
      '<div class="tile-body">' +
        '<div class="tile-head">' +
          '<span class="tile-name">' + C.esc(c.name) + '</span>' +
          badge(c.tier) +
        '</div>' +
        '<p>' + C.esc(c.description || '') + '</p>' +
        '<div class="tile-foot">' + platforms(c.platforms) +
          '<span class="tile-links">' + extra +
            '<a class="tile-go" href="' + C.esc(href) + '">Docs' + C.svg(C.ICON.arrow, { size: 14, stroke: 'currentColor', width: 2.4 }) + '</a>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function shelf(id, label, rows) {
    if (!rows.length) return '';
    return '<section class="shelf" id="' + id + '"><div class="rule">' + C.esc(label) + '</div>' +
      '<div class="grid">' + rows.map(card).join('') + '</div></section>';
  }

  function hero() {
    var runs = ['twitch', 'youtube', 'kick', 'tiktok'].map(function (p) {
      var spec = PLAT_LOGO[p];
      var label = (C.PLATFORM[p] || [p])[0];
      return '<span><img class="plat" style="height:' + spec[1] + 'px" src="' +
        C.esc(C.root('.shared/assets/images/' + spec[0])) + '" alt="">' + C.esc(label) + '</span>';
    }).join('');

    // Patreon and Ko-fi, declared in site.js so the hero stays markup-only.
    var support = (site.support || []).map(function (b) {
      return '<a class="btn btn-brand" style="--brand:' + b.color + '" href="' + C.esc(b.href) + '" ' +
        'target="_blank" rel="noopener">' + C.mark(b.icon, { size: 17, fill: b.color }) + C.esc(b.label) + '</a>';
    }).join('');

    return '<section class="hero">' +
      '<div class="eyebrow">' + C.esc(boot.eyebrow) + '</div>' +
      '<h1>' + C.esc(boot.title) + '</h1>' +
      '<p>' + C.esc(boot.lede) + '</p>' +
      '<div class="cta-row">' +
        '<a class="btn btn-primary" href="#widgets">Browse widgets' +
          C.svg(C.ICON.arrow, { size: 17, stroke: '#fff', width: 2.4 }) + '</a>' +
        support +
      '</div>' +
      '<div class="runs-on"><span style="color:inherit">Supports</span>' + runs + '</div>' +
    '</section>';
  }

  /* ── render ─────────────────────────────────────────── */

  // A fresh visit opens on the hero alone; once expanded it stays that way for
  // the session, so coming back from a docs page does not replay the landing.
  // 404.html runs this same script and promises the widgets are below it, so the
  // landing is for the homepage only — at '/' or at '/index.html'.
  var opened;
  try { opened = sessionStorage.getItem('home-open'); } catch (e) {}
  var isHome = location.pathname.replace(/index\.html$/, '') === new URL(C.root()).pathname;
  if (isHome && location.hash !== '#widgets' && opened !== '1') {
    document.documentElement.classList.add('is-landing');
  }

  document.body.appendChild(C.buildHeader());
  C.slideNav(document.querySelector('.site-header'));

  var free = C.catalog.filter(function (c) { return c.tier !== 'pro'; });
  var pro = C.catalog.filter(function (c) { return c.tier === 'pro'; });

  var main = C.el('<main class="page-wrap"></main>');
  // The inner div is what the landing collapses to zero height; the shelves
  // cannot do it themselves, since 0fr sizing needs a single child to measure.
  main.innerHTML = hero() +
    '<div class="shelves"><div>' +
      shelf('widgets', 'Widgets & tools', free) +
      // Renders nothing at all while there are no pro entries — no empty shelf.
      shelf('exclusive', 'Patreon-exclusive', pro) +
    '</div></div>';
  document.body.appendChild(main);

  main.appendChild(C.buildSiteFooter());

  // Browse widgets and the header's Widgets tab both point at #widgets. From the
  // landing they expand the page instead of navigating; the hero collapsing is
  // what brings the grid into view, so there is no scroll to run. Registering
  // before nav.js means preventDefault also calls off its hold-and-warm.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#widgets"]');
    if (!a || !document.documentElement.classList.contains('is-landing')) return;
    e.preventDefault();
    var root = document.documentElement;
    root.classList.remove('is-landing');
    // Keeps the shelves clipped while they grow; dropped afterwards so the top
    // row's hover lift is not cut off.
    root.classList.add('is-opening');
    setTimeout(function () { root.classList.remove('is-opening'); }, 560);
    try { sessionStorage.setItem('home-open', '1'); } catch (err) {}
    history.replaceState(null, '', '#widgets');
  });

  // Arriving on #widgets from elsewhere: the browser's own hash scroll already
  // ran, before this script had put a grid on the page.
  if (location.hash === '#widgets') {
    requestAnimationFrame(function () {
      var t = document.getElementById('widgets');
      if (t) t.scrollIntoView();
    });
  }
})();
