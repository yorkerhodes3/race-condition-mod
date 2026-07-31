/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Operator Console for the Race Condition demo.
 *
 * Static, zero-dependency page that deploys alongside the app (GitHub Pages).
 * It CONFIGURES the demo by composing a deep link (scenario seams + demo +
 * debug) and (re)loading the embedded app, CONTROLS it live via a same-origin
 * postMessage bridge (see DemoService.onConsoleMessage), and SHOWS current
 * state by reading the app frame's globals (window.ENV, window.__csActiveDemoKey).
 */
(function () {
  'use strict';

  var SEAM_IDS = ['scenario', 'theme', 'route', 'groups', 'mingle', 'movement'];

  // Base settings per scenario. Selecting a preset sets every seam field to these.
  var SCENARIO_PRESETS = {
    vegas: {
      scenario: 'vegas',
      theme: 'vegas-neon',
      route: 'vegas-marathon',
      groups: 'vegas-independent',
      mingle: 'vegas-none',
      movement: 'vegas-foot',
      demo: '',
    },
    mariupol: {
      scenario: 'mariupol',
      theme: 'mariupol-siege',
      route: 'mariupol-corridor',
      groups: 'mariupol-households',
      mingle: 'mariupol-siege',
      movement: 'mariupol-mixed',
      demo: 'none',
    },
    paris: {
      scenario: 'paris',
      theme: '',
      route: '',
      groups: '',
      mingle: '',
      movement: '',
      demo: 'none',
    },
  };

  // Right-panel card content, keyed by the active Site id.
  var SCENARIO_CARDS = {
    vegas:
      '<span class="sc-badge sc-vegas">Marathon</span>' +
      '<h3>Las Vegas Strip Marathon</h3>' +
      '<p>A 26.2-mile neon-night loop with ~10,000 runners — the original ' +
      'festive scenario.</p>',
    mariupol:
      '<span class="sc-badge sc-mariupol">Evacuation</span>' +
      '<h3>Mariupol Evacuation</h3>' +
      '<p>Schematic evacuation twin: a single humanitarian corridor out of the ' +
      'city, households moving together, and danger / shelter zones. ' +
      '<em>Representative synthetic data — retrospective planning &amp; ' +
      'education, not operational.</em></p>',
    paris:
      '<span class="sc-badge sc-mariupol">Case study</span>' +
      '<h3>Paris · Evacuation (case study)</h3>' +
      '<p>Real OSM buildings (Marais / Île de la Cité / Bastille), five origin ' +
      'zones, two exits, 12,000 people. <em>Building geometry is real; zones, ' +
      'routes and demographics are illustrative — modelling exercise, not ' +
      'operational.</em></p>',
  };

  var $ = function (id) {
    return document.getElementById(id);
  };
  var stage = $('stage');

  // App root is the directory that serves index.html (same dir as this page).
  function appBaseUrl() {
    return new URL('./', window.location.href);
  }

  // Compose the deep link from the current form state. Only non-default values
  // are added, so the query stays clean and readable.
  function buildUrl() {
    var url = appBaseUrl();
    var params = new URLSearchParams();
    var demo = $('demo').value;
    if (demo) params.set('demo', demo);
    for (var i = 0; i < SEAM_IDS.length; i++) {
      var el = $(SEAM_IDS[i]);
      if (el && el.value) params.set(el.dataset.param, el.value);
    }
    if ($('debug').checked) params.set('debug', 'true');
    var qs = params.toString();
    url.search = qs ? '?' + qs : '';
    return url;
  }

  function refreshDeepLink() {
    var href = buildUrl().href;
    $('deeplink').textContent = href;
    var link = $('stLink');
    link.textContent = 'Link: ' + (buildUrl().search || '(defaults)');
    link.title = href;
    return href;
  }

  function apply() {
    var href = refreshDeepLink();
    // Reload the embedded app with the composed configuration. Scenario seams
    // resolve at load, so a reload is required for them to take effect.
    stage.src = href;
  }

  // Send a whitelisted live command to the embedded app (no reload).
  function cmd(action, value) {
    try {
      if (stage.contentWindow) {
        stage.contentWindow.postMessage(
          { source: 'race-console', action: action, value: value },
          window.location.origin,
        );
      }
    } catch (e) {
      /* ignore cross-origin/navigation races */
    }
  }

  // Read current state directly from the (same-origin) app frame.
  function pollState() {
    var mode = '—';
    var active = '—';
    try {
      var w = stage.contentWindow;
      if (w) {
        var env = w.ENV || {};
        mode = env.NG_APP_GATEWAY_URL ? 'Live' : 'Cached';
        active = w.__csActiveDemoKey || '—';
      }
    } catch (e) {
      /* app still navigating; keep last known */
      return;
    }
    $('stMode').textContent = 'Mode: ' + mode;
    $('stActiveDemo').textContent = 'Demo: ' + active;
  }
  // Apply a scenario preset to every seam field.
  function applyPreset(key) {
    var preset = SCENARIO_PRESETS[key];
    if (!preset) return;
    for (var i = 0; i < SEAM_IDS.length; i++) {
      var el = $(SEAM_IDS[i]);
      if (el && preset[SEAM_IDS[i]] !== undefined) el.value = preset[SEAM_IDS[i]];
    }
    if (preset.demo !== undefined) $('demo').value = preset.demo;
    refreshDeepLink();
    renderCard();
  }

  // Render the right-panel scenario card from the active Site selection.
  function renderCard() {
    var site = $('scenario').value || 'vegas';
    $('scenarioCard').innerHTML = SCENARIO_CARDS[site] || SCENARIO_CARDS.vegas;
  }

  // ── Console light / dark theme ──────────────────────────────────────────────
  var THEME_KEY = 'race-console-theme';

  function applyTheme(theme) {
    var light = theme === 'light';
    document.body.classList.toggle('light', light);
    var btn = $('themeToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', light ? 'true' : 'false');
      var icon = btn.querySelector('.tt-icon');
      var label = btn.querySelector('.tt-label');
      if (icon) icon.textContent = light ? '\u25d0' : '\u25d1';
      if (label) label.textContent = light ? 'Light' : 'Dark';
    }
  }

  function initTheme() {
    var saved = 'dark';
    try {
      saved = localStorage.getItem(THEME_KEY) || 'dark';
    } catch (e) {
      /* storage blocked; default to dark */
    }
    applyTheme(saved);
    var btn = $('themeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        var next = document.body.classList.contains('light') ? 'dark' : 'light';
        applyTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch (e) {
          /* storage blocked; theme still applies for this session */
        }
      });
    }
  }
  // ── Wiring ────────────────────────────────────────────────────────────────
  function init() {
    initTheme();
    // Satellite before/after: link out to the ETC / Christine Lumen feasibility
    // view (real UNOSAT damage + Esri Wayback imagery). Linked, not re-hosted,
    // to respect Esri Wayback provider terms.
    var sat = $('satBtn');
    if (sat) {
      sat.addEventListener('click', function () {
        window.open(
          'https://ethical-tech-colab.github.io/mariupol-evacuation-model/',
          '_blank',
          'noopener',
        );
      });
    }
    $('apply').addEventListener('click', apply);
    $('open').addEventListener('click', function () {
      window.open(buildUrl().href, '_blank', 'noopener');
    });
    $('copy').addEventListener('click', function () {
      var href = buildUrl().href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(href).then(function () {
          var b = $('copy');
          var prev = b.textContent;
          b.textContent = 'Copied!';
          setTimeout(function () {
            b.textContent = prev;
          }, 1200);
        });
      }
    });

    // Live command buttons (camera / mode / panels / reset).
    var liveButtons = document.querySelectorAll('[data-cmd]');
    for (var i = 0; i < liveButtons.length; i++) {
      liveButtons[i].addEventListener('click', function (ev) {
        var t = ev.currentTarget;
        cmd(t.getAttribute('data-cmd'), t.getAttribute('data-val') || '');
      });
    }

    // Keep the deep-link preview live as the operator edits the form.
    var inputs = ['demo', 'debug'].concat(SEAM_IDS);
    for (var j = 0; j < inputs.length; j++) {
      var el = $(inputs[j]);
      if (el) el.addEventListener('change', refreshDeepLink);
    }

    // Scenario preset applies base settings to every seam field at once.
    $('preset').addEventListener('change', function () {
      if ($('preset').value) applyPreset($('preset').value);
    });
    // Editing any seam by hand drops back to "custom" and refreshes the card.
    for (var k = 0; k < SEAM_IDS.length; k++) {
      var se = $(SEAM_IDS[k]);
      if (se)
        se.addEventListener('change', function () {
          $('preset').value = '';
          renderCard();
        });
    }

    // Optional live-state reply from the app bridge.
    window.addEventListener('message', function (e) {
      if (e.origin !== window.location.origin) return;
      var d = e.data;
      if (d && d.source === 'race-app' && d.activeDemo) {
        $('stActiveDemo').textContent = 'Demo: ' + d.activeDemo;
      }
    });

    // Seed the initial state, load the app with defaults, and start polling.
    refreshDeepLink();
    renderCard();
    stage.src = appBaseUrl().href;
    setInterval(pollState, 1500);
    setInterval(function () {
      cmd('getState', '');
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
