import { factory } from "@/factory"

export const help = `bedrock employee-events — 異動・在籍イベント履歴

usage:
  bedrock employee-events list [--employee-id <id>] [--kind <k>]   本人 or 全社閲覧権限

新しい人事変更は bedrock personnel-actions request / apply を使用する。`

export default factory.createHandlers((c) => c.text(help))
