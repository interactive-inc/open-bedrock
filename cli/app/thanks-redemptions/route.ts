import { factory } from "@/factory"

export const help = `bedrock thanks-redemptions — サンクスの交換申請

usage:
  bedrock thanks-redemptions list [--scope me|inbox|admin]        交換申請一覧
  bedrock thanks-redemptions create --reward-id <n>               交換を申請
  bedrock thanks-redemptions approve <id>                         交換を承認
  bedrock thanks-redemptions reject <id>                          交換を却下`

export default factory.createHandlers((c) => c.text(help))
