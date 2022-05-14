import crypto from "crypto";
import { promises as fsp } from "fs";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "spki",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem",
    cipher: "aes-256-cbc",
    passphrase: "top secret",
  },
});

await fsp.writeFile("public_key.pem", publicKey);
await fsp.writeFile("private_key.pem", privateKey);
