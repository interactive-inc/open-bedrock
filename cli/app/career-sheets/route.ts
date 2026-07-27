import { factory } from "@/factory"

export const help = `bedrock career-sheets — キャリアシート

usage:
  bedrock career-sheets show                                      自分のキャリアシート
  bedrock career-sheets update --data <file>                      キャリアシート更新
  bedrock career-sheets delete                                    キャリアシート削除`

export default factory.createHandlers((c) => c.text(help))
