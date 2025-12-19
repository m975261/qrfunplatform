import { app, createServer, startServer } from "./app";
import { serveStatic } from "./static";

(async () => {
  const server = await createServer();

  if (process.env.NODE_ENV === "development") {
    const viteModule = "./vite";
    const { setupVite } = await import(/* @vite-ignore */ viteModule);
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  startServer(server);
})();
