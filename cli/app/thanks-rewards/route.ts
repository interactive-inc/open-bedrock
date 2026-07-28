import { factory } from "@/factory"

export const help = `bedrock thanks-rewards — サンクスの交換賞品

usage:
  bedrock thanks-rewards list                                     賞品一覧
  bedrock thanks-rewards create --name <n> --points <n> [--stock <n>]  賞品登録（管理者）`

export default factory.createHandlers((c) => c.text(help))
