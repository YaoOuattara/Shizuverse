import type { CapacitorConfig } from '@capacitor/cli';

// Mode URL distante : la webview charge le site de production, pas un export
// statique. `capacitor-www/` n'est qu'un placeholder exigé par `cap sync`.
const config: CapacitorConfig = {
  appId: 'pro.shizu.app',
  appName: 'Shizu',
  webDir: 'capacitor-www',
  server: {
    url: 'https://www.shizu.pro',
    cleartext: false,
    // Seuls shizu.pro et ses sous-domaines restent dans la webview ; toute
    // autre navigation est ouverte hors de l'app par Capacitor.
    allowNavigation: ['shizu.pro', '*.shizu.pro'],
  },
};

export default config;
