import { factory } from "@/factory"

export const help = `bedrock thanks-point-balances — サンクスの受領残高

usage:
  bedrock thanks-point-balances me                                自分の受領残高`

export default factory.createHandlers((c) => c.text(help))
