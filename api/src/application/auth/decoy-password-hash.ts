/**
 * ユーザー列挙のタイミングサイドチャネル対策に使う固定デコイハッシュ（#212）。
 * 実在しないメールでのログイン時も、verifyPassword の照合先としてこれを渡すことで
 * 実在ユーザーと同じ PBKDF2 検証コスト（反復 100k・鍵長 32 バイト）を払う。
 * どの平文とも一致しないため認証は必ず失敗する。
 *
 * 保存形式 `pbkdf2:<iterations>:<base64(salt)>:<base64(hash)>` の事前計算済みリテラル。
 * 起動時の暗号計算（top-level await）を避けるため、固定ソルト・固定デコイ平文から
 * 1 度算出した値をそのまま埋め込んでいる。値自体は秘密ではなく、検証コストを
 * 実在ユーザー経路と一致させることだけが目的（反復回数は to-password-hash と同じ 100k）。
 */
export const decoyPasswordHash =
  "pbkdf2:100000:b3Blbi1rYXJ0ZS1kZWNveQ==:ohQQzW7G8wDud6ur2+5pFaeFhv1yElXmqGs4qFb0sFU="
