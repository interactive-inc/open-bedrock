import { z } from "zod"

const jwtPayloadSchema = z.object({ exp: z.number() })

// JWT が読めない/期限切れのときのフォールバック（従来値の 8 時間）。
const fallbackSeconds = 60 * 60 * 8

// session cookie の maxAge を JWT の exp（秒）から算出する。
// API 側で JWT 寿命を変えても cookie が追従し、「cookie 有効・JWT 失効」の窓を作らない。
// 署名は検証しない（直前にログイン API から受け取った自分のトークンの exp を読むだけ）。
export function sessionMaxAge(token: string): number {
  const payloadSegment = token.split(".").at(1)

  if (payloadSegment === undefined) {
    return fallbackSeconds
  }

  try {
    const payloadText = Buffer.from(payloadSegment, "base64url").toString("utf8")

    const parsed = jwtPayloadSchema.safeParse(JSON.parse(payloadText))

    if (parsed.success === false) {
      return fallbackSeconds
    }

    const remainingSeconds = parsed.data.exp - Math.floor(Date.now() / 1000)

    return remainingSeconds > 0 ? remainingSeconds : fallbackSeconds
  } catch {
    return fallbackSeconds
  }
}
