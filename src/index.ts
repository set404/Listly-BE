import http from "http";
import { createApp } from "./app";
import { env } from "./env";
import { initRealtime } from "./realtime";

const app = createApp();
const server = http.createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  console.log(`Listly API listening on http://localhost:${env.PORT}`);
});
