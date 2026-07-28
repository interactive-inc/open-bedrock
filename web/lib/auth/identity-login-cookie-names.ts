export type IdentityLoginCookieNames = {
  state: string
  verifier: string
}

/**
 * HTTPSでは__Host- prefixを使い、stateごとに分けて並行ログインを成立させる。
 */
export function identityLoginCookieNames(
  redirectUri: string,
  state: string,
): IdentityLoginCookieNames {
  const prefix = new URL(redirectUri).protocol === "https:" ? "__Host-" : ""

  return {
    state: `${prefix}identity_login_state_${state}`,
    verifier: `${prefix}identity_login_verifier_${state}`,
  }
}
