import { factory } from "@/factory"

export const help = `bedrock career — キャリアシート + キャリアボード(β)

usage:
  bedrock career sheet                  自分のキャリアシート
  bedrock career sheet-update --data <file>   キャリアシート更新
  bedrock career postings               社内公募一覧
  bedrock career apply <id> [--message <m>]   公募に応募`

export default factory.createHandlers((c) => c.text(help))
