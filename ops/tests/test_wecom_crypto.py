"""企业微信官方示例向量（Sample.php / 加解密方案说明）。"""

from airui_ops.wecom_crypto import WeComCrypto, WeComCryptoError

TOKEN = "QDG6eK"
AES_KEY = "jWmYm7qr5nMoAUwZRjGtBxmz3KA1tkAj3ykkR6q2B2C"
CORP = "wx5823bf96d3bd56c7"
ECHO = "P9nAzCzyDtyTWESHep1vC5X9xho/qYX3Zpb4yKa9SKld1DsH3Iyt3tP3zNdtp+4RPcs8TgAE7OaBO+FZXvnaqQ=="
ECHO_SIG = "5c45ff5e21c57e6ad56bac8758b79b1d9ac89fd3"
MSG_SIG = "477715d11cdb4164915debcba66cb864d751f3e6"
MSG_XML = (
    "<xml><ToUserName><![CDATA[wx5823bf96d3bd56c7]]></ToUserName><Encrypt><![CDATA["
    "RypEvHKD8QQKFhvQ6QleEB4J58tiPdvo+rtK1I9qca6aM/wvqnLSV5zEPeusUiX5L5X/0lWfrf0QADHHhGd3QczcdCUpj911L3vg3W/"
    "sYYvuJTs3TUUkSUXxaccAS0qhxchrRYt66wiSpGLYL42aM6A8dTT+6k4aSknmPj48kzJs8qLjvd4Xgpue06DOdnLxAUHzM6+"
    "kDZ+HMZfJYuR+LtwGc2hgf5gsijff0ekUNXZiqATP7PF5mZxZ3Izoun1s4zG4LUMnvw2r+KqCKIw+3IQH03v+BCA9nMELNqbSf6tiWSrXJB3LAVGUcallcrw8V2t9EL4EhzJWrQUax5wLVMNS0+"
    "rUPA3k22Ncx4XXZS9o0MBH27Bo6BpNelZpS+/uh9KsNlY6bHCmJU9p8g7m3fVKn28H3KDYA5Pl/T8Z1ptDAVe0lXdQ2YoyyH2uyPIGHBZZIs2pDBS8R07+qN+E7Q=="
    "]]></Encrypt><AgentID><![CDATA[218]]></AgentID></xml>"
)


def crypto():
    return WeComCrypto(TOKEN, AES_KEY, CORP)


def test_official_url_verification_vector():
    plain = crypto().verify_url(ECHO_SIG, "1409659589", "263014780", ECHO)
    assert plain == "1616140317555161061"


def test_official_message_decrypt_vector():
    plain = crypto().decrypt_xml(MSG_SIG, "1409659813", "1372623149", MSG_XML)
    assert "hello" in plain
    assert "mycreate" in plain
    assert "wx5823bf96d3bd56c7" in plain


def test_roundtrip_and_rejects_bad_signature_or_receive_id():
    box = crypto()
    blob = box.encrypt("审批通过")
    assert box.decrypt(blob) == "审批通过"
    try:
        box.verify_url("0" * 40, "1409659589", "263014780", ECHO)
        raised = False
    except WeComCryptoError as exc:
        raised = "signature" in str(exc)
    assert raised
    other = WeComCrypto(TOKEN, AES_KEY, "ww-other")
    try:
        other.decrypt(ECHO)
        raised = False
    except WeComCryptoError as exc:
        raised = "receive_id" in str(exc)
    assert raised


def test_aes_key_must_be_43_chars():
    try:
        WeComCrypto(TOKEN, "short", CORP)
        assert False
    except WeComCryptoError:
        assert True
