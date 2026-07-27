import { factory } from "@/factory"

export const help = `bedrock departments — 部署と組織図

usage:
  bedrock departments list                                        部署一覧
  bedrock departments show <dept_code>                            部署の詳細
  bedrock departments tree                                        部署ツリー
  bedrock departments members <dept_code>                         部署メンバー
  bedrock departments create --code <c> --name <n> [--parent-code <p>]  部署作成（管理者）
  bedrock departments update <code> [--name <n>] [--parent-code <p>]  部署更新（管理者）
  bedrock departments delete <code>                               部署削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
