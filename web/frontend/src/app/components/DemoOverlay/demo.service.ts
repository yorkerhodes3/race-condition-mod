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

import { Injectable, OnDestroy, signal } from '@angular/core';
import { DEMO_HOTKEYS, DEMO_IDS, DemoId } from '../../../constants';

@Injectable({ providedIn: 'root' })
export class DemoService implements OnDestroy {
  readonly activeDemo = signal<DemoId>('Sandbox');
  readonly showAlternativePanels = signal<boolean>(false);
  readonly reset = signal<number>(0);
  /** Incremented on Ctrl+l; AgentScreen toggles cached replay. */
  readonly cachedMessagesToggle = signal(0);

  /** Incremented on each Ctrl+L mode feedback pulse; Hud recreates the corner flash animation. */
  readonly modeSwitchFlashGen = signal(0);
  /** Bottom-right label after Ctrl+L; cleared after {@link MODE_SWITCH_LABEL_MS}. */
  readonly modeSwitchLabel = signal<string | null>(null);

  private static readonly MODE_SWITCH_LABEL_MS = 3000;
  private modeSwitchLabelClearTimer?: ReturnType<typeof setTimeout>;

  /** Ctrl+5/7 map to 5a/7a; Ctrl+Shift+5/7 map to 5b/7b. Other digit hotkeys align by index with DEMO_IDS. */
  private demoIdFromHotkey(e: KeyboardEvent): DemoId | undefined {
    const { key, shiftKey } = e;
    if (key === '5') return shiftKey ? '5b' : '5a';
    if (key === '7') return shiftKey ? '7b' : '7a';
    const idx = DEMO_HOTKEYS.indexOf(key);
    if (idx < 0 || key === 'd' || key === 'r') return undefined;
    return DEMO_IDS[idx];
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && DEMO_HOTKEYS.includes(e.key)) {
      if (e.key === 'a' || e.key === 's' || e.key === 'd') {
        const cameras = ['a', 's', 'd'];
        const index = cameras.findIndex((v) => v === e.key);
        const item = {
          id: 'camera',
          icon: 'videocam',
          active: true,
          alwaysActive: true,
          options: ['Camera A', 'Camera B', 'Camera C'],
          optionIndex: 0,
          prevLabel: '',
          animating: false,
        };

        window.dispatchEvent(
          new CustomEvent('filter:changed', {
            detail: { id: item.id, value: item.options[index], index: index },
          }),
        );
      }
      if (e.key === 'd') {
        this.showAlternativePanels.set(!this.showAlternativePanels());
        return;
      }
      if (e.key === 'l') {
        this.cachedMessagesToggle.update((n) => n + 1);
        return;
      }
      const nextId = this.demoIdFromHotkey(e);
      if (e.key === 'r' || nextId === this.activeDemo()) {
        this.reset.update((n) => n + 1);
        return;
      }
      if (nextId !== undefined) {
        this.activeDemo.set(nextId);
        this.syncActiveDemoKeyForDebugDump();
      }
    }
  };

  /**
   * Same-origin control bridge for the Operator Console (public/console.html).
   * Accepts a small whitelist of commands via `postMessage` and triggers the
   * exact same actions as the keyboard shortcuts — no new behavior, just remote
   * triggers. Cross-origin and unrecognised messages are ignored.
   */
  private onConsoleMessage = (e: MessageEvent): void => {
    if (e.origin !== window.location.origin) return;
    const d = e.data as { source?: string; action?: string; value?: string } | null;
    if (!d || d.source !== 'race-console' || typeof d.action !== 'string') return;
    switch (d.action) {
      case 'selectDemo':
        if (d.value && (DEMO_IDS as readonly string[]).includes(d.value)) {
          this.select(d.value as DemoId);
        }
        break;
      case 'reset':
        this.reset.update((n) => n + 1);
        break;
      case 'toggleCached':
        this.cachedMessagesToggle.update((n) => n + 1);
        break;
      case 'togglePanels':
        this.showAlternativePanels.set(!this.showAlternativePanels());
        break;
      case 'camera': {
        const label = (d.value ?? '').toUpperCase();
        const index = { A: 0, B: 1, C: 2, W: 3 }[label];
        if (index !== undefined) {
          window.dispatchEvent(
            new CustomEvent('filter:changed', {
              detail: { id: 'camera', value: `Camera ${label}`, index },
            }),
          );
        }
        break;
      }
      case 'getState': {
        const target = e.source as WindowProxy | null;
        try {
          target?.postMessage(
            {
              source: 'race-app',
              activeDemo: this.activeDemo(),
              altPanels: this.showAlternativePanels(),
            },
            e.origin,
          );
        } catch {
          /* ignore */
        }
        break;
      }
    }
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('message', this.onConsoleMessage);
    this.syncActiveDemoKeyForDebugDump();
    this.maybeAutoStartDemo();
  }

  /**
   * Optionally auto-run a demo on load so visitors see a race without pressing
   * a hotkey. Source (in priority order): `?demo=<id>` query param, then
   * `window.ENV.AUTO_DEMO` (config.js). A short delay lets the 3D scene settle
   * before switching from the Sandbox intro.
   */
  private maybeAutoStartDemo(): void {
    const fromQuery = new URLSearchParams(window.location.search).get('demo');
    const fromEnv = (window as unknown as { ENV?: { AUTO_DEMO?: string } }).ENV?.AUTO_DEMO;
    const raw = (fromQuery ?? fromEnv ?? '').trim();
    if (!raw) return;
    if (!(DEMO_IDS as readonly string[]).includes(raw)) return;
    const id = raw as DemoId;
    if (id === this.activeDemo()) return;
    setTimeout(() => this.select(id), 2500);
  }

  ngOnDestroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('message', this.onConsoleMessage);
    if (this.modeSwitchLabelClearTimer !== undefined) {
      clearTimeout(this.modeSwitchLabelClearTimer);
      this.modeSwitchLabelClearTimer = undefined;
    }
  }

  /** Flash bottom-left + show bottom-right label (hotkey path only). */
  showModeSwitchFeedback(isCached: boolean): void {
    this.modeSwitchFlashGen.update((n) => n + 1);
    this.modeSwitchLabel.set(isCached ? 'Switched to Cached Mode' : 'Switched to Live Mode');
    if (this.modeSwitchLabelClearTimer !== undefined) {
      clearTimeout(this.modeSwitchLabelClearTimer);
    }
    this.modeSwitchLabelClearTimer = setTimeout(() => {
      this.modeSwitchLabel.set(null);
      this.modeSwitchLabelClearTimer = undefined;
    }, DemoService.MODE_SWITCH_LABEL_MS);
  }

  select(id: DemoId) {
    if (this.activeDemo() === id) {
      this.reset.update((n) => n + 1);
      return;
    }
    this.activeDemo.set(id);
    this.syncActiveDemoKeyForDebugDump();
  }

  /** Used by agent-gateway-message-dump for download filenames. */
  private syncActiveDemoKeyForDebugDump(): void {
    try {
      if (typeof window !== 'undefined') {
        window.__csActiveDemoKey = this.activeDemo();
      }
    } catch {
      /* ignore */
    }
  }
}
