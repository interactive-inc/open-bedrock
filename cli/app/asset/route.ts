import { factory } from "@/factory"

export const help = `karte asset — 物品・備品/資産管理

usage:
  karte asset list [--kind <k>] [--status <s>]              資産一覧
  karte asset mine                                          自分の貸与品
  karte asset show <code>                                   資産詳細
  karte asset register --code <c> --name <n> --kind <k> [--serial <s>] [--purchased-on <d>]
  karte asset lend <code> --employee-code <e>               貸出
  karte asset return <code>                                 返却`

export default factory.createHandlers((c) => c.text(help))
