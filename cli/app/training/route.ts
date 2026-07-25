import { factory } from "@/factory"

export const help = `bedrock training — 研修コース + 受講管理

usage:
  bedrock training courses [--category <c>] [--status <s>]        コース一覧
  bedrock training course <code>                                  コース詳細
  bedrock training course-create --code <c> --title <t> --category <cat> [--description <d>] [--duration <min>] [--required]  コース作成（管理者）
  bedrock training enrollments [--employee-code <c>]              受講一覧（管理者で他者指定可）
  bedrock training mine                                           自分の受講一覧
  bedrock training enroll --course <code> [--employee-code <c>] [--due <date>]  受講申込
  bedrock training complete <id> [--score <n>]                    受講完了`

export default factory.createHandlers((c) => c.text(help))
