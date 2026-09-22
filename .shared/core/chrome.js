/* Site chrome shared by every page: the header, the footer, and the small
   helpers both docs.js and home.js draw with. Load after site.js and
   catalog.js, before the page's own script. */
(function () {
  'use strict';

  var site = window.SITE || {};
  var catalog = window.CATALOG || [];

  // This file lives at <root>/.shared/core/, so every shared path resolves from
  // its own src. Nothing here is depth-bound — a page at any level works.
  var me = document.currentScript || document.querySelector('script[src$="chrome.js"]');
  var CORE = new URL('./', me.src).href;
  var ROOT = new URL('../../', me.src).href;

  function root(p) { return new URL(p || '', ROOT).href; }
  function core(p) { return new URL(p || '', CORE).href; }

  var ICON = {
    github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22',
    heart: 'M12 21s-7.5-4.6-9.6-9A5.4 5.4 0 0 1 12 6.5 5.4 5.4 0 0 1 21.6 12c-2.1 4.4-9.6 9-9.6 9z',
    search: 'M21 21l-4.3-4.3',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    copy: 'M5 15V5a2 2 0 0 1 2-2h10',
    bolt: 'M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z',
    pencil: 'M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z',
    list: 'M4 7h10M4 12h16M4 17h7',
    close: 'M6 6l12 12M18 6L6 18',
    chevron: 'M6 9l6 6 6-6',
    arrow: 'M5 12h13M13 6l6 6-6 6'
  };

  // Filled marks, drawn rather than stroked.
  var MARK = {
    patreon: '<path d="M7.462 3.1c2.615-1.268 6.226-1.446 9.063-.503c2.568.853 4.471 3.175 4.475 5.81c.004 3.061-1.942 5.492-4.896 6.243c-1.693.43-2.338.75-2.942 1.582c-.238.328-.45.745-.796 1.533l-.22.5C11 20.866 9.99 22.027 7.91 22c-2.232-.03-3.603-1.742-4.313-4.48c-.458-1.768-.617-3.808-.594-5.876c.044-3.993 1.42-7.072 4.46-8.545z"></path>',
    kofi: '<path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"></path>',
    discord: '<path d="M19.9 5.2A17.3 17.3 0 0 0 15.6 3.9l-.2.4a16 16 0 0 1 3.8 1.2 15.4 15.4 0 0 0-13 0 16 16 0 0 1 3.8-1.2l-.2-.4A17.3 17.3 0 0 0 5.5 5.2C2.8 9.3 2 13.3 2.4 17.2A17.4 17.4 0 0 0 7.7 19.8l1-1.7a11.3 11.3 0 0 1-1.8-.8l.4-.4a12.5 12.5 0 0 0 10.6 0l.4.4a11.3 11.3 0 0 1-1.8.8l1 1.7a17.4 17.4 0 0 0 5.3-2.6c.5-4.6-.7-8.6-3-12zM9 14.7c-1 0-1.9-.9-1.9-2.1S8 10.5 9 10.5s1.9.9 1.9 2.1-.8 2.1-1.9 2.1zm5 0c-1 0-1.9-.9-1.9-2.1s.9-2.1 1.9-2.1 1.9.9 1.9 2.1-.8 2.1-1.9 2.1z"></path>'
  };

  var PLATFORM = {
    twitch: ['Twitch', '#9146ff'],
    youtube: ['YouTube', '#ff0033'],
    tiktok: ['TikTok', '#25f4ee'],
    kick: ['Kick', '#53fc18']
  };

  function svg(path, opts) {
    opts = opts || {};
    var size = opts.size || 16;
    var extra = opts.circle ? '<circle cx="12" cy="12" r="9"></circle>' : '';
    return '<svg class="' + (opts.cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="' + (opts.stroke || '#8b8b8b') + '" stroke-width="' + (opts.width || 1.8) + '" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + extra + '<path d="' + path + '"></path></svg>';
  }

  function mark(name, opts) {
    opts = opts || {};
    var size = opts.size || 18;
    return '<svg class="' + (opts.cls || '') + '" width="' + size + '" height="' + size + '" ' +
      'viewBox="0 0 24 24" fill="' + (opts.fill || 'currentColor') + '" stroke="none">' + MARK[name] + '</svg>';
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Shared by docs.js (heading ids) and search.js (deep links) — they must agree.
  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
  }

  function entry(id) {
    for (var i = 0; i < catalog.length; i++) if (catalog[i].id === id) return catalog[i];
    return null;
  }

  // 'ph:chart-bar-bold' | 'https://…' | '.shared/assets/images/icons/x.svg'
  function iconUrl(icon, color) {
    if (!icon) return null;
    if (/^https?:\/\//i.test(icon)) return icon;
    if (/^[\w-]+:[\w.-]+$/.test(icon)) {
      var p = icon.split(':');
      return 'https://api.iconify.design/' + p[0] + '/' + p[1] + '.svg' +
        (color ? '?color=' + encodeURIComponent(color) : '');
    }
    return root(icon);
  }

  /* ── header ─────────────────────────────────────────── */

  // Which tab is lit is read off the URL, never hardcoded per page.
  function activeNav(n) {
    var path = location.pathname;
    if (n.menu === 'catalog') return /\/docs\/?$/.test(path.replace(/\/$/, '/')) || path.indexOf('/docs/') > -1;
    if (n.href === '#widgets') return path === new URL(ROOT).pathname;
    return false;
  }

  function docsMenu() {
    var rows = catalog.map(function (c) {
      // Monochrome on purpose: the menu reads as one set, and a new widget
      // needs no colour picked for it. The tile is styled in chrome.css.
      var url = iconUrl(c.icon, '#ffffff');
      var glyph = url
        ? '<img src="' + esc(url) + '" alt="" width="16" height="16">'
        : svg(ICON.list, { size: 15, stroke: '#ffffff' });
      return '<a class="nav-pop-item" href="' + esc(root(c.docsUrl)) + '">' +
        '<span class="nav-pop-icon">' + glyph + '</span>' +
        '<span class="nav-pop-text"><span class="nav-pop-name">' + esc(c.name) + '</span>' +
        (c.eyebrow ? '<span class="nav-pop-eyebrow">' + esc(c.eyebrow) + '</span>' : '') + '</span>' +
        svg(ICON.arrow, { size: 14, stroke: '#7fa6e6', width: 2.3, cls: 'nav-pop-arrow' }) +
      '</a>';
    }).join('');

    return '<div class="nav-pop">' + rows +
      '<a class="nav-pop-foot" href="' + esc(root('#widgets')) + '">' +
        svg(ICON.list, { size: 12, stroke: 'currentColor', width: 2.2 }) + 'Every widget on the homepage</a>' +
    '</div>';
  }

  function buildHeader() {
    var nav = (site.nav || []).map(function (n) {
      if (n.soon) {
        return '<span class="nav-link is-soon" data-tooltip="Coming Soon">' + esc(n.label) + '</span>';
      }
      var on = activeNav(n) ? ' is-active' : '';
      if (n.menu === 'catalog') {
        return '<span class="nav-menu">' +
          '<button class="nav-link has-menu' + on + '" type="button" aria-expanded="false">' + esc(n.label) +
            svg(ICON.chevron, { size: 11, stroke: 'currentColor', width: 2.6, cls: 'nav-caret' }) +
          '</button>' + docsMenu() +
        '</span>';
      }
      return '<a class="nav-link' + on + '" href="' + esc(root(n.href)) + '">' + esc(n.label) + '</a>';
    }).join('');

    var links = (site.links || []).map(function (l) {
      var glyph = MARK[l.icon]
        ? mark(l.icon, { size: 18, cls: 'hdr-icon is-filled' })
        : svg(ICON[l.icon] || ICON.link, { size: 19, cls: 'hdr-icon', width: 2.2 });
      return '<a href="' + esc(l.href) + '" target="_blank" rel="noopener" aria-label="' +
        esc(l.label) + '" data-tooltip="' + esc(l.label) + '">' + glyph + '</a>';
    }).join('');

    var help = site.discord
      ? '<div class="help-wrap">' +
          '<button class="help-pill" type="button" aria-expanded="false">' + mark('discord', { size: 16, fill: '#5865f2' }) +
            '<span>Need help?</span></button>' +
          '<div class="help-pop">' +
            '<h4>Stuck on something?</h4>' +
            '<p>Open a thread in the support channels on my Discord. ' +
            'Include the widget name and what you have tried so far.</p>' +
            '<a class="help-cta" href="' + esc(site.discord) + '" target="_blank" rel="noopener">' +
              mark('discord', { size: 16, fill: '#fff' }) + 'Join the Discord</a>' +
          '</div>' +
        '</div>'
      : '';

    var header = el(
      '<header class="site-header">' +
        '<a class="brand" href="' + esc(root()) + '" aria-label="rexbordz home">' +
          '<img src="' + esc(root(site.logo || '')) + '" alt="">' +
          '<span>' + esc(site.brand || '') + '</span>' +
        '</a>' +
        '<nav class="site-nav">' + nav + '<span class="nav-bar"></span></nav>' +
        '<div class="header-spacer"></div>' +
        '<div class="header-actions">' + links +
          '<div class="header-divider"></div>' +
          '<button class="search-pill" type="button">' +
            svg('M21 21l-4.3-4.3', { size: 14, stroke: '#fff', width: 2 })
              .replace('<path', '<circle cx="11" cy="11" r="7"></circle><path') +
            '<span class="search-text">Search</span><kbd>/</kbd>' +
          '</button>' + help +
        '</div>' +
      '</header>'
    );

    wireMenu(header);
    wireHelp(header);
    return header;
  }

  // Hover owns both panels. Where there is no hover to read — touch — the tap
  // has to do the opening instead.
  var HOVERS = !window.matchMedia || matchMedia('(hover: hover)').matches;

  function wireMenu(header) {
    var wrap = header.querySelector('.nav-menu');
    if (!wrap) return;
    var btn = wrap.querySelector('.has-menu');
    var pop = wrap.querySelector('.nav-pop');
    var expose = function (open) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };

    if (HOVERS) {
      // Nothing latches: a click shuts the panel, and leaving resets it so the
      // next hover opens again.
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        expose(!wrap.classList.toggle('is-shut'));
      });
      wrap.addEventListener('pointerenter', function () {
        if (!wrap.classList.contains('is-shut')) expose(true);
      });
      wrap.addEventListener('pointerleave', function () {
        wrap.classList.remove('is-shut');
        expose(false);
      });
    } else {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        expose(wrap.classList.toggle('is-open'));
      });
      pop.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () {
        wrap.classList.remove('is-open');
        expose(false);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      wrap.classList.remove('is-open');
      if (HOVERS) wrap.classList.add('is-shut');
      expose(false);
    });
  }

  // The help panel opens on hover, and a click overrides that either way.
  function wireHelp(header) {
    var wrap = header.querySelector('.help-wrap');
    if (!wrap) return;
    var pill = wrap.querySelector('.help-pill');
    var pop = wrap.querySelector('.help-pop');
    var expose = function (open) { pill.setAttribute('aria-expanded', open ? 'true' : 'false'); };

    if (HOVERS) {
      // Nothing latches: a click shuts the panel, and leaving resets it so the
      // next hover opens again.
      pill.addEventListener('click', function (e) {
        e.stopPropagation();
        expose(!wrap.classList.toggle('is-shut'));
      });
      wrap.addEventListener('pointerenter', function () {
        if (!wrap.classList.contains('is-shut')) expose(true);
      });
      wrap.addEventListener('pointerleave', function () {
        wrap.classList.remove('is-shut');
        expose(false);
      });
    } else {
      pill.addEventListener('click', function (e) {
        e.stopPropagation();
        expose(wrap.classList.toggle('is-open'));
      });
      pop.addEventListener('click', function (e) { e.stopPropagation(); });
      document.addEventListener('click', function () {
        wrap.classList.remove('is-open');
        expose(false);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      wrap.classList.remove('is-open');
      if (HOVERS) wrap.classList.add('is-shut');
      expose(false);
    });
  }

  // One bar for the whole nav; the leading edge moves faster, so it stretches between tabs.
  function slideNav(header) {
    var nav = header.querySelector('.site-nav');
    var bar = nav && nav.querySelector('.nav-bar');
    if (!nav || !bar) return;

    var links = Array.prototype.slice.call(nav.querySelectorAll('.nav-link'));
    var active = nav.querySelector('.nav-link.is-active') || links[0];
    if (!active) return;

    function move(target, animate) {
      var nr = nav.getBoundingClientRect();
      var r = target.getBoundingClientRect();
      // Links pad themselves out to kill dead space between hit areas; inset by
      // that padding so the bar still hugs the label.
      var cs = getComputedStyle(target);
      var left = r.left - nr.left + parseFloat(cs.paddingLeft);
      var right = nr.right - r.right + parseFloat(cs.paddingRight);
      var was = parseFloat(bar.style.left);
      var goingRight = !isNaN(was) && left > was;

      bar.style.transitionDuration = animate === false ? '0s' : (goingRight ? '0.42s, 0.26s' : '0.26s, 0.42s');
      bar.style.left = left + 'px';
      bar.style.right = right + 'px';
    }

    // Measured after layout settles, or the first placement lands on stale boxes.
    requestAnimationFrame(function () { move(active, false); });
    links.forEach(function (l) { l.addEventListener('pointerenter', function () { move(l); }); });
    nav.addEventListener('pointerleave', function () { move(active); });
    window.addEventListener('resize', function () { move(active, false); });
  }

  /* ── footer ─────────────────────────────────────────── */

  // Brand marks (simple-icons paths), monochrome on purpose — these are my
  // channels, not the per-widget platform-support badges.
  var SOCIAL = {
    twitch: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
    youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    kick: 'M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z',
    tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
    github: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
  };

  function buildSiteFooter() {
    var row = (site.socials || []).map(function (s) {
      var d = SOCIAL[s.icon];
      if (!d) return '';
      return '<a class="soc" href="' + esc(s.href) + '" target="_blank" rel="noopener" ' +
        'aria-label="' + esc(s.label) + '" title="' + esc(s.label) + '">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="' + d + '"></path></svg></a>';
    }).join('');

    return el(
      '<footer class="site-footer">' +
        '<div class="soc-row">' + row + '</div>' +
        '<div class="copyright">&copy; ' + esc(site.brand || '') + '</div>' +
      '</footer>'
    );
  }

  window.CHROME = {
    ICON: ICON, MARK: MARK, PLATFORM: PLATFORM, SOCIAL: SOCIAL,
    svg: svg, mark: mark, el: el, esc: esc, slugify: slugify,
    root: root, core: core, entry: entry, iconUrl: iconUrl,
    catalog: catalog, site: site,
    buildHeader: buildHeader, buildSiteFooter: buildSiteFooter, slideNav: slideNav
  };
})();
