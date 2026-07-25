import { factory } from "@/factory"

export const help = `bedrock asset — 物品・備品/資産管理

usage:
  bedrock asset list [--kind <k>] [--status <s>]              資産一覧
  bedrock asset mine                                          自分の貸与品
  bedrock asset show <code>                                   資産詳細
  bedrock asset register --code <c> --name <n> --kind <k> [--serial <s>] [--purchased-on <d>]
  bedrock asset lend <code> --employee-code <e>               貸出
  bedrock asset return <code>                                 返却
  bedrock asset dispose <code> --reason <r> [--disposed-on <d>]  廃棄
  bedrock asset holdings                                      保有状況一覧`

export default factory.createHandlers((c) => c.text(help))
