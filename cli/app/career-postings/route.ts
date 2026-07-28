import { factory } from "@/factory"

export const help = `bedrock career-postings — 社内公募

usage:
  bedrock career-postings list                                    社内公募一覧
  bedrock career-postings show <id>                               公募の詳細
  bedrock career-postings create --title <t> --department-code <c> [--description <d>]  公募作成（管理者）
  bedrock career-postings update <id> [--title <t>] [--description <d>]  公募更新（管理者）
  bedrock career-postings delete <id>                             公募削除（管理者）`

export default factory.createHandlers((c) => c.text(help))
