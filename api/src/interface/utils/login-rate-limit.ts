const LIMIT = 5 // ウィンドウ内の最大失敗数
const WINDOW_SECONDS = 900 // ウィンドウ幅（秒）。15分

function ipKey(ip: string): string {
  return `login:fail:ip:${ip}`
}

function accountKey(email: string): string {
  return `login:fail:account:${email.toLowerCase()}`
}

/**
 * ウィンドウ内の失敗数が閾値を超えているかチェックする。
 * 超えていれば true を返す（呼び出し側は 429 を返すこと）。
 * 値は失敗タイムスタンプ（Unix 秒）の JSON 配列で、ウィンドウ内の数が LIMIT 以上なら超過とみなす。
 * KV 読み取りに失敗した場合はフェイルオープン（false を返す）にしてサービスを継続する。
 */
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

/**
 * 失敗タイムスタンプを KV キーに追記する。
 * ウィンドウ外の古いタイムスタンプは同時に除去する。
 * KV は last write wins のため高頻度時に追記が一部上書きされうるが、
 * カウントが過小になる方向にしか働かない（過剰ブロックしない）ので許容する。
 */
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

/** KV キーを削除する。 */
async function clearByKey(kv: KVNamespace, key: string): Promise<void> {
  try {
    await kv.delete(key)
  } catch (error) {
    console.error("[login-rate-limit] KV delete failed, skipping failure clear:", error)
  }
}

/**
 * IP ベースのレート制限チェック。
 * 本番では RATE_LIMIT KV namespace のバインドが必須（wrangler.jsonc の kv_namespaces）。
 * 未バインド時（ローカル開発）は呼び出し側がレート制限をスキップする
 */
export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  return checkByKey(kv, ipKey(ip))
}

/**
 * アカウント（メールアドレス）ベースのレート制限チェック。
 * IP は Cloudflare 経由以外だと X-Forwarded-For 偽装で回避できるため、
 * アカウント単位を併用して単一アカウントへの総当たりを防ぐ
 */
export async function checkAccountRateLimit(kv: KVNamespace, email: string): Promise<boolean> {
  return checkByKey(kv, accountKey(email))
}

/** IP カウンタに失敗を記録する。 */
export async function recordFailure(kv: KVNamespace, ip: string): Promise<void> {
  return recordByKey(kv, ipKey(ip))
}

/** アカウントカウンタに失敗を記録する。 */
export async function recordAccountFailure(kv: KVNamespace, email: string): Promise<void> {
  return recordByKey(kv, accountKey(email))
}

/**
 * アカウントカウンタをリセットする（ログイン成功時）。
 * IP カウンタは意図的に消さず TTL で自然消滅させる。共有 IP 環境で
 * 正規ユーザの成功が攻撃者のカウンタまでリセットするのを防ぐため
 */
export async function clearAccountFailures(kv: KVNamespace, email: string): Promise<void> {
  return clearByKey(kv, accountKey(email))
}
