/* Hiking time and turnaround calculator. Runs entirely in the browser. */
(function () {
  'use strict';

  var form = document.getElementById('hike-form');
  if (!form) return;

  var out = {
    total: document.getElementById('r-total'),
    totalNote: document.getElementById('r-total-note'),
    moving: document.getElementById('r-moving'),
    finish: document.getElementById('r-finish'),
    keyLabel: document.getElementById('r-key-label'),
    key: document.getElementById('r-key'),
    keyNote: document.getElementById('r-key-note'),
    warning: document.getElementById('r-warning'),
    planLink: document.getElementById('plan-link'),
    distanceUnit: document.getElementById('distance-unit'),
    gainUnit: document.getElementById('gain-unit')
  };

  var KM_PER_MILE = 1.609344;
  var M_PER_FOOT = 0.3048;
  var SAFETY_BUFFER_MIN = 30;

  function radio(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function num(id) {
    var value = parseFloat(form.elements[id].value);
    return isFinite(value) && value >= 0 ? value : 0;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function toInputValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  /** Combines today's date with an HH:MM time input. */
  function timeToday(value) {
    if (!value) return null;
    var parts = value.split(':');
    if (parts.length < 2) return null;
    var date = new Date();
    date.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  function formatClock(date) {
    try {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
  }

  function formatDuration(minutes) {
    var total = Math.max(0, Math.round(minutes));
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    if (hours === 0) return mins + ' min';
    return hours + ' h ' + pad(mins) + ' min';
  }

  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  /** Rounds a time down to the nearest 5 minutes, so advice errs on the early side. */
  function floorToFive(date) {
    var copy = new Date(date.getTime());
    copy.setMinutes(Math.floor(copy.getMinutes() / 5) * 5, 0, 0);
    return copy;
  }

  function updateUnits() {
    var imperial = radio('units') === 'imperial';
    out.distanceUnit.textContent = imperial ? 'miles' : 'km';
    out.gainUnit.textContent = imperial ? 'feet' : 'metres';
  }

  function calculate() {
    updateUnits();

    var imperial = radio('units') === 'imperial';
    var distanceKm = num('distance') * (imperial ? KM_PER_MILE : 1);
    var gainM = num('gain') * (imperial ? M_PER_FOOT : 1);
    var speedKmh = parseFloat(radio('pace')) || 5;
    var terrain = parseFloat(radio('terrain')) || 1;
    var breakPerHour = parseFloat(radio('breaks')) || 0;
    var routeType = radio('route') || 'outback';

    if (distanceKm <= 0) {
      out.total.textContent = '--';
      out.moving.textContent = '--';
      out.finish.textContent = '--';
      out.key.textContent = '--';
      out.totalNote.textContent = 'Enter a distance to get an estimate.';
      out.keyNote.textContent = '';
      out.warning.hidden = true;
      out.planLink.href = '/tools/trip-plan/';
      return;
    }

    // Naismith's rule: 1 hour per 5 km at an average pace, plus 1 hour per 600 m climbed.
    var flatMin = (distanceKm / speedKmh) * 60 * terrain;
    var climbMin = (gainM / 600) * 60 * terrain;
    var movingMin = flatMin + climbMin;
    var breakFactor = 1 + breakPerHour / 60;
    var totalMin = movingMin * breakFactor;

    out.moving.textContent = formatDuration(movingMin);
    out.total.textContent = formatDuration(totalMin);
    out.totalNote.textContent = breakPerHour > 0
      ? 'Includes about ' + breakPerHour + ' minutes of breaks per hour.'
      : 'Moving time only. Add time for breaks, photos and lunch.';

    var start = timeToday(form.elements.start.value);
    var deadline = timeToday(form.elements.deadline.value);
    var finish = start ? addMinutes(start, totalMin) : null;
    out.finish.textContent = finish ? formatClock(finish) : '--';

    var warnings = [];

    if (routeType === 'outback') {
      // Out leg carries the climb; the return leg is the same distance without it.
      var outMin = (flatMin / 2 + climbMin) * breakFactor;
      var backMin = (flatMin / 2) * breakFactor;
      out.keyLabel.textContent = 'Turn around by';

      if (deadline) {
        var turnaround = floorToFive(addMinutes(deadline, -(backMin + SAFETY_BUFFER_MIN)));
        out.key.textContent = formatClock(turnaround);
        out.keyNote.textContent = 'Wherever you are at this time, head back. The return leg takes about ' +
          formatDuration(backMin) + ', plus a ' + SAFETY_BUFFER_MIN + '-minute buffer.';

        if (start) {
          var reachTop = addMinutes(start, outMin);
          if (turnaround.getTime() <= start.getTime()) {
            warnings.push('There is not enough time for this hike before your deadline. Start earlier or pick a shorter route.');
          } else if (reachTop.getTime() > turnaround.getTime()) {
            warnings.push('At this pace you would reach the far point around ' + formatClock(reachTop) +
              ', after your turnaround time. Start earlier, or plan to turn around before you get there.');
          }
        }
      } else {
        out.key.textContent = '--';
        out.keyNote.textContent = 'Add the time you must be back at the car to get a turnaround time.';
      }
    } else {
      out.keyLabel.textContent = 'Start no later than';
      if (deadline) {
        var latestStart = floorToFive(addMinutes(deadline, -(totalMin + SAFETY_BUFFER_MIN)));
        out.key.textContent = formatClock(latestStart);
        out.keyNote.textContent = 'This leaves a ' + SAFETY_BUFFER_MIN + '-minute buffer before your deadline.';
        if (start && start.getTime() > latestStart.getTime()) {
          warnings.push('Starting at ' + formatClock(start) + ' would put you out after your deadline. Start earlier or shorten the route.');
        }
      } else {
        out.key.textContent = '--';
        out.keyNote.textContent = 'Add the time you must be finished to see the latest safe start.';
      }
    }

    if (finish && deadline && finish.getTime() > deadline.getTime() && warnings.length === 0) {
      warnings.push('Your estimated finish is after your deadline. Start earlier or shorten the route.');
    }

    out.warning.hidden = warnings.length === 0;
    out.warning.textContent = warnings.join(' ');

    // Hand the times to the trip plan tool: return time is the estimated finish plus an hour of slack.
    if (start && finish) {
      var returnBy = addMinutes(finish, 60);
      out.planLink.href = '/tools/trip-plan/?leave=' + encodeURIComponent(toInputValue(start)) +
        '&back=' + encodeURIComponent(toInputValue(returnBy));
    } else {
      out.planLink.href = '/tools/trip-plan/';
    }
  }

  form.addEventListener('input', calculate);
  form.addEventListener('change', calculate);
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  calculate();
})();
