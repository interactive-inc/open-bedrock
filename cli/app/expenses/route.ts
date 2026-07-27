import { factory } from "@/factory"

export const help = `bedrock expenses — 経費精算

usage:
  bedrock expenses submit --category <c> --amount <n> --spent-at <d> [--note <m>]  経費を申請
  bedrock expenses mine [--status <s>]                       自分の経費一覧
  bedrock expenses inbox                                     承認待ち一覧
  bedrock expenses show <id>                                 経費の詳細
  bedrock expenses approve <id> [--comment <c>]              経費を承認
  bedrock expenses reject <id> --comment <c>                 経費を却下`

export default factory.createHandlers((c) => c.text(help))
