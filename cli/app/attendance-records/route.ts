import { factory } from "@/factory"

export const help = `bedrock attendance-records — 勤怠

usage:
  bedrock attendance-records clock-in [--note <n>]                出勤打刻
  bedrock attendance-records clock-out [--note <n>]               退勤打刻
  bedrock attendance-records me [--from <d>] [--to <d>]           自分の勤怠
  bedrock attendance-records summary [--month <m>]                月次サマリ
  bedrock attendance-records list [--employee-id <id>] [--from <d>] [--to <d>]   (employee-id は数値ID)
  bedrock attendance-records overtime [--month <m>] [--scope <reports|all>]   時間外の参考集計（法定判定ではない）`

export default factory.createHandlers((c) => c.text(help))
