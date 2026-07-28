import { createLocalJWKSet, exportJWK, generateKeyPair } from "jose"

import type { JSONWebKeySet, JWTVerifyGetKey, KeyLike } from "jose"

export type IdentityTestKey = {
  signingKey: KeyLike | Uint8Array
  keyId: string
  jwks: string
  verificationKey: JWTVerifyGetKey
}

/**
 * テスト実行中だけ存在するEd25519鍵と公開JWKSを作る。
 */
export async function createIdentityTestKey(keyId = "identity-test-key"): Promise<IdentityTestKey> {
  const pair = await generateKeyPair("EdDSA", { extractable: true })
  const exported = await exportJWK(pair.publicKey)
  const keySet: JSONWebKeySet = {
    keys: [{ ...exported, kid: keyId, alg: "EdDSA", use: "sig" }],
  }

  return {
    signingKey: pair.privateKey,
    keyId,
    jwks: JSON.stringify(keySet),
    verificationKey: createLocalJWKSet(keySet),
  }
}
