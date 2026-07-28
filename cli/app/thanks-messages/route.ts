import { factory } from "@/factory"

export const help = `bedrock thanks-messages — 感謝（サンクス）

usage:
  bedrock thanks-messages list [--limit <n>] [--offset <n>]       感謝のタイムライン（新着順）
  bedrock thanks-messages send --to <employee_code> --message <m>  感謝を送る（受信者にだけ通知）`

export default factory.createHandlers((c) => c.text(help))
