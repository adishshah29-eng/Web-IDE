import { WebContainer } from "@webcontainer/api";

// Only one WebContainer can run per browser tab (it owns a persistent
// service worker), and booting is expensive — so this is a singleton shared
// across the whole app, not per-project. Switching projects doesn't reboot
// it; only the mounted files change.
let bootPromise: Promise<WebContainer> | null = null;

type DevServerListener = (url: string | null) => void;
const devServerListeners = new Set<DevServerListener>();
let currentDevServerUrl: string | null = null;

export function getWebContainer(): Promise<WebContainer> {
  if (!bootPromise) {
    bootPromise = WebContainer.boot().then((wc) => {
      wc.on("server-ready", (_port, url) => {
        currentDevServerUrl = url;
        devServerListeners.forEach((l) => l(url));
      });
      wc.on("port", (_port, type) => {
        if (type === "close") {
          currentDevServerUrl = null;
          devServerListeners.forEach((l) => l(null));
        }
      });
      return wc;
    });
  }
  return bootPromise;
}

// Lets any page show "npm run dev is live at ..." without needing to have
// been the one that opened the Terminal or ran the command — the dev server
// could've been started from the Terminal tab or by the agent's run_command.
export function subscribeDevServerUrl(listener: DevServerListener): () => void {
  devServerListeners.add(listener);
  listener(currentDevServerUrl);
  return () => devServerListeners.delete(listener);
}
