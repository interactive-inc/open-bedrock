/**
 * Account列挙のtiming side-channelを抑えるため、未知のIdentityでも実credentialと同じ
 * PBKDF2検証costを必ず支払う。値は資格情報ではない。
 */
export const decoySystemPasswordHash =
  "pbkdf2:100000:c3lzdGVtLWRlY295LWtleQ==:/dqnFVKB+Tkzk5pz/JL3Cc2wzWZnJ5QsNS6hBXCJc50="
