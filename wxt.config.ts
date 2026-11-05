import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-react'],
  // E2E builds swap in a fake speech engine (headless Chromium has no voices).
  vite: () => ({ define: { __E2E__: JSON.stringify(process.env.E2E === '1') } }),
  manifest: {
    name: 'Driftless Reader',
    short_name: 'Driftless',
    description:
      'ADHD-friendly reading: Drift Guard, anchor marker, read-aloud highlighting, Focus View, focus band and progress.',
    // Least-privilege: no host permissions. The reader is injected only into
    // the tab the user activates (toolbar click or keyboard shortcut).
    permissions: ['activeTab', 'scripting', 'storage'],
    // End-to-end tests can't "click" the toolbar to grant activeTab, so test
    // builds (E2E=1) get host access. Never set for store builds.
    ...(process.env.E2E === '1' ? { host_permissions: ['http://localhost/*'] } : {}),
    // No web_accessible_resources on purpose: anything listed there can be
    // fetched by any website, which lets sites detect the extension.
    // Strict CSP for our own pages (options, welcome, popup).
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
    action: {
      default_title: 'Driftless Reader',
    },
    // Up to four commands can suggest a default key; all are changeable at
    // edge://extensions/shortcuts (or chrome://extensions/shortcuts).
    // Chromium silently skips suggestions that clash with its own shortcuts
    // (Alt+Shift+R and Alt+Shift+C did), so these were verified to register.
    commands: {
      'toggle-reader': {
        suggested_key: { default: 'Alt+Shift+D' },
        description: 'Start or stop Driftless Reader on this page',
      },
      'read-aloud': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Read aloud: start, pause or resume',
      },
      'focus-band': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Turn the focus band on or off',
      },
      'chunk-mode': {
        suggested_key: { default: 'Alt+Shift+K' },
        description: 'Turn Chunk mode on or off',
      },
    },
  },
});
