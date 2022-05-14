import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import { promises as fsp } from "fs";

import { ContentTypeHelper } from "../../utils/contentTypeHelper";
import { randomizeCss, randomizeHtml } from "../../services/parsing";
import {
  FIRST_REQUEST_COOKIE,
  FIRST_REQUEST_TTL_IN_SECONDS,
  PROXY_ADDRESS,
  SERVER_HOST,
  SERVER_PORT,
  WEBSITE_PATH,
} from "../../sharedConstants";

const app = express();

app.use((req, _res, next) => {
  if (req.headers.referer?.slice(0, PROXY_ADDRESS.length) !== PROXY_ADDRESS) {
    req.res.status(404).end(`Access with ${req.hostname} is restricted.`);
    return;
  }

  next();
});

app.use(compression());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.use(cookieParser());

app.get("/", (_req, res) => {
  res.redirect("index.html");
});

app.use(async (req, res, next) => {
  const path = req.path;

  if (path.endsWith(".html")) {
    const result = await randomizeHtml(path);

    if (result) {
      const { htmlString, dateOfCaching } = result;

      res.cookie(FIRST_REQUEST_COOKIE, dateOfCaching, {
        maxAge: FIRST_REQUEST_TTL_IN_SECONDS,
        sameSite: "none",
        secure: true,
      });

      res.setHeader("Content-Type", ContentTypeHelper.getMime(path));
      res.status(200).send(htmlString);
      return;
    }
  } else if (path.endsWith(".css")) {
    const cssString = await randomizeCss(
      path,
      req.cookies[FIRST_REQUEST_COOKIE]
    );

    if (path.includes("styles")) {
      await fsp.writeFile("dummy_css.txt", JSON.stringify(cssString, null, 2));
    }

    if (cssString) {
      res.setHeader("Content-Type", ContentTypeHelper.getMime(path));
      res.status(200).send(cssString);
      return;
    }
  }

  next();
});

app.use(express.static(WEBSITE_PATH));

const startPublisherServer = () => {
  return app.listen(SERVER_PORT, SERVER_HOST, () => {
    console.log(`Starting Publisher at ${SERVER_HOST}:${SERVER_PORT}`);
  });
};

export const websitePublisher = {
  _server: null,
  startServer() {
    const server = startPublisherServer();
    this._server = server;
  },
  stopServer() {
    if (!this._server) return;

    this._server.close((err) => {
      console.log(`Stopping Publisher at ${SERVER_HOST}:${SERVER_PORT}`);
      process.exit(err ? 1 : 0);
    });
  },
};
