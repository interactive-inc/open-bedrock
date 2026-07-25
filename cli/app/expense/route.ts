import { factory } from "@/factory"

export const help = `bedrock expense — 経費精算

usage:
  bedrock expense submit --category <c> --amount <n> --spent-at <d> [--note <m>]  経費を申請
  bedrock expense mine [--status <s>]                       自分の経費一覧
  bedrock expense inbox                                     承認待ち一覧
  bedrock expense show <id>                                 経費の詳細
  bedrock expense approve <id> [--comment <c>]              経費を承認
  bedrock expense reject <id> --comment <c>                 経費を却下`

export default factory.createHandlers((c) => c.text(help))
