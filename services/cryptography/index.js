import crypto from "crypto";

export const cryptoService = (
  publicKey,
  privateKey,
  passphrase,
  padding = crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash = "sha256"
) => ({
  encryptText(plainText) {
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding,
        oaepHash,
      },
      Buffer.from(plainText)
    );
  },
  decryptText(buffer) {
    return crypto.privateDecrypt(
      {
        key: privateKey,
        padding,
        oaepHash,
        passphrase,
      },
      buffer
    );
  },
});
