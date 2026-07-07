import { factory } from "@/factory"

export const help = `karte ringi — 稟議

usage:
  karte ringi submit --approver-id <id> --title <t> --amount <n> --reason <r>  稟議を申請
  karte ringi me [--status <s>]                           自分の稟議一覧
  karte ringi inbox                                       承認待ち一覧
  karte ringi approve <id> [--comment <c>]                稟議を承認
  karte ringi reject <id> --comment <c>                   稟議を却下
  karte ringi admin [--status <s>] [--applicant-id <id>] [--sort <s>] [--limit <n>] [--offset <n>]  全件参照`

export default factory.createHandlers((c) => c.text(help))
