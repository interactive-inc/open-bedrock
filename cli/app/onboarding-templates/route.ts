import { factory } from "@/factory"

export const help = `bedrock onboarding-templates — 入退社手続きのテンプレート

usage:
  bedrock onboarding-templates list [--kind join|leave]           テンプレ一覧
  bedrock onboarding-templates show <code>                        テンプレ詳細
  bedrock onboarding-templates create --code <c> --name <n> --kind <join|leave>  テンプレ作成
  bedrock onboarding-templates update <code> [--name <n>]         テンプレ更新
  bedrock onboarding-templates bind-lifecycle <code> --effect <hire|retired>
  bedrock onboarding-templates unbind-lifecycle <code>
  bedrock onboarding-templates delete <code>                      テンプレ削除`

export default factory.createHandlers((c) => c.text(help))
