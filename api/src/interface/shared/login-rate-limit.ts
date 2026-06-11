// ログインエンドポイント向けレート制限ユーティリティ。
// Workers KV を使い、同一 IP またはアカウント（メールアドレス）からの
// 失敗が閾値を超えた場合に 429 を返す。
//
// IP 単位: Cloudflare 経由であれば CF-Connecting-IP が信頼できるが、
//   それ以外の経路では X-Forwarded-For 偽装で回避可能なため、
//   アカウント単位のカウンタを併用して単一アカウントへの総当たりを防ぐ。
//
// 設計: 「タイムスタンプリスト」方式
//   キー: login:fail:ip:{ip} / login:fail:account:{email}
//   値:   失敗タイムスタンプ（Unix 秒）の配列（JSON）
//   ウィンドウ内のタイムスタンプ数が LIMIT を超えたら 429。
//   成功時はキーごと削除してカウンタをリセットする。
//
// アトミック性について:
//   KV は "last write wins" のため、高頻度リクエストでタイムスタンプが
//   一部上書きされてもカウントが過小になる方向にしか働かない（過剰ブロックはしない）。
//   これは Workers KV の特性上の既知の許容範囲とする。
//
// 本番環境では RATE_LIMIT KV namespace のバインドが必須。
// 未バインド時（ローカル開発）はレート制限がスキップされるが、
// 本番デプロイでは wrangler.jsonc の kv_namespaces 設定を必ず有効にすること。

const LIMIT = 5 // ウィンドウ内の最大失敗数
const WINDOW_SECONDS = 900 // ウィンドウ幅（秒）。15分

function ipKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function accountKey(email: string): string {
  return `login:fail:account:${email.toLowerCase()}`
}

// ウィンドウ内の失敗数が閾値を超えているかチェックする。
// 超えていれば true を返す（呼び出し側は 429 を返すこと）。
// KV 読み取りに失敗した場合はフェイルオープン（false を返す）にしてサービスを継続する。
async function checkByKey(kv: KVNamespace, key: string): Promise<boolean> {
  try {
    const raw = await kv.get(key)

    if (raw === null) return false

    const timestamps: number[] = JSON.parse(raw)
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - WINDOW_SECONDS
    const recent = timestamps.filter((t) => t >= cutoff)

    return recent.length >= LIMIT
  } catch (error) {
    console.error("[login-rate-limit] KV read failed, skipping rate limit:", error)

    return false
  }
}

// 失敗タイムスタンプを KV キーに追記する。
// ウィンドウ外の古いタイムスタンプは同時に除去する。
async function recordByKey(kv: KVNamespace, key: string): Promise<void> {
  try {
    const raw = await kv.get(key)
    const existing: number[] = raw !== null ? JSON.parse(raw) : []

    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - WINDOW_SECONDS
    const recent = existing.filter((t) => t >= cutoff)
    recent.push(now)

    await kv.put(key, JSON.stringify(recent), { expirationTtl: WINDOW_SECONDS * 2 })
  } catch (error) {
    console.error("[login-rate-limit] KV write failed, skipping failure record:", error)
  }
}

// KV キーを削除する。
async function clearByKey(kv: KVNamespace, key: string): Promise<void> {
  try {
    await kv.delete(key)
  } catch (error) {
    console.error("[login-rate-limit] KV delete failed, skipping failure clear:", error)
  }
}

// IP ベースのレート制限チェック。
export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  return checkByKey(kv, ipKey(ip))
}

// アカウント（メールアドレス）ベースのレート制限チェック。
export async function checkAccountRateLimit(kv: KVNamespace, email: string): Promise<boolean> {
  return checkByKey(kv, accountKey(email))
}

// IP カウンタに失敗を記録する。
export async function recordFailure(kv: KVNamespace, ip: string): Promise<void> {
  return recordByKey(kv, ipKey(ip))
}

// アカウントカウンタに失敗を記録する。
export async function recordAccountFailure(kv: KVNamespace, email: string): Promise<void> {
  return recordByKey(kv, accountKey(email))
}

// IP カウンタをリセットする（ログイン成功時）。
export async function clearFailures(kv: KVNamespace, ip: string): Promise<void> {
  return clearByKey(kv, ipKey(ip))
}

// アカウントカウンタをリセットする（ログイン成功時）。
export async function clearAccountFailures(kv: KVNamespace, email: string): Promise<void> {
  return clearByKey(kv, accountKey(email))
}
