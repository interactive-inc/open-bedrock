// ログインエンドポイント向け IP ベースのレート制限ユーティリティ。
// Workers KV を使い、同一 IP からの失敗が閾値を超えた場合に 429 を返す。
//
// 設計: 「タイムスタンプリスト」方式
//   キー: login:fail:{ip}
//   値:   失敗タイムスタンプ（Unix 秒）の配列（JSON）
//   ウィンドウ内のタイムスタンプ数が LIMIT を超えたら 429。
//   成功時はキーごと削除してカウンタをリセットする。
//
// アトミック性について:
//   KV は "last write wins" のため、高頻度リクエストでタイムスタンプが
//   一部上書きされてもカウントが過小になる方向にしか働かない（過剰ブロックはしない）。
//   これは Workers KV の特性上の既知の許容範囲とする。

const LIMIT = 5 // ウィンドウ内の最大失敗数
const WINDOW_SECONDS = 900 // ウィンドウ幅（秒）。15分

function kvKey(ip: string): string {
  return `login:fail:${ip}`
}

/**
 * ウィンドウ内の失敗数が閾値を超えているかチェックする。
 * 超えていれば true を返す（呼び出し側は 429 を返すこと）。
 */
export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const raw = await kv.get(kvKey(ip))
  if (raw === null) return false

  const timestamps: number[] = JSON.parse(raw)
  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - WINDOW_SECONDS
  const recent = timestamps.filter((t) => t >= cutoff)

  return recent.length >= LIMIT
}

/**
 * ログイン失敗を記録する。
 * ウィンドウ外の古いタイムスタンプは同時に除去する。
 */
export async function recordFailure(kv: KVNamespace, ip: string): Promise<void> {
  const raw = await kv.get(kvKey(ip))
  const existing: number[] = raw !== null ? JSON.parse(raw) : []

  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - WINDOW_SECONDS
  const recent = existing.filter((t) => t >= cutoff)
  recent.push(now)

  await kv.put(kvKey(ip), JSON.stringify(recent), { expirationTtl: WINDOW_SECONDS })
}

/**
 * ログイン成功時にカウンタをリセットする（キーを削除する）。
 */
export async function clearFailures(kv: KVNamespace, ip: string): Promise<void> {
  await kv.delete(kvKey(ip))
}
