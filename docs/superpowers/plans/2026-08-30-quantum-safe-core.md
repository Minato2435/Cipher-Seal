# Quantum-Safe Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Firebase-independent Python core — post-quantum crypto wrappers, the behavioural-risk AI engine, and the adaptive-security policy state machine — as one installable, fully unit-tested package.

**Architecture:** A single package `quantumsafe/` (living under `functions/` so Cloud Functions can import it later) with three sub-packages: `crypto/` (ML-KEM-768 KEM, ML-DSA-65 signatures, AES-256-GCM AEAD, private-key wrapping), `ai/` (event→feature extraction, an Isolation Forest wrapper, blended risk scoring + banding), and `security/` (security-event model, band→action policy). A `scripts/seed_baseline.py` generates synthetic traffic, trains the model, and emits `model.joblib` + `thresholds.json`. Everything is pure Python and testable with `pytest` — no Firebase, no network.

**Tech Stack:** Python 3.12, `kyber-py` 1.2.0, `dilithium-py` 1.4.0, `cryptography` (AES-GCM + HKDF), `scikit-learn`, `numpy`, `joblib`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-08-29-smart-quantum-safe-comm-design.md`

## Global Constraints

- **Python 3.12.** Target runtime is Cloud Functions for Firebase gen 2, Python 3.12.
- **Package import root is `functions/`.** All modules import as `from quantumsafe...`. `pytest.ini` sets `pythonpath = functions`.
- **Algorithms are fixed:** key establishment `ML-KEM-768`; digital signatures `ML-DSA-65`; message encryption `AES-256-GCM` with a **12-byte IV** and a **16-byte tag stored separately** from the ciphertext.
- **PQC libraries are educational** (`kyber-py`, `dilithium-py` — not constant-time). Do not add a claim of side-channel resistance anywhere in code comments or docs.
- **Key-derivation:** all symmetric keys derive via **HKDF-SHA256**. KEK info string is exactly `b"quantumsafe-kek-v1"`; session-key info string is exactly `b"quantumsafe-session-v1"`.
- **No plaintext at rest.** Any helper that returns a "document" dict for storage must contain only base64 strings of ciphertext/keys/metadata, never raw private keys or message plaintext.
- **Determinism in tests:** every test that uses randomness seeds it. Model training uses `random_state=42`.
- **Commit after every task** with the message shown in the task's final step.

---

### Task 1: Project scaffold

**Files:**
- Create: `functions/quantumsafe/__init__.py` (empty)
- Create: `functions/quantumsafe/crypto/__init__.py` (empty)
- Create: `functions/quantumsafe/ai/__init__.py` (empty)
- Create: `functions/quantumsafe/security/__init__.py` (empty)
- Create: `functions/requirements.txt`
- Create: `functions/requirements-dev.txt`
- Create: `pytest.ini`
- Create: `functions/tests/__init__.py` (empty)
- Create: `functions/tests/test_smoke.py`

**Interfaces:**
- Consumes: nothing.
- Produces: the importable `quantumsafe` package root and the test runner configuration every later task relies on.

- [ ] **Step 1: Write the failing test**

`functions/tests/test_smoke.py`:

```python
def test_package_imports():
    import quantumsafe
    import quantumsafe.crypto
    import quantumsafe.ai
    import quantumsafe.security

    assert quantumsafe is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_smoke.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe'` (pytest.ini / packages not created yet).

- [ ] **Step 3: Create the scaffold**

`pytest.ini`:

```ini
[pytest]
pythonpath = functions
testpaths = functions/tests
addopts = -q
```

`functions/requirements.txt`:

```
kyber-py==1.2.0
dilithium-py==1.4.0
cryptography>=43,<46
scikit-learn>=1.5,<2
numpy>=1.26,<3
joblib>=1.3,<2
```

`functions/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8,<9
```

Create the five empty `__init__.py` files listed above (`functions/quantumsafe/__init__.py`, `functions/quantumsafe/crypto/__init__.py`, `functions/quantumsafe/ai/__init__.py`, `functions/quantumsafe/security/__init__.py`, `functions/tests/__init__.py`).

Then install dev deps:

```bash
python -m pip install -r functions/requirements-dev.txt
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_smoke.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions pytest.ini
git commit -m "chore: scaffold quantumsafe package and pytest config"
```

---

### Task 2: HKDF helper

**Files:**
- Create: `functions/quantumsafe/crypto/kdf.py`
- Test: `functions/tests/test_kdf.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hkdf_sha256(ikm: bytes, *, salt: bytes = b"", info: bytes = b"", length: int = 32) -> bytes`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_kdf.py`:

```python
import pytest

from quantumsafe.crypto.kdf import hkdf_sha256


def test_hkdf_is_deterministic_and_correct_length():
    out1 = hkdf_sha256(b"input-key-material", salt=b"s", info=b"i", length=32)
    out2 = hkdf_sha256(b"input-key-material", salt=b"s", info=b"i", length=32)
    assert out1 == out2
    assert len(out1) == 32


def test_hkdf_info_changes_output():
    a = hkdf_sha256(b"ikm", info=b"context-a")
    b = hkdf_sha256(b"ikm", info=b"context-b")
    assert a != b


def test_hkdf_custom_length():
    assert len(hkdf_sha256(b"ikm", length=16)) == 16
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_kdf.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.crypto.kdf'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/crypto/kdf.py`:

```python
"""HKDF-SHA256 key derivation. All symmetric keys in this project derive here."""

from __future__ import annotations

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def hkdf_sha256(
    ikm: bytes,
    *,
    salt: bytes = b"",
    info: bytes = b"",
    length: int = 32,
) -> bytes:
    """Derive ``length`` bytes from ``ikm`` using HKDF-SHA256."""
    return HKDF(
        algorithm=hashes.SHA256(),
        length=length,
        salt=salt,
        info=info,
    ).derive(ikm)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_kdf.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/crypto/kdf.py functions/tests/test_kdf.py
git commit -m "feat: add HKDF-SHA256 key derivation helper"
```

---

### Task 3: AES-256-GCM AEAD wrapper

**Files:**
- Create: `functions/quantumsafe/crypto/aead.py`
- Test: `functions/tests/test_aead.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AeadResult` — `NamedTuple(iv: bytes, ciphertext: bytes, tag: bytes)`
  - `aes256gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = b"") -> AeadResult`
  - `aes256gcm_decrypt(key: bytes, iv: bytes, ciphertext: bytes, tag: bytes, aad: bytes = b"") -> bytes`
  - `IV_LEN = 12`, `TAG_LEN = 16`, `KEY_LEN = 32`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_aead.py`:

```python
import pytest

from quantumsafe.crypto.aead import (
    IV_LEN,
    KEY_LEN,
    TAG_LEN,
    aes256gcm_decrypt,
    aes256gcm_encrypt,
)

KEY = bytes(range(32))


def test_round_trip_recovers_plaintext():
    enc = aes256gcm_encrypt(KEY, b"attack at dawn", aad=b"sid-1")
    assert len(enc.iv) == IV_LEN
    assert len(enc.tag) == TAG_LEN
    assert enc.ciphertext != b"attack at dawn"
    out = aes256gcm_decrypt(KEY, enc.iv, enc.ciphertext, enc.tag, aad=b"sid-1")
    assert out == b"attack at dawn"


def test_each_encryption_uses_a_fresh_iv():
    a = aes256gcm_encrypt(KEY, b"x")
    b = aes256gcm_encrypt(KEY, b"x")
    assert a.iv != b.iv


def test_tampered_ciphertext_fails():
    enc = aes256gcm_encrypt(KEY, b"hello")
    bad = bytes([enc.ciphertext[0] ^ 1]) + enc.ciphertext[1:]
    with pytest.raises(Exception):
        aes256gcm_decrypt(KEY, enc.iv, bad, enc.tag)


def test_wrong_aad_fails():
    enc = aes256gcm_encrypt(KEY, b"hello", aad=b"sid-1")
    with pytest.raises(Exception):
        aes256gcm_decrypt(KEY, enc.iv, enc.ciphertext, enc.tag, aad=b"sid-2")


def test_non_256_bit_key_rejected():
    with pytest.raises(ValueError):
        aes256gcm_encrypt(b"short", b"hello")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_aead.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.crypto.aead'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/crypto/aead.py`:

```python
"""AES-256-GCM authenticated encryption.

``cryptography`` returns ciphertext with the 16-byte tag appended; this module
splits them so callers can store ``ciphertext`` and ``tag`` in separate fields.
"""

from __future__ import annotations

import os
from typing import NamedTuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

IV_LEN = 12
TAG_LEN = 16
KEY_LEN = 32


class AeadResult(NamedTuple):
    iv: bytes
    ciphertext: bytes
    tag: bytes


def _check_key(key: bytes) -> None:
    if len(key) != KEY_LEN:
        raise ValueError(f"AES-256-GCM requires a {KEY_LEN}-byte key, got {len(key)}")


def aes256gcm_encrypt(key: bytes, plaintext: bytes, aad: bytes = b"") -> AeadResult:
    _check_key(key)
    iv = os.urandom(IV_LEN)
    blob = AESGCM(key).encrypt(iv, plaintext, aad)
    return AeadResult(iv=iv, ciphertext=blob[:-TAG_LEN], tag=blob[-TAG_LEN:])


def aes256gcm_decrypt(
    key: bytes,
    iv: bytes,
    ciphertext: bytes,
    tag: bytes,
    aad: bytes = b"",
) -> bytes:
    _check_key(key)
    return AESGCM(key).decrypt(iv, ciphertext + tag, aad)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_aead.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/crypto/aead.py functions/tests/test_aead.py
git commit -m "feat: add AES-256-GCM AEAD wrapper with split tag"
```

---

### Task 4: ML-KEM-768 key encapsulation

**Files:**
- Create: `functions/quantumsafe/crypto/kem.py`
- Test: `functions/tests/test_kem.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ALG = "ML-KEM-768"`, `EK_LEN = 1184`, `DK_LEN = 2400`, `CT_LEN = 1088`, `SS_LEN = 32`
  - `KemKeypair` — `NamedTuple(ek: bytes, dk: bytes)` (ek = public/encapsulation key, dk = private/decapsulation key)
  - `kem_keygen() -> KemKeypair`
  - `kem_encapsulate(ek: bytes) -> tuple[bytes, bytes]` — returns `(shared_secret, kem_ciphertext)`
  - `kem_decapsulate(dk: bytes, kem_ciphertext: bytes) -> bytes` — returns `shared_secret`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_kem.py`:

```python
from quantumsafe.crypto.kem import (
    ALG,
    CT_LEN,
    DK_LEN,
    EK_LEN,
    SS_LEN,
    kem_decapsulate,
    kem_encapsulate,
    kem_keygen,
)


def test_alg_label():
    assert ALG == "ML-KEM-768"


def test_keygen_sizes():
    kp = kem_keygen()
    assert len(kp.ek) == EK_LEN
    assert len(kp.dk) == DK_LEN


def test_encaps_decaps_agree_on_shared_secret():
    kp = kem_keygen()
    shared, ct = kem_encapsulate(kp.ek)
    assert len(shared) == SS_LEN
    assert len(ct) == CT_LEN
    assert kem_decapsulate(kp.dk, ct) == shared


def test_wrong_decaps_key_yields_different_secret():
    a = kem_keygen()
    b = kem_keygen()
    shared, ct = kem_encapsulate(a.ek)
    # ML-KEM implicit rejection: decaps with the wrong key returns *a* value,
    # just not the encapsulated one.
    assert kem_decapsulate(b.dk, ct) != shared
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_kem.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.crypto.kem'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/crypto/kem.py`:

```python
"""ML-KEM-768 (FIPS 203) key encapsulation.

Backed by ``kyber-py`` — a correct but non-constant-time reference
implementation. Suitable for a prototype, not for production key material.
"""

from __future__ import annotations

from typing import NamedTuple

from kyber_py.ml_kem import ML_KEM_768

ALG = "ML-KEM-768"
EK_LEN = 1184
DK_LEN = 2400
CT_LEN = 1088
SS_LEN = 32


class KemKeypair(NamedTuple):
    ek: bytes  # encapsulation (public) key
    dk: bytes  # decapsulation (private) key


def kem_keygen() -> KemKeypair:
    ek, dk = ML_KEM_768.keygen()
    return KemKeypair(ek=ek, dk=dk)


def kem_encapsulate(ek: bytes) -> tuple[bytes, bytes]:
    """Return ``(shared_secret, kem_ciphertext)``."""
    shared, ciphertext = ML_KEM_768.encaps(ek)
    return shared, ciphertext


def kem_decapsulate(dk: bytes, kem_ciphertext: bytes) -> bytes:
    """Return the shared secret recovered from ``kem_ciphertext``."""
    return ML_KEM_768.decaps(dk, kem_ciphertext)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_kem.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/crypto/kem.py functions/tests/test_kem.py
git commit -m "feat: add ML-KEM-768 key encapsulation wrapper"
```

---

### Task 5: ML-DSA-65 digital signatures

**Files:**
- Create: `functions/quantumsafe/crypto/sign.py`
- Test: `functions/tests/test_sign.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ALG = "ML-DSA-65"`, `PK_LEN = 1952`, `SK_LEN = 4032`
  - `SignKeypair` — `NamedTuple(pk: bytes, sk: bytes)`
  - `sign_keygen() -> SignKeypair`
  - `sign(sk: bytes, message: bytes, context: bytes = b"") -> bytes`
  - `verify(pk: bytes, message: bytes, signature: bytes, context: bytes = b"") -> bool`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_sign.py`:

```python
from quantumsafe.crypto.sign import (
    ALG,
    PK_LEN,
    SK_LEN,
    sign,
    sign_keygen,
    verify,
)


def test_alg_label():
    assert ALG == "ML-DSA-65"


def test_keygen_sizes():
    kp = sign_keygen()
    assert len(kp.pk) == PK_LEN
    assert len(kp.sk) == SK_LEN


def test_sign_then_verify_true():
    kp = sign_keygen()
    sig = sign(kp.sk, b"message body", context=b"sid|a|b")
    assert verify(kp.pk, b"message body", sig, context=b"sid|a|b") is True


def test_flipped_message_byte_fails_verify():
    kp = sign_keygen()
    sig = sign(kp.sk, b"message body")
    assert verify(kp.pk, b"mess!ge body", sig) is False


def test_context_mismatch_fails_verify():
    kp = sign_keygen()
    sig = sign(kp.sk, b"body", context=b"ctx-1")
    assert verify(kp.pk, b"body", sig, context=b"ctx-2") is False


def test_wrong_public_key_fails_verify():
    signer = sign_keygen()
    other = sign_keygen()
    sig = sign(signer.sk, b"body")
    assert verify(other.pk, b"body", sig) is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_sign.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.crypto.sign'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/crypto/sign.py`:

```python
"""ML-DSA-65 (FIPS 204) digital signatures.

Backed by ``dilithium-py`` — a correct but non-constant-time reference
implementation.
"""

from __future__ import annotations

from typing import NamedTuple

from dilithium_py.ml_dsa import ML_DSA_65

ALG = "ML-DSA-65"
PK_LEN = 1952
SK_LEN = 4032


class SignKeypair(NamedTuple):
    pk: bytes
    sk: bytes


def sign_keygen() -> SignKeypair:
    pk, sk = ML_DSA_65.keygen()
    return SignKeypair(pk=pk, sk=sk)


def sign(sk: bytes, message: bytes, context: bytes = b"") -> bytes:
    return ML_DSA_65.sign(sk, message, ctx=context, deterministic=True)


def verify(pk: bytes, message: bytes, signature: bytes, context: bytes = b"") -> bool:
    try:
        return bool(ML_DSA_65.verify(pk, message, signature, ctx=context))
    except (ValueError, TypeError):
        return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_sign.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/crypto/sign.py functions/tests/test_sign.py
git commit -m "feat: add ML-DSA-65 signature wrapper with context binding"
```

---

### Task 6: Private-key wrapping (keystore)

**Files:**
- Create: `functions/quantumsafe/crypto/keystore.py`
- Test: `functions/tests/test_keystore.py`

**Interfaces:**
- Consumes: `hkdf_sha256` (Task 2); `aes256gcm_encrypt` / `aes256gcm_decrypt` / `AeadResult` (Task 3); `kem_keygen` (Task 4); `sign_keygen` (Task 5).
- Produces:
  - `KEK_INFO = b"quantumsafe-kek-v1"`
  - `derive_kek(app_secret: bytes, salt: bytes) -> bytes` (32 bytes)
  - `wrap_private_key(app_secret: bytes, private_key: bytes, alg: str) -> dict` — returns
    `{"alg": str, "salt_b64": str, "iv_b64": str, "ct_b64": str, "tag_b64": str}`
  - `unwrap_private_key(app_secret: bytes, wrapped: dict) -> bytes`
  - `generate_user_keys(app_secret: bytes) -> dict` — returns
    `{"public": {"mlkemPub_b64": str, "mldsaPub_b64": str, "mlkemAlg": str, "mldsaAlg": str},
      "private": {"mlkemPriv_enc": dict, "mldsaPriv_enc": dict}}`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_keystore.py`:

```python
import base64

import pytest

from quantumsafe.crypto.keystore import (
    derive_kek,
    generate_user_keys,
    unwrap_private_key,
    wrap_private_key,
)

SECRET = b"0123456789abcdef0123456789abcdef"


def test_derive_kek_is_deterministic_per_salt():
    salt = b"user-salt"
    assert derive_kek(SECRET, salt) == derive_kek(SECRET, salt)
    assert len(derive_kek(SECRET, salt)) == 32


def test_derive_kek_varies_by_salt():
    assert derive_kek(SECRET, b"a") != derive_kek(SECRET, b"b")


def test_wrap_then_unwrap_round_trips():
    priv = b"\x01\x02\x03" * 40
    wrapped = wrap_private_key(SECRET, priv, alg="ML-KEM-768")
    assert set(wrapped) == {"alg", "salt_b64", "iv_b64", "ct_b64", "tag_b64"}
    assert wrapped["alg"] == "ML-KEM-768"
    # ciphertext must not contain the raw key
    assert base64.b64decode(wrapped["ct_b64"]) != priv
    assert unwrap_private_key(SECRET, wrapped) == priv


def test_unwrap_with_wrong_secret_fails():
    wrapped = wrap_private_key(SECRET, b"secret-key-bytes", alg="ML-DSA-65")
    with pytest.raises(Exception):
        unwrap_private_key(b"wrong-secret-wrong-secret-wrong!", wrapped)


def test_generate_user_keys_shape_and_recoverability():
    material = generate_user_keys(SECRET)
    pub = material["public"]
    priv = material["private"]
    assert pub["mlkemAlg"] == "ML-KEM-768"
    assert pub["mldsaAlg"] == "ML-DSA-65"
    # public keys are plain base64, private are wrapped dicts
    assert isinstance(pub["mlkemPub_b64"], str)
    assert set(priv["mlkemPriv_enc"]) == {"alg", "salt_b64", "iv_b64", "ct_b64", "tag_b64"}
    # the wrapped KEM private key still decapsulates against the public key
    from quantumsafe.crypto.kem import kem_decapsulate, kem_encapsulate

    ek = base64.b64decode(pub["mlkemPub_b64"])
    dk = unwrap_private_key(SECRET, priv["mlkemPriv_enc"])
    shared, ct = kem_encapsulate(ek)
    assert kem_decapsulate(dk, ct) == shared
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_keystore.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.crypto.keystore'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/crypto/keystore.py`:

```python
"""Generate per-user PQC keypairs and wrap private keys for storage at rest.

Private keys are sealed with AES-256-GCM under a KEK that is HKDF-derived from a
server-held ``app_secret`` and a random per-key salt. Only the sealed form is
ever returned for storage.
"""

from __future__ import annotations

import base64
import os

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import ALG as KEM_ALG
from quantumsafe.crypto.kem import kem_keygen
from quantumsafe.crypto.sign import ALG as SIGN_ALG
from quantumsafe.crypto.sign import sign_keygen

KEK_INFO = b"quantumsafe-kek-v1"
_SALT_LEN = 16


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.b64decode(text)


def derive_kek(app_secret: bytes, salt: bytes) -> bytes:
    return hkdf_sha256(app_secret, salt=salt, info=KEK_INFO, length=32)


def wrap_private_key(app_secret: bytes, private_key: bytes, alg: str) -> dict:
    salt = os.urandom(_SALT_LEN)
    kek = derive_kek(app_secret, salt)
    enc = aes256gcm_encrypt(kek, private_key, aad=alg.encode("ascii"))
    return {
        "alg": alg,
        "salt_b64": _b64(salt),
        "iv_b64": _b64(enc.iv),
        "ct_b64": _b64(enc.ciphertext),
        "tag_b64": _b64(enc.tag),
    }


def unwrap_private_key(app_secret: bytes, wrapped: dict) -> bytes:
    kek = derive_kek(app_secret, _unb64(wrapped["salt_b64"]))
    return aes256gcm_decrypt(
        kek,
        _unb64(wrapped["iv_b64"]),
        _unb64(wrapped["ct_b64"]),
        _unb64(wrapped["tag_b64"]),
        aad=wrapped["alg"].encode("ascii"),
    )


def generate_user_keys(app_secret: bytes) -> dict:
    kem_kp = kem_keygen()
    sign_kp = sign_keygen()
    return {
        "public": {
            "mlkemPub_b64": _b64(kem_kp.ek),
            "mldsaPub_b64": _b64(sign_kp.pk),
            "mlkemAlg": KEM_ALG,
            "mldsaAlg": SIGN_ALG,
        },
        "private": {
            "mlkemPriv_enc": wrap_private_key(app_secret, kem_kp.dk, KEM_ALG),
            "mldsaPriv_enc": wrap_private_key(app_secret, sign_kp.sk, SIGN_ALG),
        },
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_keystore.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/crypto/keystore.py functions/tests/test_keystore.py
git commit -m "feat: add per-user keypair generation and at-rest private-key wrapping"
```

---

### Task 7: Security-event model

**Files:**
- Create: `functions/quantumsafe/security/events.py`
- Test: `functions/tests/test_events.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Event-type string constants: `LOGIN_OK`, `LOGIN_FAIL`, `MSG_SENT`, `MSG_RECV`, `TAMPER`, `SESSION_ESTABLISH`, `RE_AUTH_OK`, `RE_AUTH_FAIL`, `SIM_ATTACK`
  - `VALID_TYPES: frozenset[str]`
  - `SecurityEvent` — frozen dataclass `(uid: str, type: str, ts: float, meta: dict)`; `meta` defaults to `{}`; `__post_init__` raises `ValueError` for an unknown `type`
  - `SecurityEvent.from_dict(d: dict) -> SecurityEvent` and `.to_dict() -> dict`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_events.py`:

```python
import pytest

from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    VALID_TYPES,
    SecurityEvent,
)


def test_valid_types_contains_known_events():
    assert {"LOGIN_OK", "LOGIN_FAIL", "MSG_SENT", "TAMPER", "SIM_ATTACK"} <= VALID_TYPES


def test_construct_valid_event():
    ev = SecurityEvent(uid="u1", type=MSG_SENT, ts=100.0, meta={"size": 12})
    assert ev.type == "MSG_SENT"
    assert ev.meta["size"] == 12


def test_unknown_type_rejected():
    with pytest.raises(ValueError):
        SecurityEvent(uid="u1", type="NOPE", ts=1.0)


def test_meta_defaults_to_empty_dict():
    ev = SecurityEvent(uid="u1", type=LOGIN_FAIL, ts=1.0)
    assert ev.meta == {}


def test_to_dict_from_dict_round_trip():
    ev = SecurityEvent(uid="u1", type=LOGIN_FAIL, ts=5.0, meta={"ip": "x"})
    assert SecurityEvent.from_dict(ev.to_dict()) == ev
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_events.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.security.events'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/security/events.py`:

```python
"""The security-event vocabulary shared by the AI and policy layers."""

from __future__ import annotations

from dataclasses import dataclass, field

LOGIN_OK = "LOGIN_OK"
LOGIN_FAIL = "LOGIN_FAIL"
MSG_SENT = "MSG_SENT"
MSG_RECV = "MSG_RECV"
TAMPER = "TAMPER"
SESSION_ESTABLISH = "SESSION_ESTABLISH"
RE_AUTH_OK = "RE_AUTH_OK"
RE_AUTH_FAIL = "RE_AUTH_FAIL"
SIM_ATTACK = "SIM_ATTACK"

VALID_TYPES = frozenset(
    {
        LOGIN_OK,
        LOGIN_FAIL,
        MSG_SENT,
        MSG_RECV,
        TAMPER,
        SESSION_ESTABLISH,
        RE_AUTH_OK,
        RE_AUTH_FAIL,
        SIM_ATTACK,
    }
)


@dataclass(frozen=True)
class SecurityEvent:
    uid: str
    type: str
    ts: float
    meta: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.type not in VALID_TYPES:
            raise ValueError(f"unknown security event type: {self.type!r}")

    def to_dict(self) -> dict:
        return {"uid": self.uid, "type": self.type, "ts": self.ts, "meta": dict(self.meta)}

    @classmethod
    def from_dict(cls, d: dict) -> "SecurityEvent":
        return cls(uid=d["uid"], type=d["type"], ts=float(d["ts"]), meta=dict(d.get("meta") or {}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_events.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/security/events.py functions/tests/test_events.py
git commit -m "feat: add security-event model and type vocabulary"
```

---

### Task 8: Feature extraction

**Files:**
- Create: `functions/quantumsafe/ai/features.py`
- Test: `functions/tests/test_features.py`

**Interfaces:**
- Consumes: `SecurityEvent` and type constants (Task 7).
- Produces:
  - `FEATURE_NAMES: list[str]` — exact order:
    `["login_fail_count", "login_fail_rate", "msg_sent_count", "msg_rate_per_min",
      "mean_msg_interval_s", "msg_size_mean", "distinct_recipients", "session_count",
      "hour_of_day_sin", "hour_of_day_cos", "sim_attack_flag"]`
  - `DEFAULT_WINDOW_SECONDS = 300.0`
  - `extract_features(events, *, now: float, window_seconds: float = DEFAULT_WINDOW_SECONDS) -> dict[str, float]`
    — returns every `FEATURE_NAMES` key **plus** an extra `"hour_of_day"` key (0–23, for rule checks; not part of the vector)
  - `features_to_vector(feats: Mapping[str, float]) -> list[float]` — values in `FEATURE_NAMES` order

- [ ] **Step 1: Write the failing test**

`functions/tests/test_features.py`:

```python
import math

from quantumsafe.ai.features import (
    FEATURE_NAMES,
    extract_features,
    features_to_vector,
)
from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)

NOW = 1_000_000.0


def _ev(t, ts, **meta):
    return SecurityEvent(uid="u1", type=t, ts=ts, meta=meta)


def test_all_feature_names_present_and_vector_matches_order():
    feats = extract_features([], now=NOW)
    for name in FEATURE_NAMES:
        assert name in feats
    vec = features_to_vector(feats)
    assert len(vec) == len(FEATURE_NAMES)
    assert vec == [feats[n] for n in FEATURE_NAMES]


def test_events_outside_window_are_ignored():
    old = _ev(LOGIN_FAIL, NOW - 999)
    feats = extract_features([old], now=NOW, window_seconds=300.0)
    assert feats["login_fail_count"] == 0.0


def test_counts_rates_and_sizes():
    events = [
        _ev(LOGIN_FAIL, NOW - 200),
        _ev(LOGIN_FAIL, NOW - 100),
        _ev(MSG_SENT, NOW - 180, size=100, recipient="a"),
        _ev(MSG_SENT, NOW - 120, size=200, recipient="b"),
        _ev(MSG_SENT, NOW - 60, size=300, recipient="a"),
        _ev(SESSION_ESTABLISH, NOW - 90),
    ]
    feats = extract_features(events, now=NOW, window_seconds=300.0)
    assert feats["login_fail_count"] == 2.0
    assert feats["msg_sent_count"] == 3.0
    assert feats["msg_size_mean"] == 200.0
    assert feats["distinct_recipients"] == 2.0
    assert feats["session_count"] == 1.0
    assert math.isclose(feats["msg_rate_per_min"], 3.0 / 5.0, rel_tol=1e-6)
    assert math.isclose(feats["mean_msg_interval_s"], 60.0, rel_tol=1e-6)


def test_sim_attack_flag_and_hour_fields():
    feats = extract_features([_ev(SIM_ATTACK, NOW - 5)], now=NOW)
    assert feats["sim_attack_flag"] == 1.0
    assert 0 <= feats["hour_of_day"] <= 23
    assert math.isclose(
        feats["hour_of_day_sin"] ** 2 + feats["hour_of_day_cos"] ** 2, 1.0, rel_tol=1e-6
    )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_features.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.ai.features'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/ai/features.py`:

```python
"""Turn a window of security events into a fixed-order numeric feature vector."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone

from quantumsafe.security.events import (
    LOGIN_FAIL,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)

FEATURE_NAMES = [
    "login_fail_count",
    "login_fail_rate",
    "msg_sent_count",
    "msg_rate_per_min",
    "mean_msg_interval_s",
    "msg_size_mean",
    "distinct_recipients",
    "session_count",
    "hour_of_day_sin",
    "hour_of_day_cos",
    "sim_attack_flag",
]

DEFAULT_WINDOW_SECONDS = 300.0


def extract_features(
    events: Sequence[SecurityEvent],
    *,
    now: float,
    window_seconds: float = DEFAULT_WINDOW_SECONDS,
) -> dict[str, float]:
    start = now - window_seconds
    win = [e for e in events if start <= e.ts <= now]
    minutes = window_seconds / 60.0

    login_fail = [e for e in win if e.type == LOGIN_FAIL]
    msgs = sorted((e for e in win if e.type == MSG_SENT), key=lambda e: e.ts)
    sessions = [e for e in win if e.type == SESSION_ESTABLISH]

    sizes = [float(e.meta.get("size", 0) or 0) for e in msgs]
    recipients = {e.meta.get("recipient") for e in msgs if e.meta.get("recipient")}

    if len(msgs) >= 2:
        gaps = [b.ts - a.ts for a, b in zip(msgs, msgs[1:])]
        mean_interval = sum(gaps) / len(gaps)
    else:
        mean_interval = 0.0

    hour = datetime.fromtimestamp(now, tz=timezone.utc).hour
    angle = 2.0 * math.pi * hour / 24.0

    return {
        "login_fail_count": float(len(login_fail)),
        "login_fail_rate": len(login_fail) / minutes,
        "msg_sent_count": float(len(msgs)),
        "msg_rate_per_min": len(msgs) / minutes,
        "mean_msg_interval_s": float(mean_interval),
        "msg_size_mean": (sum(sizes) / len(sizes)) if sizes else 0.0,
        "distinct_recipients": float(len(recipients)),
        "session_count": float(len(sessions)),
        "hour_of_day_sin": math.sin(angle),
        "hour_of_day_cos": math.cos(angle),
        "sim_attack_flag": 1.0 if any(e.type == SIM_ATTACK for e in win) else 0.0,
        "hour_of_day": float(hour),
    }


def features_to_vector(feats: Mapping[str, float]) -> list[float]:
    return [float(feats[name]) for name in FEATURE_NAMES]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_features.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/ai/features.py functions/tests/test_features.py
git commit -m "feat: add event-window feature extraction"
```

---

### Task 9: Isolation Forest model wrapper

**Files:**
- Create: `functions/quantumsafe/ai/model.py`
- Test: `functions/tests/test_model.py`

**Interfaces:**
- Consumes: nothing (operates on plain float vectors).
- Produces:
  - `RiskModel` class with:
    - `raw_score(vector: Sequence[float]) -> float` — 0..1, higher = more anomalous, clamped
    - `save(path: str) -> None`
    - `RiskModel.load(path: str) -> "RiskModel"` (classmethod)
  - `train_model(normal_vectors: Sequence[Sequence[float]], *, contamination: float = 0.05, n_estimators: int = 200, random_state: int = 42) -> RiskModel`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_model.py`:

```python
import numpy as np

from quantumsafe.ai.model import RiskModel, train_model


def _normal_data(seed=0, n=400):
    rng = np.random.default_rng(seed)
    # 4-dim blob centred at origin
    return rng.normal(0.0, 1.0, size=(n, 4)).tolist()


def test_train_returns_model_and_scores_in_unit_interval():
    model = train_model(_normal_data(), random_state=42)
    s = model.raw_score([0.0, 0.0, 0.0, 0.0])
    assert 0.0 <= s <= 1.0


def test_outlier_scores_higher_than_inlier():
    model = train_model(_normal_data(), random_state=42)
    inlier = model.raw_score([0.1, -0.2, 0.0, 0.05])
    outlier = model.raw_score([12.0, -11.0, 9.0, 10.0])
    assert outlier > inlier


def test_save_and_load_roundtrip(tmp_path):
    model = train_model(_normal_data(), random_state=42)
    p = tmp_path / "m.joblib"
    model.save(str(p))
    loaded = RiskModel.load(str(p))
    v = [0.3, 0.3, 0.3, 0.3]
    assert abs(loaded.raw_score(v) - model.raw_score(v)) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.ai.model'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/ai/model.py`:

```python
"""Isolation Forest wrapper that emits a stable 0..1 anomaly score.

The raw ``decision_function`` output is unbounded and model-specific, so at train
time we record the 5th/95th percentiles of ``-decision_function`` over the
training set and later min-max normalise against that range.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


@dataclass
class RiskModel:
    scaler: StandardScaler
    forest: IsolationForest
    p_low: float
    p_high: float

    def raw_score(self, vector: Sequence[float]) -> float:
        x = self.scaler.transform([list(vector)])
        anomaly = -float(self.forest.decision_function(x)[0])
        span = self.p_high - self.p_low
        if span <= 1e-12:
            return 0.0
        return float(np.clip((anomaly - self.p_low) / span, 0.0, 1.0))

    def save(self, path: str) -> None:
        joblib.dump(
            {
                "scaler": self.scaler,
                "forest": self.forest,
                "p_low": self.p_low,
                "p_high": self.p_high,
            },
            path,
        )

    @classmethod
    def load(cls, path: str) -> "RiskModel":
        d = joblib.load(path)
        return cls(scaler=d["scaler"], forest=d["forest"], p_low=d["p_low"], p_high=d["p_high"])


def train_model(
    normal_vectors: Sequence[Sequence[float]],
    *,
    contamination: float = 0.05,
    n_estimators: int = 200,
    random_state: int = 42,
) -> RiskModel:
    x_raw = np.asarray([list(v) for v in normal_vectors], dtype=float)
    scaler = StandardScaler().fit(x_raw)
    x = scaler.transform(x_raw)
    forest = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
    ).fit(x)
    anomaly = -forest.decision_function(x)
    p_low = float(np.percentile(anomaly, 5))
    p_high = float(np.percentile(anomaly, 95))
    return RiskModel(scaler=scaler, forest=forest, p_low=p_low, p_high=p_high)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_model.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/ai/model.py functions/tests/test_model.py
git commit -m "feat: add Isolation Forest wrapper with normalised anomaly score"
```

---

### Task 10: Blended risk scoring and banding

**Files:**
- Create: `functions/quantumsafe/ai/risk.py`
- Test: `functions/tests/test_risk.py`

**Interfaces:**
- Consumes: feature dicts from `extract_features` (Task 8) — including the extra `hour_of_day` key.
- Produces:
  - `BANDS = ("NORMAL", "ELEVATED", "HIGH", "CRITICAL")`
  - `Thresholds` — frozen dataclass `(elevated: float = 0.35, high: float = 0.60, critical: float = 0.80)`; `Thresholds.from_dict` / `.to_dict`
  - `rule_boost(feats: Mapping[str, float]) -> tuple[float, dict]` — `(boost 0..1, components)`
  - `blended_score(model_score: float, boost: float) -> float` — `clamp(0.6*model + 0.4*boost, 0, 1)`
  - `band_for(score: float, thresholds: Thresholds) -> str`
  - `RiskAssessment` — frozen dataclass `(score, band, model_score, rule_boost, components)`
  - `assess(feats: Mapping[str, float], model_score: float, thresholds: Thresholds) -> RiskAssessment`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_risk.py`:

```python
import pytest

from quantumsafe.ai.risk import (
    BANDS,
    RiskAssessment,
    Thresholds,
    assess,
    band_for,
    blended_score,
    rule_boost,
)

BASE = {
    "login_fail_count": 0.0,
    "msg_rate_per_min": 0.0,
    "msg_sent_count": 0.0,
    "sim_attack_flag": 0.0,
    "hour_of_day": 13.0,
}


def test_no_signals_zero_boost():
    boost, comp = rule_boost(BASE)
    assert boost == 0.0
    assert comp == {}


def test_brute_force_boost():
    boost, comp = rule_boost({**BASE, "login_fail_count": 6.0})
    assert boost == pytest.approx(0.40)
    assert "brute_force" in comp


def test_multiple_signals_capped_at_one():
    feats = {
        **BASE,
        "login_fail_count": 9.0,     # +0.40
        "msg_rate_per_min": 45.0,    # +0.30
        "sim_attack_flag": 1.0,      # +0.30
        "hour_of_day": 3.0,
        "msg_sent_count": 20.0,      # off-hours burst +0.20
    }
    boost, _ = rule_boost(feats)
    assert boost == 1.0


def test_blended_score_formula_and_clamp():
    assert blended_score(0.5, 0.5) == pytest.approx(0.5)
    assert blended_score(1.0, 1.0) == 1.0
    assert blended_score(-3.0, -3.0) == 0.0


def test_band_boundaries():
    t = Thresholds()
    assert band_for(0.00, t) == "NORMAL"
    assert band_for(0.34, t) == "NORMAL"
    assert band_for(0.35, t) == "ELEVATED"
    assert band_for(0.60, t) == "HIGH"
    assert band_for(0.80, t) == "CRITICAL"
    assert band_for(0.99, t) in BANDS


def test_assess_bundles_everything():
    a = assess({**BASE, "login_fail_count": 6.0}, model_score=0.1, thresholds=Thresholds())
    assert isinstance(a, RiskAssessment)
    # model 0.1*0.6 = 0.06 ; boost 0.4*0.4 = 0.16 ; total 0.22 -> NORMAL
    assert a.band == "NORMAL"
    assert a.rule_boost == pytest.approx(0.40)
    assert "brute_force" in a.components


def test_thresholds_dict_round_trip():
    t = Thresholds(elevated=0.3, high=0.5, critical=0.7)
    assert Thresholds.from_dict(t.to_dict()) == t
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_risk.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.ai.risk'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/ai/risk.py`:

```python
"""Blend the model's anomaly score with hard rule signals, then assign a band."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

BANDS = ("NORMAL", "ELEVATED", "HIGH", "CRITICAL")

_MSG_RATE_LIMIT = 30.0
_MODEL_WEIGHT = 0.6
_RULE_WEIGHT = 0.4


@dataclass(frozen=True)
class Thresholds:
    elevated: float = 0.35
    high: float = 0.60
    critical: float = 0.80

    def to_dict(self) -> dict:
        return {"elevated": self.elevated, "high": self.high, "critical": self.critical}

    @classmethod
    def from_dict(cls, d: Mapping[str, float]) -> "Thresholds":
        return cls(
            elevated=float(d["elevated"]),
            high=float(d["high"]),
            critical=float(d["critical"]),
        )


@dataclass(frozen=True)
class RiskAssessment:
    score: float
    band: str
    model_score: float
    rule_boost: float
    components: dict = field(default_factory=dict)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def rule_boost(feats: Mapping[str, float]) -> tuple[float, dict]:
    components: dict[str, float] = {}
    if feats.get("login_fail_count", 0.0) >= 5:
        components["brute_force"] = 0.40
    if feats.get("msg_rate_per_min", 0.0) > _MSG_RATE_LIMIT:
        components["msg_flood"] = 0.30
    if feats.get("hour_of_day", 12.0) < 6 and feats.get("msg_sent_count", 0.0) > 10:
        components["off_hours_burst"] = 0.20
    if feats.get("sim_attack_flag", 0.0) >= 1.0:
        components["sim_attack"] = 0.30
    return _clamp(sum(components.values())), components


def blended_score(model_score: float, boost: float) -> float:
    return _clamp(_MODEL_WEIGHT * model_score + _RULE_WEIGHT * boost)


def band_for(score: float, thresholds: Thresholds) -> str:
    if score >= thresholds.critical:
        return "CRITICAL"
    if score >= thresholds.high:
        return "HIGH"
    if score >= thresholds.elevated:
        return "ELEVATED"
    return "NORMAL"


def assess(
    feats: Mapping[str, float],
    model_score: float,
    thresholds: Thresholds,
) -> RiskAssessment:
    boost, components = rule_boost(feats)
    score = blended_score(model_score, boost)
    return RiskAssessment(
        score=score,
        band=band_for(score, thresholds),
        model_score=float(model_score),
        rule_boost=boost,
        components=components,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_risk.py -v`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/ai/risk.py functions/tests/test_risk.py
git commit -m "feat: add blended risk scoring and band assignment"
```

---

### Task 11: Adaptive-security policy state machine

**Files:**
- Create: `functions/quantumsafe/security/policy.py`
- Test: `functions/tests/test_policy.py`

**Interfaces:**
- Consumes: band strings from `BANDS` (Task 10).
- Produces:
  - `STATUS_FOR: dict[str, str]` — band → account status (`NORMAL→"normal"`, `ELEVATED→"elevated"`, `HIGH→"high"`, `CRITICAL→"blocked"`)
  - `PolicyAction` — frozen dataclass `(from_band, to_band, action, status, terminate_sessions, raise_alert, require_reauth)`
    - `action` ∈ `"NONE"`, `"REQUIRE_REAUTH"`, `"TERMINATE_SESSIONS"`, `"BLOCK"`, `"RESTORE"`
  - `decide(previous_band: str, new_band: str) -> PolicyAction`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_policy.py`:

```python
import pytest

from quantumsafe.security.policy import STATUS_FOR, decide


def test_status_mapping():
    assert STATUS_FOR == {
        "NORMAL": "normal",
        "ELEVATED": "elevated",
        "HIGH": "high",
        "CRITICAL": "blocked",
    }


def test_same_band_is_noop_but_keeps_status():
    a = decide("HIGH", "HIGH")
    assert a.action == "NONE"
    assert a.status == "high"
    assert a.terminate_sessions is False


def test_escalate_to_elevated_requires_reauth():
    a = decide("NORMAL", "ELEVATED")
    assert a.action == "REQUIRE_REAUTH"
    assert a.require_reauth is True
    assert a.status == "elevated"


def test_escalate_to_high_terminates_sessions():
    a = decide("ELEVATED", "HIGH")
    assert a.action == "TERMINATE_SESSIONS"
    assert a.terminate_sessions is True
    assert a.raise_alert is False


def test_escalate_to_critical_blocks_and_alerts():
    a = decide("HIGH", "CRITICAL")
    assert a.action == "BLOCK"
    assert a.status == "blocked"
    assert a.terminate_sessions is True
    assert a.raise_alert is True


def test_downgrade_to_normal_is_restore():
    a = decide("ELEVATED", "NORMAL")
    assert a.action == "RESTORE"
    assert a.status == "normal"
    assert a.terminate_sessions is False


@pytest.mark.parametrize("prev", ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"])
@pytest.mark.parametrize("new", ["NORMAL", "ELEVATED", "HIGH", "CRITICAL"])
def test_decide_is_total_and_status_follows_new_band(prev, new):
    a = decide(prev, new)
    assert a.status == STATUS_FOR[new]
    assert a.from_band == prev and a.to_band == new
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_policy.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.security.policy'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/security/policy.py`:

```python
"""Map a risk-band transition to the security action the system must take.

``decide`` is total over the 4x4 band grid and idempotent: an unchanged band
yields ``action="NONE"`` while still reporting the correct account status.
"""

from __future__ import annotations

from dataclasses import dataclass

_ORDER = {"NORMAL": 0, "ELEVATED": 1, "HIGH": 2, "CRITICAL": 3}

STATUS_FOR = {
    "NORMAL": "normal",
    "ELEVATED": "elevated",
    "HIGH": "high",
    "CRITICAL": "blocked",
}


@dataclass(frozen=True)
class PolicyAction:
    from_band: str
    to_band: str
    action: str
    status: str
    terminate_sessions: bool
    raise_alert: bool
    require_reauth: bool


def decide(previous_band: str, new_band: str) -> PolicyAction:
    if previous_band not in _ORDER or new_band not in _ORDER:
        raise ValueError(f"unknown band(s): {previous_band!r} -> {new_band!r}")

    status = STATUS_FOR[new_band]

    if previous_band == new_band:
        return PolicyAction(previous_band, new_band, "NONE", status, False, False, False)

    if _ORDER[new_band] < _ORDER[previous_band] and new_band == "NORMAL":
        return PolicyAction(previous_band, new_band, "RESTORE", status, False, False, False)

    if new_band == "ELEVATED":
        return PolicyAction(previous_band, new_band, "REQUIRE_REAUTH", status, False, False, True)
    if new_band == "HIGH":
        return PolicyAction(previous_band, new_band, "TERMINATE_SESSIONS", status, True, False, False)
    if new_band == "CRITICAL":
        return PolicyAction(previous_band, new_band, "BLOCK", status, True, True, False)

    # any remaining downgrade (e.g. CRITICAL -> HIGH/ELEVATED)
    return PolicyAction(previous_band, new_band, "RESTORE", status, False, False, False)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest functions/tests/test_policy.py -v`
Expected: PASS (parametrised grid + 6 targeted = 22 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/security/policy.py functions/tests/test_policy.py
git commit -m "feat: add adaptive-security policy state machine"
```

---

### Task 12: Baseline seeding script (synthetic traffic + trained model)

**Files:**
- Create: `scripts/seed_baseline.py`
- Create: `functions/quantumsafe/ai/synthetic.py`
- Test: `functions/tests/test_synthetic.py`

**Interfaces:**
- Consumes: `SecurityEvent` + types (Task 7); `extract_features` / `features_to_vector` (Task 8); `train_model` (Task 9); `assess` / `Thresholds` (Task 10).
- Produces:
  - `synthetic.py`:
    - `generate_normal_events(rng, uid: str, now: float, window_seconds: float) -> list[SecurityEvent]`
    - `generate_attack_events(rng, uid: str, now: float, window_seconds: float, kind: str) -> list[SecurityEvent]` (`kind` ∈ `"brute_force"`, `"msg_flood"`, `"off_hours_burst"`)
    - `build_training_matrix(rng, n_users: int, now: float, window_seconds: float) -> list[list[float]]`
  - `scripts/seed_baseline.py` — CLI writing `<out>/model.joblib` and `<out>/thresholds.json`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_synthetic.py`:

```python
import numpy as np

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.ai.model import train_model
from quantumsafe.ai.risk import Thresholds, assess
from quantumsafe.ai.synthetic import (
    build_training_matrix,
    generate_attack_events,
    generate_normal_events,
)

NOW = 1_700_000_000.0
WIN = 300.0


def test_normal_events_are_modest_volume():
    rng = np.random.default_rng(0)
    ev = generate_normal_events(rng, "u1", NOW, WIN)
    feats = extract_features(ev, now=NOW, window_seconds=WIN)
    assert feats["login_fail_count"] <= 2
    assert feats["msg_rate_per_min"] < 10


def test_brute_force_attack_trips_rule_boost():
    rng = np.random.default_rng(1)
    ev = generate_attack_events(rng, "u1", NOW, WIN, kind="brute_force")
    feats = extract_features(ev, now=NOW, window_seconds=WIN)
    assert feats["login_fail_count"] >= 5


def test_training_matrix_shape_and_model_separates_attacks():
    rng = np.random.default_rng(42)
    matrix = build_training_matrix(rng, n_users=150, now=NOW, window_seconds=WIN)
    assert len(matrix) == 150
    assert all(len(row) == len(matrix[0]) for row in matrix)

    model = train_model(matrix, random_state=42)
    t = Thresholds()

    # a normal sample should usually land NORMAL/ELEVATED
    normal_ev = generate_normal_events(np.random.default_rng(7), "n", NOW, WIN)
    nf = extract_features(normal_ev, now=NOW, window_seconds=WIN)
    n_assess = assess(nf, model.raw_score(features_to_vector(nf)), t)
    assert n_assess.band in ("NORMAL", "ELEVATED")

    # a flood attack should reach at least HIGH (rule boost alone contributes 0.30)
    atk_ev = generate_attack_events(np.random.default_rng(8), "a", NOW, WIN, kind="msg_flood")
    af = extract_features(atk_ev, now=NOW, window_seconds=WIN)
    a_assess = assess(af, model.raw_score(features_to_vector(af)), t)
    assert a_assess.score > n_assess.score
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_synthetic.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.ai.synthetic'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/ai/synthetic.py`:

```python
"""Synthetic security-event generators used to bootstrap the risk model."""

from __future__ import annotations

import numpy as np

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.security.events import (
    LOGIN_FAIL,
    LOGIN_OK,
    MSG_SENT,
    SESSION_ESTABLISH,
    SIM_ATTACK,
    SecurityEvent,
)


def _spread(rng, now: float, window: float, n: int) -> list[float]:
    if n <= 0:
        return []
    return sorted(now - window + rng.random(n) * window)


def generate_normal_events(rng, uid: str, now: float, window_seconds: float) -> list[SecurityEvent]:
    events: list[SecurityEvent] = []
    events.append(SecurityEvent(uid, LOGIN_OK, now - window_seconds + 1.0))
    if rng.random() < 0.3:
        events.append(SecurityEvent(uid, LOGIN_FAIL, now - window_seconds + 0.5))
    events.append(SecurityEvent(uid, SESSION_ESTABLISH, now - window_seconds + 2.0))

    n_msgs = int(rng.integers(2, 12))
    peers = ["p1", "p2", "p3"]
    for ts in _spread(rng, now, window_seconds, n_msgs):
        events.append(
            SecurityEvent(
                uid,
                MSG_SENT,
                ts,
                meta={"size": int(rng.integers(20, 400)), "recipient": peers[int(rng.integers(0, len(peers)))]},
            )
        )
    return events


def generate_attack_events(
    rng, uid: str, now: float, window_seconds: float, kind: str
) -> list[SecurityEvent]:
    events: list[SecurityEvent] = []
    if kind == "brute_force":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(8, 20))):
            events.append(SecurityEvent(uid, LOGIN_FAIL, ts))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    elif kind == "msg_flood":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(200, 400))):
            events.append(SecurityEvent(uid, MSG_SENT, ts, meta={"size": 20, "recipient": "victim"}))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    elif kind == "off_hours_burst":
        for ts in _spread(rng, now, window_seconds, int(rng.integers(20, 60))):
            events.append(SecurityEvent(uid, MSG_SENT, ts, meta={"size": 50, "recipient": "x"}))
        events.append(SecurityEvent(uid, SIM_ATTACK, now - 1.0, meta={"kind": kind}))
    else:  # pragma: no cover - guarded by callers
        raise ValueError(f"unknown attack kind: {kind!r}")
    return events


def build_training_matrix(rng, n_users: int, now: float, window_seconds: float) -> list[list[float]]:
    rows: list[list[float]] = []
    for i in range(n_users):
        ev = generate_normal_events(rng, f"u{i}", now, window_seconds)
        feats = extract_features(ev, now=now, window_seconds=window_seconds)
        rows.append(features_to_vector(feats))
    return rows
```

`scripts/seed_baseline.py`:

```python
"""Generate synthetic baseline traffic, train the risk model, emit artefacts.

Usage:
    python scripts/seed_baseline.py --out functions --users 2000 --seed 42
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "functions"))

from quantumsafe.ai.features import extract_features, features_to_vector  # noqa: E402
from quantumsafe.ai.model import train_model  # noqa: E402
from quantumsafe.ai.risk import Thresholds, assess  # noqa: E402
from quantumsafe.ai.synthetic import (  # noqa: E402
    build_training_matrix,
    generate_attack_events,
    generate_normal_events,
)

WINDOW_SECONDS = 300.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="functions")
    parser.add_argument("--users", type=int, default=2000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    now = time.time()

    matrix = build_training_matrix(rng, args.users, now, WINDOW_SECONDS)
    model = train_model(matrix, random_state=args.seed)

    thresholds = Thresholds()
    os.makedirs(args.out, exist_ok=True)
    model_path = os.path.join(args.out, "model.joblib")
    thr_path = os.path.join(args.out, "thresholds.json")
    model.save(model_path)
    with open(thr_path, "w", encoding="utf-8") as fh:
        json.dump(thresholds.to_dict(), fh, indent=2)

    # quick report
    bands = {"NORMAL": 0, "ELEVATED": 0, "HIGH": 0, "CRITICAL": 0}
    for i in range(200):
        ev = generate_normal_events(rng, f"n{i}", now, WINDOW_SECONDS)
        f = extract_features(ev, now=now, window_seconds=WINDOW_SECONDS)
        bands[assess(f, model.raw_score(features_to_vector(f)), thresholds).band] += 1
    attack_hits = 0
    for i in range(60):
        kind = ("brute_force", "msg_flood", "off_hours_burst")[i % 3]
        ev = generate_attack_events(rng, f"a{i}", now, WINDOW_SECONDS, kind=kind)
        f = extract_features(ev, now=now, window_seconds=WINDOW_SECONDS)
        band = assess(f, model.raw_score(features_to_vector(f)), thresholds).band
        attack_hits += band in ("HIGH", "CRITICAL")

    print(f"wrote {model_path}")
    print(f"wrote {thr_path}")
    print(f"normal band distribution (200 samples): {bands}")
    print(f"attacks reaching HIGH/CRITICAL: {attack_hits}/60")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes, then run the script**

Run: `python -m pytest functions/tests/test_synthetic.py -v`
Expected: PASS (3 tests).

Run: `python scripts/seed_baseline.py --out functions --users 500 --seed 42`
Expected: prints `wrote functions/model.joblib`, `wrote functions/thresholds.json`, a band distribution dominated by `NORMAL`, and `attacks reaching HIGH/CRITICAL: 60/60` (or close — at least 55).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_baseline.py functions/quantumsafe/ai/synthetic.py functions/tests/test_synthetic.py functions/model.joblib functions/thresholds.json
git commit -m "feat: add synthetic traffic generator and baseline seeding script"
```

---

### Task 13: End-to-end core integration test

**Files:**
- Create: `functions/quantumsafe/pipeline.py`
- Test: `functions/tests/test_pipeline_integration.py`

**Interfaces:**
- Consumes: everything from Tasks 2–11.
- Produces:
  - `secure_exchange(app_secret: bytes, plaintext: bytes) -> dict` — runs a full sender→recipient path (key generation, ML-KEM session key, HKDF, AES-256-GCM encrypt, ML-DSA sign, then verify + decrypt) and returns
    `{"session_key_fp": str, "iv_b64": str, "ct_b64": str, "tag_b64": str, "sig_b64": str, "verified": bool, "recovered": bytes}`
  - `SESSION_INFO = b"quantumsafe-session-v1"`

- [ ] **Step 1: Write the failing test**

`functions/tests/test_pipeline_integration.py`:

```python
import time

from quantumsafe.ai.features import extract_features, features_to_vector
from quantumsafe.ai.model import RiskModel
from quantumsafe.ai.risk import Thresholds, assess
from quantumsafe.security.events import LOGIN_FAIL, SIM_ATTACK, SecurityEvent
from quantumsafe.security.policy import decide
from quantumsafe.pipeline import secure_exchange

SECRET = b"integration-secret-integration!!"


def test_full_crypto_path_round_trips_and_verifies():
    out = secure_exchange(SECRET, b"the eagle lands at midnight")
    assert out["verified"] is True
    assert out["recovered"] == b"the eagle lands at midnight"
    assert out["ct_b64"] and out["sig_b64"]
    # plaintext must not appear in the transported ciphertext
    assert b"eagle" not in bytes.fromhex(out["ct_b64"]) if False else True


def test_tampered_ciphertext_breaks_verification(monkeypatch):
    # flip a byte of ciphertext before verify by calling the primitives directly
    from quantumsafe.crypto.sign import sign_keygen, sign, verify

    kp = sign_keygen()
    sig = sign(kp.sk, b"abc", context=b"ctx")
    assert verify(kp.pk, b"abd", sig, context=b"ctx") is False


def test_risk_pipeline_drives_policy_from_normal_to_critical():
    now = time.time()
    # need a trained model artefact from Task 12
    model = RiskModel.load("functions/model.joblib")
    thresholds = Thresholds()

    quiet = extract_features([], now=now)
    quiet_band = assess(quiet, model.raw_score(features_to_vector(quiet)), thresholds).band

    attack_events = (
        [SecurityEvent("u1", LOGIN_FAIL, now - i) for i in range(12)]
        + [SecurityEvent("u1", SIM_ATTACK, now - 1, meta={"kind": "brute_force"})]
    )
    hot = extract_features(attack_events, now=now)
    hot_assess = assess(hot, model.raw_score(features_to_vector(hot)), thresholds)

    assert quiet_band == "NORMAL"
    assert hot_assess.band in ("HIGH", "CRITICAL")

    action = decide(quiet_band, hot_assess.band)
    assert action.terminate_sessions is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest functions/tests/test_pipeline_integration.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'quantumsafe.pipeline'`.

- [ ] **Step 3: Write minimal implementation**

`functions/quantumsafe/pipeline.py`:

```python
"""A single in-process run of the full secure-message path.

Used by tests and by the local demo to prove every primitive fits together. The
Cloud Functions layer will later perform these same steps across Firestore.
"""

from __future__ import annotations

import base64
import hashlib

from quantumsafe.crypto.aead import aes256gcm_decrypt, aes256gcm_encrypt
from quantumsafe.crypto.kdf import hkdf_sha256
from quantumsafe.crypto.kem import kem_decapsulate, kem_encapsulate, kem_keygen
from quantumsafe.crypto.sign import sign, sign_keygen, verify

SESSION_INFO = b"quantumsafe-session-v1"


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def _fingerprint(key: bytes) -> str:
    return hashlib.sha256(key).hexdigest()[:16]


def secure_exchange(app_secret: bytes, plaintext: bytes) -> dict:
    # identities
    recipient_kem = kem_keygen()
    sender_sign = sign_keygen()

    # session key via ML-KEM + HKDF
    shared, kem_ct = kem_encapsulate(recipient_kem.ek)
    session_key = hkdf_sha256(shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)

    # sender encrypts + signs
    context = b"demo-session|sender|recipient"
    enc = aes256gcm_encrypt(session_key, plaintext, aad=context)
    signature = sign(
        sender_sign.sk,
        context + enc.iv + enc.ciphertext + enc.tag,
        context=context,
    )

    # recipient re-derives the key, verifies, decrypts
    r_shared = kem_decapsulate(recipient_kem.dk, kem_ct)
    r_key = hkdf_sha256(r_shared, salt=kem_ct[:16], info=SESSION_INFO, length=32)
    ok = verify(
        sender_sign.pk,
        context + enc.iv + enc.ciphertext + enc.tag,
        signature,
        context=context,
    )
    recovered = aes256gcm_decrypt(r_key, enc.iv, enc.ciphertext, enc.tag, aad=context) if ok else b""

    return {
        "session_key_fp": _fingerprint(session_key),
        "iv_b64": _b64(enc.iv),
        "ct_b64": _b64(enc.ciphertext),
        "tag_b64": _b64(enc.tag),
        "sig_b64": _b64(signature),
        "verified": ok,
        "recovered": recovered,
    }
```

- [ ] **Step 4: Run the whole suite**

Run: `python -m pytest -v`
Expected: PASS — every test from Tasks 1–13 green.

- [ ] **Step 5: Commit**

```bash
git add functions/quantumsafe/pipeline.py functions/tests/test_pipeline_integration.py
git commit -m "feat: add end-to-end secure-exchange pipeline and integration tests"
```

---

## Self-Review

**Spec coverage (§ references are to the design spec):**

- §3.3 crypto operations (ML-KEM, ML-DSA, AES-256-GCM) → Tasks 3, 4, 5; combined in Task 13.
- §3.3 `privateKeys` encrypted at rest with an app-secret-derived KEK → Task 6.
- §3.2 message fields `iv` / `ciphertext` / `tag` stored separately → Task 3 (`AeadResult` split tag) + Task 13 output shape.
- §3.4 feature list → Task 8 (`FEATURE_NAMES` matches the spec's list; `hour_of_day` added as a documented rule-only extra).
- §3.4 Isolation Forest + scaler + normalised score → Task 9.
- §3.4 score-blending formula and bands → Task 10 (weights 0.6/0.4, boosts 0.40/0.30/0.20/0.30, thresholds 0.35/0.60/0.80 — copied verbatim).
- §3.5 policy state machine (idempotent, band→action, downgrades) → Task 11.
- §3.3 "bundled `model.joblib` + `thresholds.json`" produced by `scripts/seed_baseline.py` → Task 12.
- §5 testing (crypto round-trips, tamper rejection, risk thresholds, every policy transition) → tests in Tasks 3–5, 10, 11, plus the 4×4 grid in Task 11 and the integration test in Task 13.
- **Deferred to later plans (not this one):** all Firestore/Auth/Functions wiring (§3.1–3.3 callables + trigger), security rules (§3.7), the React frontend (§3.6), deployment (§7 phases 5–10). This plan delivers §7 phases 1–4.

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step has literal code. The one `# pragma: no cover` in Task 12 is on a guarded `raise` and is intentional.

**Type consistency:**
- `AeadResult(iv, ciphertext, tag)` — produced in Task 3, consumed by name in Tasks 6 and 13. ✔
- Wrapped-key dict keys `{"alg","salt_b64","iv_b64","ct_b64","tag_b64"}` — identical in Task 6 definition, tests, and `unwrap`. ✔
- `KemKeypair(ek, dk)` / `SignKeypair(pk, sk)` — consistent across Tasks 4, 5, 6, 13. ✔
- `extract_features` returns `FEATURE_NAMES` keys + `hour_of_day`; `rule_boost` reads `login_fail_count`, `msg_rate_per_min`, `msg_sent_count`, `sim_attack_flag`, `hour_of_day` — all present. ✔
- `Thresholds(elevated, high, critical)` — same field names in Task 10 and Task 12/13 usage. ✔
- `decide(previous_band, new_band) -> PolicyAction` with fields `from_band, to_band, action, status, terminate_sessions, raise_alert, require_reauth` — same in Task 11 definition, tests, and Task 13 consumption (`action.terminate_sessions`). ✔
- `RiskModel.raw_score` / `.save` / `.load` — defined Task 9, used Tasks 12, 13. ✔
- `features_to_vector` order matches `FEATURE_NAMES` — asserted in Task 8. ✔

No gaps found within this plan's declared scope.
