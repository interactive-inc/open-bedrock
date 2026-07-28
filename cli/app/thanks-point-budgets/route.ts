import { factory } from "@/factory"

export const help = `bedrock thanks-point-budgets — サンクスの当月原資（送れる枠）

usage:
  bedrock thanks-point-budgets me                                 自分の当月の贈与原資

受領残高（もらった点数）は別リソース:
  bedrock thanks-point-balances me`

export default factory.createHandlers((c) => c.text(help))
