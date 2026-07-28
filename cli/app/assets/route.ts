import { factory } from "@/factory"

export const help = `bedrock assets — 物品・備品/資産管理

usage:
  bedrock assets list [--kind <k>] [--status <s>]              資産一覧
  bedrock assets lent me                                          自分の貸与品
  bedrock assets show <code>                                   資産詳細
  bedrock assets register --code <c> --name <n> --kind <k> [--serial <s>] [--purchased-on <d>]
  bedrock assets lend <code> --employee-code <e>               貸出
  bedrock assets return <code>                                 返却
  bedrock assets dispose <code> --reason <r> [--disposed-on <d>]  廃棄
  bedrock assets holdings                                      保有状況一覧`

export default factory.createHandlers((c) => c.text(help))
