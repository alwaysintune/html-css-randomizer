import { promises as fsp } from "fs";
import { TimeValue } from "./utils/date";

export const PROXY_PORT = 3001;
export const PROXY_HOST = "localhost";
export const PROXY_ADDRESS = `http://${PROXY_HOST}:${PROXY_PORT}`;

export const SERVER_PORT = 8080;
export const SERVER_HOST = "localhost";
export const SERVER_ADDRESS = `http://${SERVER_HOST}:${SERVER_PORT}`;

export const PUBLIC_KEY = await fsp.readFile("public_key.pem", "utf-8");
export const PRIVATE_KEY = await fsp.readFile("private_key.pem", "utf-8");

export const BUFFER_ENCODING = Buffer.isEncoding("base64url")
  ? "base64url"
  : "base64";

export const HTML_ELEMENTS = new Set([
  ...(await fsp.readFile("html_elements.csv", "utf-8"))
    .toString()
    .trim()
    .split(","),
  "no-js",
]);

export const WEBSITE_PATH = "./website/books.toscrape.com";

export const FIRST_REQUEST_TTL_IN_SECONDS = TimeValue.getDaysInSeconds(1);
export const FIRST_REQUEST_COOKIE = "first-request";

export const PX_APP_ID = "";
export const PX_COOKIE_ENCRYPTION_KEY = "";
export const PX_TOKEN = "";
