import { factory } from "@/factory"

export const help = `bedrock regulations — 規程集

usage:
  bedrock regulations list [--status active|archived]                             規程一覧
  bedrock regulations show <code>                                                 規程詳細（最新版＋版一覧）
  bedrock regulations register --code <c> --title <t> --body <md> --effective-on <d> [--category <c>] [--note <n>]
  bedrock regulations add-version <code> --body <md> --effective-on <d> [--note <n>]   新版を追加
  bedrock regulations archive <code>                                              規程をアーカイブ`

export default factory.createHandlers((c) => c.text(help))
