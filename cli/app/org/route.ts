import { factory } from "@/factory"

export const help = `bedrock org — 組織図

usage:
  bedrock org tree                       部署ツリー
  bedrock org members <dept_code>        部署メンバー
  bedrock org line <employee_code>       レポートライン（上位）`

export default factory.createHandlers((c) => c.text(help))
