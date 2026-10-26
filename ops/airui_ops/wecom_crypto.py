"""企业微信回调加解密。

算法与官方《加解密方案说明》一致：
https://developer.work.weixin.qq.com/document/path/90968

- msg_signature = SHA1(sort(token, timestamp, nonce, encrypt))
- AESKey = Base64_Decode(EncodingAESKey + "=")，32 字节
- AES-CBC，IV 为 AESKey 前 16 字节，PKCS#7 填充到 32 字节的倍数
- 明文 = random(16) + msg_len(4, 大端) + msg + receiveid
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import struct
from xml.etree import ElementTree

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

BLOCK = 32


class WeComCryptoError(Exception):
    pass


class WeComCrypto:
    def __init__(self, token: str, encoding_aes_key: str, receive_id: str):
        if not token:
            raise WeComCryptoError("token missing")
        if len(encoding_aes_key) != 43:
            raise WeComCryptoError("EncodingAESKey length must be 43")
        try:
            aes_key = base64.b64decode(encoding_aes_key + "=", validate=True)
        except Exception as exc:
            raise WeComCryptoError("EncodingAESKey is not valid base64") from exc
        if len(aes_key) != 32:
            raise WeComCryptoError("EncodingAESKey must decode to 32 bytes")
        self.token = token
        self.receive_id = receive_id
        self.aes_key = aes_key

    def signature(self, timestamp: str, nonce: str, encrypt: str) -> str:
        parts = sorted([self.token, str(timestamp), str(nonce), encrypt])
        return hashlib.sha1("".join(parts).encode("utf-8")).hexdigest()

    def verify_signature(self, signature: str, timestamp: str, nonce: str, encrypt: str) -> None:
        expect = self.signature(timestamp, nonce, encrypt)
        if not hmac.compare_digest(expect, signature or ""):
            raise WeComCryptoError("signature mismatch")

    def _cipher(self) -> Cipher:
        return Cipher(algorithms.AES(self.aes_key), modes.CBC(self.aes_key[:16]))

    def decrypt(self, encrypt_b64: str) -> str:
        try:
            raw = base64.b64decode(encrypt_b64, validate=False)
        except Exception as exc:
            raise WeComCryptoError("ciphertext is not valid base64") from exc
        if not raw or len(raw) % 16 != 0:
            raise WeComCryptoError("ciphertext length")
        decryptor = self._cipher().decryptor()
        plain = decryptor.update(raw) + decryptor.finalize()
        pad = plain[-1]
        if pad < 1 or pad > BLOCK or plain[-pad:] != bytes([pad]) * pad:
            raise WeComCryptoError("invalid padding")
        plain = plain[:-pad]
        if len(plain) < 20:
            raise WeComCryptoError("plaintext too short")
        msg_len = struct.unpack("!I", plain[16:20])[0]
        if msg_len < 0 or 20 + msg_len > len(plain):
            raise WeComCryptoError("invalid message length")
        msg = plain[20:20 + msg_len]
        receive_id = plain[20 + msg_len:].decode("utf-8", errors="strict")
        if receive_id != self.receive_id:
            raise WeComCryptoError("receive_id mismatch")
        return msg.decode("utf-8")

    def encrypt(self, message: str) -> str:
        msg = message.encode("utf-8")
        body = os.urandom(16) + struct.pack("!I", len(msg)) + msg + self.receive_id.encode("utf-8")
        pad = BLOCK - (len(body) % BLOCK)
        body += bytes([pad]) * pad
        encryptor = self._cipher().encryptor()
        raw = encryptor.update(body) + encryptor.finalize()
        return base64.b64encode(raw).decode("ascii")

    def verify_url(self, signature: str, timestamp: str, nonce: str, echostr: str) -> str:
        self.verify_signature(signature, timestamp, nonce, echostr)
        return self.decrypt(echostr)

    def decrypt_xml(self, signature: str, timestamp: str, nonce: str, xml_text: str) -> str:
        encrypt = extract_encrypt(xml_text)
        self.verify_signature(signature, timestamp, nonce, encrypt)
        return self.decrypt(encrypt)


def extract_encrypt(xml_text: str) -> str:
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as exc:
        raise WeComCryptoError("xml parse failed") from exc
    node = root.find("Encrypt")
    if node is None or not (node.text or "").strip():
        raise WeComCryptoError("Encrypt missing")
    return node.text.strip()
