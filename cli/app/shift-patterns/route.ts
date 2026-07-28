import { factory } from "@/factory"

export const help = `bedrock shift-patterns — シフトパターン

usage:
  bedrock shift-patterns list                                     パターン一覧
  bedrock shift-patterns show <id>                                パターン詳細
  bedrock shift-patterns create --code <c> --name <n> --start <time> --end <time> [--break <min>]  パターン作成（管理者）
  bedrock shift-patterns update <id> [--name <n>] [--start <time>] [--end <time>]  パターン更新（管理者）
  bedrock shift-patterns delete <id>                              パターン削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
