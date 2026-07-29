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

import { defineConfig } from 'vitest/config';

// Minimal, CI-stable vitest setup. Scope is deliberately narrow: only the pure,
// dependency-free scenario/theme modules are exercised here so the suite runs in
// a plain Node environment without three.js/WebGL or a browser DOM. Broaden the
// include list only for modules that are safe to import outside a browser.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/app/scenarios/**/*.spec.ts'],
  },
});
