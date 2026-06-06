import { factory } from "@/factory"

export const help = `karte thanks — 感謝（サンクス）

usage:
  karte thanks list [--limit <n>] [--offset <n>]              感謝のタイムライン（新着順）
  karte thanks send --to <employee_code> --message <m>        感謝を送る（受信者にだけ通知）`

export default factory.createHandlers((c) => c.text(help))
