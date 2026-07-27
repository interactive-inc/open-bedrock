import { factory } from "@/factory"

export const help = `bedrock career-applications — 社内公募への応募

usage:
  bedrock career-applications list                                自分の応募一覧
  bedrock career-applications show <id>                           応募の詳細
  bedrock career-applications create <posting_id> [--message <m>]  公募に応募
  bedrock career-applications update <id> [--message <m>]         応募内容の変更
  bedrock career-applications withdraw <id>                       応募の取下げ`

export default factory.createHandlers((c) => c.text(help))
