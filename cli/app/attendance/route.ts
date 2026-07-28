import { factory } from "@/factory"

export const help = `bedrock attendance — 勤怠

usage:
  bedrock attendance clock-in [--note <n>]                出勤打刻
  bedrock attendance clock-out [--note <n>]               退勤打刻
  bedrock attendance me [--from <d>] [--to <d>]           自分の勤怠
  bedrock attendance summary [--month <m>]                月次サマリ
  bedrock attendance list [--employee-id <id>] [--from <d>] [--to <d>]   (employee-id は数値ID)
  bedrock attendance overtime [--month <m>] [--scope <reports|all>]   時間外の参考集計（法定判定ではない）`

export default factory.createHandlers((c) => c.text(help))
