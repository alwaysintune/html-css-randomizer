import { createRequire } from "module";
const require = createRequire(import.meta.url);

import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cookieParser from "cookie-parser";
const perimeterx = require("perimeterx-node-express");
import { cryptoService } from "../../services/cryptography";
import {
  BUFFER_ENCODING,
  PRIVATE_KEY,
  PROXY_ADDRESS,
  PROXY_HOST,
  PROXY_PORT,
  PUBLIC_KEY,
  PX_APP_ID,
  PX_COOKIE_ENCRYPTION_KEY,
  PX_TOKEN,
  SERVER_ADDRESS,
} from "../../sharedConstants";

const crypto = cryptoService(PUBLIC_KEY, PRIVATE_KEY, "top secret");

const decryptPath = (path) => {
  const encryptedPathBuffer = Buffer.from(path, BUFFER_ENCODING);
  try {
    const decryptedPath = crypto
      .decryptText(encryptedPathBuffer)
      .toString("utf-8");

    return decryptedPath;
  } catch {
    return path;
  }
};

const app = express();

app.use(cookieParser());

if (PX_APP_ID && PX_COOKIE_ENCRYPTION_KEY && PX_TOKEN) {
  const pxConfig = {
    px_app_id: "",
    px_cookie_secret: "",
    px_auth_token: "",
    px_module_enabled: true, // enable enforcer
    px_module_mode: "active_blocking",
    px_blocking_score: 100,
    px_send_async_activities_enabled: true,
  };
  perimeterx.init(pxConfig);
  app.use(perimeterx.middleware);
}

const apiProxy = createProxyMiddleware({
  target: SERVER_ADDRESS,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, _res) => {
    if (!req.headers.referer?.startsWith(PROXY_ADDRESS)) {
      proxyReq.setHeader("referer", PROXY_ADDRESS);
    }
  },
  pathRewrite: (receivedPath, req) => {
    const referer = req.headers.referer;
    if (!(referer && referer.startsWith(PROXY_ADDRESS))) {
      return "/index.html";
    }

    const encryptedPath = receivedPath.slice(1);
    const decryptedPath = decryptPath(encryptedPath);

    // TODO: fix
    if (
      decryptedPath.startsWith("fonts") ||
      decryptedPath.startsWith("favicon")
    ) {
      return "static/oscar/" + decryptedPath;
    }

    return decryptedPath;
  },
});
app.use(apiProxy);

const startProxyServer = () => {
  return app.listen(PROXY_PORT, PROXY_HOST, () => {
    console.log(`Starting Proxy at ${PROXY_HOST}:${PROXY_PORT}`);
  });
};

export const transparentProxy = {
  _server: null,
  startServer() {
    const server = startProxyServer();
    this._server = server;
  },
  stopServer() {
    if (!this._server) return;

    this._server.close((err) => {
      console.log(`Stopping Proxy at ${PROXY_HOST}:${PROXY_PORT}`);
      process.exit(err ? 1 : 0);
    });
  },
};
