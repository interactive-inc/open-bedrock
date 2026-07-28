import { factory } from "@/factory"

export const help = `bedrock ringi-requests — 稟議

usage:
  bedrock ringi-requests submit --approver-id <id> --title <t> --amount <n> --reason <r>  稟議を申請
  bedrock ringi-requests me [--status <s>]                           自分の稟議一覧
  bedrock ringi-requests inbox                                       承認待ち一覧
  bedrock ringi-requests approve <id> [--comment <c>]                稟議を承認
  bedrock ringi-requests reject <id> --comment <c>                   稟議を却下
  bedrock ringi-requests admin [--status <s>] [--applicant-id <id>] [--sort <s>] [--limit <n>] [--offset <n>]  全件参照`

export default factory.createHandlers((c) => c.text(help))
