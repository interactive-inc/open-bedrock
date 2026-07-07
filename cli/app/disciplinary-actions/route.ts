import { factory } from "@/factory"

export const help = `karte disciplinary-actions — 懲戒の記録(非公開)

usage:
  karte disciplinary-actions list [--employee-id <id>]              懲戒の記録一覧(disciplinary_action:read:all)
  karte disciplinary-actions create --employee-id <id> --kind <k> --summary <s> --decided-on <d>

  本人にも見せない設計。create は disciplinary_action:manage が必要。`

export default factory.createHandlers((c) => c.text(help))
