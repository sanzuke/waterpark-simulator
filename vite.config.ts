import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// The editor can serve the preview under /game-runtime/<projectId>/ (when it is
// opened through a tunnel) and strips that prefix before the request gets here.
// The dev server writes rooted URLs, so it uses the prefix as its base and puts
// it back on requests that arrive without it. Builds stay relative.
const projectId = path.basename(path.dirname(process.cwd()));
const devBase = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(projectId) ? `/game-runtime/${projectId}/` : "/";

function previewPrefix(): Plugin {
  const restore = (req: { url?: string }) => {
    if (req.url && !req.url.startsWith(devBase)) req.url = devBase + req.url.slice(1);
  };
  return {
    name: "preview-prefix",
    apply: "serve",
    configureServer(server) {
      if (devBase === "/") return;
      server.middlewares.use((req, _res, next) => {
        restore(req);
        next();
      });
      server.httpServer?.prependListener("upgrade", restore);
    },
  };
}

export default defineConfig(({ command, isPreview }) => ({
  base: command === "serve" && !isPreview ? devBase : "./",
  plugins: [previewPrefix()],
  server: { host: process.env.HOST ?? "0.0.0.0", port: Number(process.env.PORT ?? 5173), allowedHosts: true },
  build: { chunkSizeWarningLimit: 1200 },
}));
