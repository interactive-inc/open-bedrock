import { factory } from "@/factory"

export const help = `karte expense — 経費精算

usage:
  karte expense submit --category <c> --amount <n> --spent-at <d> [--note <m>]  経費を申請
  karte expense mine [--status <s>]                       自分の経費一覧
  karte expense inbox                                     承認待ち一覧
  karte expense show <id>                                 経費の詳細
  karte expense approve <id> [--comment <c>]              経費を承認
  karte expense reject <id> --comment <c>                 経費を却下`

export default factory.createHandlers((c) => c.text(help))
