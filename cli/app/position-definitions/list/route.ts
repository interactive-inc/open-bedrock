import { createCompanyDefinitionListHandlers } from "@/lib/company-definitions/create-company-definition-list-handlers"

export const help = `bedrock position-definitions list --organization-id <id> [--as-of <YYYY-MM-DD>]

公開履歴から会社版・資源ID・資源版・有効期間を返します。
as-ofを省略すると将来予約を含む最新の資源版、指定するとその日に有効な定義を返します。`

export default createCompanyDefinitionListHandlers({ type: "position", help })
