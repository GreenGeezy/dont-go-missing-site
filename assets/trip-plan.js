/* Trip Plan Generator. Runs entirely in the browser: nothing is sent anywhere. */
(function () {
  'use strict';

  var STORAGE_KEY = 'dgm_trip_plan_v1';
  var form = document.getElementById('plan-form');
  if (!form) return;

  var els = {
    sub: document.getElementById('plan-sub'),
    list: document.getElementById('plan-list'),
    alert: document.getElementById('plan-alert'),
    sms: document.getElementById('sms-btn'),
    email: document.getElementById('email-btn'),
    copy: document.getElementById('copy-btn'),
    print: document.getElementById('print-btn'),
    share: document.getElementById('share-btn'),
    clear: document.getElementById('clear-btn'),
    status: document.getElementById('status')
  };

  var TEXT_FIELDS = ['name', 'phone', 'destination', 'trailhead', 'route', 'party', 'leave', 'back', 'vehicle', 'gear', 'notes'];

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /** Formats a Date for a datetime-local input (local time, no seconds). */
  function toInputValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function parseInput(value) {
    if (!value) return null;
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatDate(date) {
    try {
      return date.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch (e) {
      return date.toString();
    }
  }

  function radioValue(name) {
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : '';
  }

  function setRadio(name, value) {
    var inputs = form.querySelectorAll('input[name="' + name + '"]');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value === value) inputs[i].checked = true;
    }
  }

  function readState() {
    var state = {};
    TEXT_FIELDS.forEach(function (key) {
      state[key] = (form.elements[key].value || '').trim();
    });
    state.activity = radioValue('activity') || 'Hiking';
    state.grace = radioValue('grace') || '60';
    return state;
  }

  function applyState(state) {
    TEXT_FIELDS.forEach(function (key) {
      if (typeof state[key] === 'string') form.elements[key].value = state[key];
    });
    if (state.activity) setRadio('activity', state.activity);
    if (state.grace) setRadio('grace', String(state.grace));
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* private mode or storage disabled: the tool still works */ }
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setDefaults() {
    var now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    var back = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    form.elements.leave.value = toInputValue(now);
    form.elements.back.value = toInputValue(back);
  }

  /** Saved dates from an old trip are stale; reset them but keep everything else. */
  function refreshStaleDates() {
    var back = parseInput(form.elements.back.value);
    if (!back || back.getTime() < Date.now()) setDefaults();
  }

  function applyQueryParams() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    var leave = parseInput(params.get('leave'));
    var back = parseInput(params.get('back'));
    if (leave) form.elements.leave.value = toInputValue(leave);
    if (back) form.elements.back.value = toInputValue(back);
    var destination = params.get('destination');
    if (destination) form.elements.destination.value = destination.slice(0, 200);
  }

  function deadline(state) {
    var back = parseInput(state.back);
    if (!back) return null;
    return new Date(back.getTime() + parseInt(state.grace, 10) * 60 * 1000);
  }

  /** Label/value rows shown in the preview and used for the text version. */
  function rows(state) {
    var leave = parseInput(state.leave);
    var back = parseInput(state.back);
    var out = [];
    function add(label, value) {
      if (value) out.push([label, value]);
    }
    add('Who', state.name + (state.phone ? ' (' + state.phone + ')' : ''));
    add('Activity', state.activity);
    add('Destination', state.destination);
    add('Starting from', state.trailhead);
    add('Route', state.route);
    add('With', state.party);
    add('Leaving', leave ? formatDate(leave) : '');
    add('Back by', back ? formatDate(back) : '');
    add('Vehicle', state.vehicle);
    add('Wearing / carrying', state.gear);
    add('Notes', state.notes);
    return out.filter(function (row) { return row[1] && row[1].trim() !== ''; });
  }

  function alertText(state) {
    var due = deadline(state);
    if (!due) return '';
    return 'If you have not heard from me by ' + formatDate(due) +
      ', call or text me first. If you cannot reach me, call the local emergency number (911 in the US) ' +
      'or the sheriff or park dispatch for this area, and read them this plan.';
  }

  function planText(state) {
    var lines = ['TRIP PLAN: you are my safety contact for this trip.', ''];
    rows(state).forEach(function (row) {
      lines.push(row[0] + ': ' + row[1]);
    });
    var alert = alertText(state);
    if (alert) {
      lines.push('');
      lines.push(alert);
    }
    lines.push('');
    lines.push("I'll message you as soon as I'm out.");
    lines.push('');
    lines.push('Made with the free trip plan tool: https://dontgomissing.com/tools/trip-plan/');
    return lines.join('\n');
  }

  function isReady(state) {
    return Boolean(state.destination && parseInput(state.back));
  }

  function render() {
    var state = readState();
    saveState(state);

    var data = rows(state);
    els.list.textContent = '';
    data.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1];
      els.list.appendChild(dt);
      els.list.appendChild(dd);
    });

    var ready = isReady(state);
    els.sub.textContent = ready
      ? 'Send this to someone you trust before you leave.'
      : 'Add a destination and a return time to finish your plan.';

    var alert = alertText(state);
    els.alert.textContent = alert;
    els.alert.hidden = !alert;

    var text = planText(state);
    var subject = 'My trip plan' + (state.destination ? ': ' + state.destination : '');
    // "sms:?&body=" opens the composer on both iOS and Android.
    els.sms.href = 'sms:?&body=' + encodeURIComponent(text);
    els.email.href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);

    var back = parseInput(state.back);
    var leave = parseInput(state.leave);
    if (back && leave && back.getTime() <= leave.getTime()) {
      setStatus('Your return time is before your leaving time. Check the dates.', true);
    } else if (els.status.dataset.sticky !== 'true') {
      setStatus('');
    }
  }

  function setStatus(message, isWarning) {
    els.status.textContent = message || '';
    els.status.style.color = isWarning ? '#ff9c85' : '';
    els.status.dataset.sticky = 'false';
  }

  function flash(message) {
    els.status.textContent = message;
    els.status.style.color = '';
    els.status.dataset.sticky = 'true';
    window.setTimeout(function () {
      els.status.dataset.sticky = 'false';
      render();
    }, 3500);
  }

  function requireReady(event) {
    if (isReady(readState())) return true;
    if (event) event.preventDefault();
    setStatus('Add a destination and a return time first.', true);
    form.elements.destination.focus();
    return false;
  }

  function copyPlan() {
    if (!requireReady()) return;
    var text = planText(readState());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        flash('Copied. Paste it into a message to your contact.');
      }, function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    flash(ok ? 'Copied. Paste it into a message to your contact.' : 'Could not copy automatically. Use Email or Print instead.');
  }

  function sharePlan() {
    if (!requireReady()) return;
    var state = readState();
    navigator.share({ title: 'My trip plan', text: planText(state) }).catch(function () { /* user cancelled */ });
  }

  function clearForm() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
    form.reset();
    setDefaults();
    render();
    flash('Form cleared.');
  }

  // ---- Start up ----
  setDefaults();
  var saved = loadState();
  if (saved) applyState(saved);
  refreshStaleDates();
  applyQueryParams();

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  els.sms.addEventListener('click', requireReady);
  els.email.addEventListener('click', requireReady);
  els.copy.addEventListener('click', copyPlan);
  els.print.addEventListener('click', function () {
    if (requireReady()) window.print();
  });
  els.clear.addEventListener('click', clearForm);

  if (navigator.share) {
    els.share.hidden = false;
    els.share.addEventListener('click', sharePlan);
  }

  render();
})();
