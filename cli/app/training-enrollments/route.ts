import { factory } from "@/factory"

export const help = `bedrock training-enrollments — 研修の受講管理

usage:
  bedrock training-enrollments list [--employee-code <c>]         受講一覧（管理者で他者指定可）
  bedrock training-enrollments mine                               自分の受講一覧
  bedrock training-enrollments show <id>                          受講の詳細
  bedrock training-enrollments create --course <code> [--employee-code <c>] [--due <date>]  受講申込
  bedrock training-enrollments complete <id> [--score <n>]        受講完了
  bedrock training-enrollments reschedule <id> --due <date>       受講期限の変更
  bedrock training-enrollments cancel <id>                        受講取消`

export default factory.createHandlers((c) => c.text(help))
