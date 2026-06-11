import { getOrgTree } from "@/lib/api/get-org-tree"
import { OrgTreeNodeItem } from "@/app/(app)/org/_components/org-tree-node-item"
import { Card } from "@/components/ui/card"

// /org/tree を認証付きで取得し、ルート部署から再帰的にツリー描画する非同期 RSC。
export async function OrgTreeView() {
  const nodes = await getOrgTree()

  if (nodes instanceof Error) {
    return <p className="text-sm text-destructive">組織ツリーの取得に失敗しました</p>
  }

  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">部署がありません</p>
  }

  return (
    <Card className="p-0 gap-0">
      <ul className="flex flex-col gap-1 p-4">
        {nodes.map((node) => (
          <OrgTreeNodeItem key={node.code} node={node} depth={0} />
        ))}
      </ul>
    </Card>
  )
}
