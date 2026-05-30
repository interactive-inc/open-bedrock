import { factory } from "@/factory"

export const help = `karte career — キャリアシート + キャリアボード(β)

usage:
  karte career sheet                  自分のキャリアシート
  karte career sheet-update --data <file>   キャリアシート更新
  karte career postings               社内公募一覧
  karte career apply <id> [--message <m>]   公募に応募`

export default factory.createHandlers((c) => c.text(help))
