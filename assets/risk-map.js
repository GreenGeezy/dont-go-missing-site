/* National Park & Wilderness Missing-Persons Risk Checker.
   Runs entirely in the browser. The optional location lookup is computed here and never sent anywhere. */
(function () {
  'use strict';

  var root = document.getElementById('risk-map-app');
  if (!root) return;

  var DATA_URL = '/assets/risk-zones-public.json';
  var SITE = 'https://dontgomissing.com';
  var params = new URLSearchParams(window.location.search);
  var EMBED = params.get('embed') === '1';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var TIER = {
    'High-Cluster Zone': { cls: 'tier-high', color: '#ff6b4a' },
    'Documented SAR Zone': { cls: 'tier-mid', color: '#f5b85c' },
    'Recorded Case Zone': { cls: 'tier-low', color: '#4cc38a' }
  };
  var SYNONYMS = { smokies: 'smoky', smokey: 'smoky', nps: 'national park', np: 'national park', nf: 'national forest' };

  var els = {
    search: document.getElementById('rm-search'),
    locate: document.getElementById('rm-locate'),
    status: document.getElementById('rm-status'),
    results: document.getElementById('rm-results'),
    brief: document.getElementById('rm-brief'),
    map: document.getElementById('rm-map'),
    board: document.getElementById('rm-board'),
    statZones: document.getElementById('rm-stat-zones'),
    statCases: document.getElementById('rm-stat-cases'),
    statRegions: document.getElementById('rm-stat-regions'),
    embedCode: document.getElementById('rm-embed-code'),
    embedCopy: document.getElementById('rm-embed-copy'),
    embedStatus: document.getElementById('rm-embed-status')
  };

  var zones = [];
  var terrainBriefs = {};
  var bySlug = {};
  var dots = {};
  var current = null;

  // ---------- helpers ----------

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === 'className') node.className = attrs[key];
        else node.setAttribute(key, attrs[key]);
      });
    }
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function normalize(s) {
    var out = String(s || '').toLowerCase();
    if (out.normalize) out = out.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out = out.replace(/&/g, ' and ').replace(/\bmt\.?\s/g, 'mount ').replace(/[^a-z0-9]+/g, ' ').trim();
    Object.keys(SYNONYMS).forEach(function (key) {
      out = out.replace(new RegExp('\\b' + key + '\\b', 'g'), SYNONYMS[key]);
    });
    return out;
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function formatCoord(lat, lon) {
    return Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' +
      Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W');
  }

  function milesBetween(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLon = (lon2 - lon1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function siteUrl(path) {
    // Inside an embed, links open the full site in a new tab.
    return EMBED ? SITE + path : path;
  }

  function linkTarget(a) {
    if (EMBED) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
    return a;
  }

  function setStatus(message, warn) {
    els.status.textContent = message || '';
    els.status.classList.toggle('warn', Boolean(warn));
  }

  // ---------- search ----------

  function scoreZone(zone, query) {
    if (!query) return 0;
    var hay = zone._search;
    if (zone._name === query) return 1000;
    if (zone.regionCodes.some(function (c) { return c.toLowerCase() === query; })) return 400;
    if (zone._name.indexOf(query) === 0) return 600;
    if (zone._region.indexOf(query) === 0 || zone._region === query) return 450;
    var words = query.split(' ');
    var all = words.every(function (w) { return hay.indexOf(w) !== -1; });
    if (!all) return -1;
    var wordStart = (' ' + hay).indexOf(' ' + query) !== -1;
    return wordStart ? 300 : 150;
  }

  function search(raw) {
    var query = normalize(raw);
    if (!query) return zones.slice(0, 8);
    return zones
      .map(function (z) { return { z: z, s: scoreZone(z, query) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return (b.s - a.s) || (b.z.riskCount - a.z.riskCount) || a.z.name.localeCompare(b.z.name); })
      .slice(0, 12)
      .map(function (r) { return r.z; });
  }

  function renderResults(list, distances) {
    els.results.textContent = '';
    if (!list.length) {
      var empty = el('li', { className: 'rm-empty' });
      empty.appendChild(document.createTextNode('No documented zones match that search. That is not a safety rating: leave a '));
      var a = linkTarget(el('a', { href: siteUrl('/tools/trip-plan/' + (els.search.value ? '?destination=' + encodeURIComponent(els.search.value.slice(0, 120)) : '')), className: 'text-link' }, 'trip plan'));
      empty.appendChild(a);
      empty.appendChild(document.createTextNode(' wherever you go.'));
      els.results.appendChild(empty);
      return;
    }
    list.forEach(function (zone, i) {
      var li = el('li');
      var btn = el('button', { type: 'button', className: 'rm-result' + (current === zone ? ' is-active' : '') });
      var main = el('span', { className: 'rm-result-main' });
      main.appendChild(el('span', { className: 'rm-result-name' }, zone.name));
      var meta = zone.region + ' · ' + zone.unit;
      if (distances) meta = Math.round(distances[i]) + ' mi away · ' + zone.region;
      main.appendChild(el('span', { className: 'rm-result-meta' }, meta));
      btn.appendChild(main);
      btn.appendChild(el('span', { className: 'rm-count ' + TIER[zone.classification].cls, 'aria-label': plural(zone.riskCount, 'documented case') }, String(zone.riskCount)));
      btn.addEventListener('click', function () { select(zone, true); });
      li.appendChild(btn);
      els.results.appendChild(li);
    });
  }

  // ---------- brief card ----------

  function renderBrief(zone) {
    var card = els.brief;
    card.textContent = '';
    var tier = TIER[zone.classification];

    var head = el('div', { className: 'rm-brief-head' });
    head.appendChild(el('span', { className: 'rm-tier ' + tier.cls }, zone.classification));
    head.appendChild(el('h2', { id: 'rm-brief-title' }, zone.name));
    head.appendChild(el('p', { className: 'rm-brief-meta' }, zone.region + ' · ' + zone.unit));
    card.appendChild(head);

    var facts = el('dl', { className: 'rm-facts' });
    var f1 = el('div');
    f1.appendChild(el('dt', null, 'Documented cases'));
    f1.appendChild(el('dd', { className: 'rm-big ' + tier.cls }, String(zone.riskCount)));
    var f2 = el('div');
    f2.appendChild(el('dt', null, 'Approximate area centre'));
    f2.appendChild(el('dd', null, formatCoord(zone.lat, zone.lon)));
    facts.appendChild(f1);
    facts.appendChild(f2);
    card.appendChild(facts);

    if (zone.aliases && zone.aliases.length) {
      card.appendChild(el('p', { className: 'rm-note' }, 'Includes records filed as: ' + zone.aliases.join(', ') + '.'));
    }

    card.appendChild(el('h3', null, 'Why solo visitors lose contact here'));
    card.appendChild(el('p', null, zone.brief || terrainBriefs[zone.terrain] || ''));

    card.appendChild(el('h3', null, 'Before you go'));
    var list = el('ul', { className: 'check-list rm-checks' });
    [
      'Leave a trip plan with your route, return time and a deadline to call for help.',
      'Set a turnaround time and keep it, even if the summit or lake is close.',
      'Download offline maps. Phone GPS works with no cell service; texts and calls do not.',
      'In remote areas, carry a satellite messenger or personal locator beacon.'
    ].forEach(function (t) { list.appendChild(el('li', null, t)); });
    card.appendChild(list);

    var actions = el('div', { className: 'rm-actions' });
    var plan = linkTarget(el('a', {
      className: 'button button-primary',
      href: siteUrl('/tools/trip-plan/?destination=' + encodeURIComponent(zone.name))
    }, 'Build a Free Trip Plan for ' + zone.name + ' →'));
    var app = linkTarget(el('a', {
      className: 'button button-green',
      href: siteUrl('/download/?src=' + (EMBED ? 'tool_risk_map_embed' : 'tool_risk_map'))
    }, 'Get Offline GPS Trail + Overdue Alarms (Free App Trial) →'));
    actions.appendChild(plan);
    actions.appendChild(app);
    card.appendChild(actions);

    var share = el('button', { type: 'button', className: 'button button-secondary button-small rm-share' }, 'Copy link to this brief');
    share.addEventListener('click', function () {
      var url = SITE + '/tools/risk-map/?park=' + encodeURIComponent(zone.slug);
      copyText(url, function (ok) {
        share.textContent = ok ? 'Link copied' : 'Copy failed';
        window.setTimeout(function () { share.textContent = 'Copy link to this brief'; }, 2500);
      });
    });
    card.appendChild(share);

    card.appendChild(el('p', { className: 'fine-print rm-brief-fine' },
      'Counts are compiled public-record missing-person reports for safety awareness, not official or live National Park Service dispatch totals. A higher count does not mean a place is unsafe to visit.'));
  }

  function select(zone, fromUser) {
    if (!zone) return;
    if (current && dots[current.slug]) dots[current.slug].classList.remove('is-active');
    current = zone;
    renderBrief(zone);
    if (dots[zone.slug]) {
      var dot = dots[zone.slug];
      dot.classList.add('is-active');
      dot.parentNode.appendChild(dot); // bring to front
    }
    Array.prototype.forEach.call(els.results.querySelectorAll('.rm-result'), function (b) {
      b.classList.toggle('is-active', b.querySelector('.rm-result-name').textContent === zone.name);
    });
    if (fromUser) {
      try {
        var p = new URLSearchParams(window.location.search);
        p.set('park', zone.slug);
        window.history.replaceState(null, '', window.location.pathname + '?' + p.toString());
      } catch (e) { /* ignore */ }
      var top = els.brief.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        els.brief.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      els.brief.focus({ preventScroll: true });
    }
  }

  // ---------- geolocation ----------

  function locate() {
    if (!navigator.geolocation) {
      setStatus('Location is not available in this browser. Search for a park instead.', true);
      return;
    }
    setStatus('Finding your approximate location. It stays in this browser.');
    els.locate.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      els.locate.disabled = false;
      // Round to about 1 km: this is all the precision the lookup needs.
      var lat = Math.round(pos.coords.latitude * 100) / 100;
      var lon = Math.round(pos.coords.longitude * 100) / 100;
      var ranked = zones
        .map(function (z) { return { z: z, d: milesBetween(lat, lon, z.lat, z.lon) }; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 8);
      els.search.value = '';
      renderResults(ranked.map(function (r) { return r.z; }), ranked.map(function (r) { return r.d; }));
      var nearest = ranked[0];
      setStatus('Nearest documented zones to you. The closest is ' + nearest.z.name + ', about ' + Math.round(nearest.d) + ' miles away. Nothing was uploaded.');
      select(nearest.z, false);
    }, function (err) {
      els.locate.disabled = false;
      setStatus(err && err.code === 1
        ? 'Location permission was declined. Search for a park or state instead.'
        : 'Could not get your location. Search for a park or state instead.', true);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  }

  // ---------- map ----------

  // Very simplified outline of the lower 48 states [lon, lat]. Approximate, for orientation only.
  var US_OUTLINE = [
    [-124.7, 48.4], [-124.1, 46.9], [-123.9, 45.5], [-124.1, 44.0], [-124.5, 42.8], [-124.2, 41.9], [-124.4, 40.4],
    [-123.8, 39.6], [-123.0, 38.0], [-122.5, 37.7], [-121.9, 36.6], [-121.9, 36.3], [-120.6, 34.6], [-119.5, 34.4],
    [-118.5, 34.0], [-117.7, 33.5], [-117.1, 32.5], [-114.7, 32.7], [-111.0, 31.3], [-108.2, 31.3], [-108.2, 31.8],
    [-106.5, 31.8], [-104.9, 30.6], [-104.4, 29.6], [-103.3, 29.0], [-102.4, 29.8], [-101.4, 29.8], [-100.3, 28.3],
    [-99.5, 27.5], [-99.1, 26.4], [-97.4, 25.9], [-97.2, 27.6], [-96.0, 28.6], [-94.7, 29.3], [-93.8, 29.7],
    [-92.0, 29.6], [-90.9, 29.1], [-89.4, 28.9], [-89.6, 30.2], [-88.0, 30.4], [-86.5, 30.4], [-85.3, 29.7],
    [-84.2, 30.0], [-83.0, 29.1], [-82.6, 27.9], [-81.8, 26.1], [-80.9, 25.1], [-80.4, 25.2], [-80.0, 26.7],
    [-80.6, 28.4], [-81.3, 30.0], [-81.4, 31.0], [-80.9, 32.0], [-79.2, 33.2], [-78.0, 33.9], [-76.5, 34.7],
    [-75.5, 35.2], [-75.9, 36.6], [-76.3, 37.2], [-75.6, 37.9], [-75.0, 38.5], [-74.9, 38.9], [-74.0, 39.8],
    [-74.0, 40.5], [-71.9, 41.1], [-70.7, 41.5], [-70.0, 41.8], [-70.6, 42.6], [-70.7, 43.1], [-70.2, 43.7],
    [-69.0, 44.1], [-67.0, 44.8], [-67.8, 45.7], [-67.8, 47.1], [-68.9, 47.2], [-69.2, 47.4], [-70.0, 46.7],
    [-70.3, 45.9], [-71.5, 45.0], [-74.7, 45.0], [-75.3, 44.8], [-76.4, 44.1], [-76.2, 43.5], [-79.0, 43.3],
    [-79.0, 42.8], [-80.1, 42.2], [-82.5, 41.7], [-83.1, 42.3], [-82.4, 43.0], [-82.1, 44.5], [-83.5, 45.8],
    [-84.4, 46.5], [-86.0, 47.5], [-89.6, 48.0], [-91.4, 48.1], [-93.0, 48.6], [-94.7, 48.8], [-95.2, 49.4],
    [-95.2, 49.0], [-123.3, 49.0], [-122.8, 48.9], [-123.2, 48.2], [-124.7, 48.4]
  ];

  var VIEW = { w: 940, h: 560 };
  var MAIN = { lonMin: -125.5, lonMax: -65.5, latMin: 24, latMax: 51.5, x0: 20, y0: 20, sy: 19 };
  MAIN.sx = MAIN.sy * Math.cos(38 * Math.PI / 180);
  var AK = { lonMin: -170, lonMax: -129, latMin: 54, latMax: 71.5, x: 26, y: 432, w: 150, h: 112 };
  var HI = { lonMin: -160.5, lonMax: -154.5, latMin: 18.8, latMax: 22.4, x: 186, y: 484, w: 100, h: 60 };

  function projMain(lon, lat) {
    return [MAIN.x0 + (lon - MAIN.lonMin) * MAIN.sx, MAIN.y0 + (MAIN.latMax - lat) * MAIN.sy];
  }

  function projInset(box, lon, lat) {
    return [
      box.x + (lon - box.lonMin) / (box.lonMax - box.lonMin) * box.w,
      box.y + (box.latMax - lat) / (box.latMax - box.latMin) * box.h
    ];
  }

  function placeZone(z) {
    if (z.regionCodes.indexOf('AK') !== -1) return projInset(AK, z.lon, z.lat);
    if (z.regionCodes.indexOf('HI') !== -1) return projInset(HI, z.lon, z.lat);
    if (z.lon >= MAIN.lonMin && z.lon <= MAIN.lonMax && z.lat >= MAIN.latMin && z.lat <= MAIN.latMax) return projMain(z.lon, z.lat);
    return null;
  }

  function radius(count) {
    return 3.6 + Math.sqrt(count) * 2.5;
  }

  function buildMap() {
    var s = svg('svg', {
      viewBox: '0 0 ' + VIEW.w + ' ' + VIEW.h,
      role: 'group',
      'aria-labelledby': 'rm-map-title',
      preserveAspectRatio: 'xMidYMid meet'
    });
    var title = svg('title', { id: 'rm-map-title' });
    title.textContent = 'Map of documented missing-person zones in U.S. parks and wilderness areas, sized and coloured by case count';
    s.appendChild(title);

    var outline = US_OUTLINE.map(function (p, i) {
      var xy = projMain(p[0], p[1]);
      return (i ? 'L' : 'M') + xy[0].toFixed(1) + ' ' + xy[1].toFixed(1);
    }).join(' ') + ' Z';
    s.appendChild(svg('path', { d: outline, class: 'rm-land' }));

    [AK, HI].forEach(function (box, i) {
      s.appendChild(svg('rect', { x: box.x - 4, y: box.y - 4, width: box.w + 8, height: box.h + 8, rx: 8, class: 'rm-inset' }));
      var label = svg('text', { x: box.x - 2, y: box.y + box.h + 17, class: 'rm-inset-label' });
      label.textContent = i === 0 ? 'Alaska' : 'Hawaii';
      s.appendChild(label);
    });

    var plotted = zones.slice().sort(function (a, b) { return a.riskCount - b.riskCount; });
    var outside = 0;
    plotted.forEach(function (z) {
      var xy = placeZone(z);
      if (!xy) { outside++; return; }
      var c = svg('circle', {
        cx: xy[0].toFixed(1), cy: xy[1].toFixed(1), r: radius(z.riskCount).toFixed(1),
        fill: TIER[z.classification].color, class: 'rm-dot',
        tabindex: '0', role: 'button',
        'aria-label': z.name + ', ' + z.region + ': ' + plural(z.riskCount, 'documented case')
      });
      var t = svg('title', {});
      t.textContent = z.name + ' (' + plural(z.riskCount, 'case') + ')';
      c.appendChild(t);
      c.addEventListener('click', function () { select(z, true); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(z, true); }
      });
      dots[z.slug] = c;
      s.appendChild(c);
    });

    zones.slice(0, 3).forEach(function (z) {
      var xy = placeZone(z);
      if (!xy) return;
      var label = svg('text', { x: (xy[0] + radius(z.riskCount) + 4).toFixed(1), y: (xy[1] + 4).toFixed(1), class: 'rm-label' });
      label.textContent = z.name.replace(/ National Parks?$/, '');
      s.appendChild(label);
    });

    els.map.textContent = '';
    els.map.appendChild(s);
    var note = document.getElementById('rm-map-note');
    if (note && outside) {
      note.textContent = plural(outside, 'zone') + ' outside the map frame (Canada, Australia and the U.S. Virgin Islands) are included in search and the list. Outline and positions are approximate.';
    }
  }

  // ---------- leaderboard ----------

  function buildBoard() {
    els.board.textContent = '';
    zones.slice(0, 15).forEach(function (z, i) {
      var tr = el('tr');
      tr.appendChild(el('td', { className: 'rm-rank' }, String(i + 1)));
      var th = el('th', { scope: 'row' });
      var btn = el('button', { type: 'button', className: 'rm-link' }, z.name);
      btn.addEventListener('click', function () { select(z, true); });
      th.appendChild(btn);
      tr.appendChild(th);
      tr.appendChild(el('td', null, z.region));
      tr.appendChild(el('td', { className: 'rm-num' }, String(z.riskCount)));
      var tierCell = el('td');
      tierCell.appendChild(el('span', { className: 'rm-tier ' + TIER[z.classification].cls }, z.classification));
      tr.appendChild(tierCell);
      els.board.appendChild(tr);
    });
  }

  // ---------- embed ----------

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function fallbackCopy(text) {
    var area = el('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function setupEmbed() {
    if (!els.embedCopy) return;
    els.embedCopy.addEventListener('click', function () {
      copyText(els.embedCode.value, function (ok) {
        els.embedStatus.textContent = ok
          ? 'Embed code copied. Paste it into your site’s HTML.'
          : 'Select the code above and copy it manually.';
        if (!ok) els.embedCode.select();
      });
    });
  }

  // ---------- start ----------

  function init(doc) {
    zones = doc.zones || [];
    terrainBriefs = doc.terrainBriefs || {};
    zones.forEach(function (z) {
      z._name = normalize(z.name);
      z._region = normalize(z.region);
      z._search = normalize([z.name].concat(z.aliases || [], [z.region, z.unit]).join(' '));
      bySlug[z.slug] = z;
    });
    var regions = {};
    zones.forEach(function (z) { regions[z.region] = true; });
    els.statZones.textContent = String(zones.length);
    els.statCases.textContent = String(zones.reduce(function (s, z) { return s + z.riskCount; }, 0));
    els.statRegions.textContent = String(Object.keys(regions).length);

    buildMap();
    buildBoard();

    var q = params.get('q');
    if (q) els.search.value = q.slice(0, 80);
    renderResults(search(els.search.value));
    var fromUrl = bySlug[params.get('park') || ''];
    select(fromUrl || zones[0], false);
    root.classList.add('is-ready');
  }

  els.search.addEventListener('input', function () {
    setStatus('');
    renderResults(search(els.search.value));
  });
  els.search.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var first = search(els.search.value)[0];
      if (first && normalize(els.search.value)) select(first, true);
    }
  });
  els.locate.addEventListener('click', locate);
  setupEmbed();

  if (EMBED) {
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), linkTarget);
  }

  fetch(DATA_URL, { credentials: 'same-origin' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(init)
    .catch(function () {
      setStatus('The risk data could not load. Check your connection and refresh the page.', true);
    });
})();
