import { factory } from "@/factory"

export const help = `bedrock shift-assignments — シフト割当

usage:
  bedrock shift-assignments list [--from <date>] [--to <date>] [--department-code <c>]  割当一覧
  bedrock shift-assignments mine                                  自分の割当一覧
  bedrock shift-assignments show <id>                             割当詳細
  bedrock shift-assignments create --employee-code <c> --date <date> --pattern-code <c> [--note <n>]  割当作成（管理者）
  bedrock shift-assignments update <id> [--pattern-code <c>] [--note <n>]  割当更新（管理者）
  bedrock shift-assignments publish <id>                          割当公開
  bedrock shift-assignments delete <id>                           割当削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
