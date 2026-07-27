import { factory } from "@/factory"

export const help = `bedrock thanks-point-budgets — サンクスの原資と残高

usage:
  bedrock thanks-point-budgets me                                 自分の当月の贈与原資
  bedrock thanks-point-budgets balance                            自分の受領残高`

export default factory.createHandlers((c) => c.text(help))
