const LIMIT = 5 // ウィンドウ内の最大失敗数
const WINDOW_SECONDS = 900 // ウィンドウ幅（秒）。15分

/**
 * ログイン失敗のレート制限。Workers KV に失敗タイムスタンプ（Unix 秒）の JSON 配列を記録し、
 * ウィンドウ内の失敗数が LIMIT 以上なら超過とみなす。
 * IP は Cloudflare 経由以外だと X-Forwarded-For 偽装で回避できるため、
 * アカウント（メールアドレス）単位を併用して単一アカウントへの総当たりを防ぐ。
 * 本番では RATE_LIMIT KV namespace のバインドが必須（wrangler.jsonc の kv_namespaces）。
 * 未バインド時（ローカル開発）は呼び出し側がレート制限をスキップする
 */
export class LoginRateLimiter {
  constructor(private readonly kv: KVNamespace) {
    Object.freeze(this)
  }

  /** IP のウィンドウ内失敗数が閾値を超えているか。超過なら呼び出し側は 429 を返すこと。 */
  async isIpLimited(ip: string): Promise<boolean> {
    return this.isLimitedByKey(this.toIpKey(ip))
  }

  /** アカウントのウィンドウ内失敗数が閾値を超えているか。超過なら呼び出し側は 429 を返すこと。 */
  async isAccountLimited(email: string): Promise<boolean> {
    return this.isLimitedByKey(this.toAccountKey(email))
  }

  /** IP カウンタに失敗を記録する。 */
  async recordIpFailure(ip: string): Promise<void> {
    return this.recordByKey(this.toIpKey(ip))
  }

  /** アカウントカウンタに失敗を記録する。 */
  async recordAccountFailure(email: string): Promise<void> {
    return this.recordByKey(this.toAccountKey(email))
  }

  /**
   * アカウントカウンタをリセットする（ログイン成功時）。
   * IP カウンタは意図的に消さず TTL で自然消滅させる。共有 IP 環境で
   * 正規ユーザの成功が攻撃者のカウンタまでリセットするのを防ぐため
   */
  async clearAccountFailures(email: string): Promise<void> {
    return this.clearByKey(this.toAccountKey(email))
  }

  private toIpKey(ip: string): string {
    return `login:fail:ip:${ip}`
  }

  private toAccountKey(email: string): string {
    return `login:fail:account:${email.toLowerCase()}`
  }

  /** KV 読み取りに失敗した場合はフェイルオープン（false を返す）にしてサービスを継続する。 */
  private async isLimitedByKey(key: string): Promise<boolean> {
    try {
      const raw = await this.kv.get(key)

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
   * 失敗タイムスタンプを KV キーに追記する。ウィンドウ外の古いタイムスタンプは同時に除去する。
   * KV は last write wins のため高頻度時に追記が一部上書きされうるが、
   * カウントが過小になる方向にしか働かない（過剰ブロックしない）ので許容する。
   */
  private async recordByKey(key: string): Promise<void> {
    try {
      const raw = await this.kv.get(key)
      const existing: number[] = raw !== null ? JSON.parse(raw) : []

      const now = Math.floor(Date.now() / 1000)
      const cutoff = now - WINDOW_SECONDS
      const recent = existing.filter((t) => t >= cutoff)
      recent.push(now)

      await this.kv.put(key, JSON.stringify(recent), { expirationTtl: WINDOW_SECONDS * 2 })
    } catch (error) {
      console.error("[login-rate-limit] KV write failed, skipping failure record:", error)
    }
  }

  private async clearByKey(key: string): Promise<void> {
    try {
      await this.kv.delete(key)
    } catch (error) {
      console.error("[login-rate-limit] KV delete failed, skipping failure clear:", error)
    }
  }
}
