// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// Runtime configuration read by the app at startup (window.ENV).
//
// LOCAL DEV: the Go frontend BFF serves /config.js dynamically and OVERRIDES
// this file, so these values only apply to static hosting (GitHub Pages,
// `ng serve`). Edit freely for your deployment — no rebuild needed.
window.ENV = {
  // REST base for the Race Condition gateway. Point at your DTSF twin to drive
  // the control plane (spawn / sessions / reset / agent-types). An https page
  // may call http://localhost (localhost is a secure context), so a locally
  // running DTSF works from the deployed site on your machine. For a
  // server-hosted twin use "https://<host>/race-condition".
  NG_APP_GATEWAY_ADDR: 'http://localhost:8080/race-condition',

  // The twin serves no live WebSocket; leave empty so the app stays in Cached
  // mode for the event stream (the recorded race replays client-side).
  NG_APP_GATEWAY_URL: '',

  // Auto-run a demo on load so visitors see a race immediately.
  // DemoId one of: Sandbox, 1, 2, 3, 4, 5a, 5b, 7a, 7b. Empty string disables.
  // Overridable per-visit via ?demo=<id> in the URL.
  AUTO_DEMO: '4',
};
