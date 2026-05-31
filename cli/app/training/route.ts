import { factory } from "@/factory"

export const help = `karte training — 研修コース + 受講管理

usage:
  karte training courses [--category <c>] [--status <s>]        コース一覧
  karte training course <code>                                  コース詳細
  karte training course-create --code <c> --title <t> --category <cat> [--description <d>] [--duration <min>] [--required]  コース作成（管理者）
  karte training enrollments [--employee-code <c>]              受講一覧（管理者で他者指定可）
  karte training mine                                           自分の受講一覧
  karte training enroll --course <code> [--employee-code <c>] [--due <date>]  受講申込
  karte training complete <id> [--score <n>]                    受講完了`

export default factory.createHandlers((c) => c.text(help))
