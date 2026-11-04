import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: '.',
  modules: ['@wxt-dev/module-react'],
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
    // Bundled reading fonts (SIL OFL), fetched by the content script as bytes.
    web_accessible_resources: [{ resources: ['fonts/*.woff2'], matches: ['<all_urls>'] }],
    action: {
      default_title: 'Driftless Reader',
    },
    commands: {
      'toggle-reader': {
        suggested_key: { default: 'Alt+Shift+R' },
        description: 'Start or stop Driftless Reader on this page',
      },
    },
  },
});
