import { factory } from "@/factory"

export const help = `bedrock employee-work-styles — 勤務形態の属性

usage:
  bedrock employee-work-styles list [--employee-id <id>]           勤務形態一覧（本人 or work_style:read:all）
  bedrock employee-work-styles add --employee-id <id> --style <regular|flextime|discretionary|shift> --starts-on <YYYY-MM-DD> [--ends-on <d>] [--note <n>]   (work_style:manage)`

export default factory.createHandlers((c) => c.text(help))
