---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

## 編集禁止

- 型エラー（未使用 import 等）が出ても手で直さず、shadcn の更新を待つか tsconfig 側で exclude
- コンポーネント追加は shadcn CLI（MCP / `vp dlx shadcn@latest add ...`）経由のみ

## Card

CardHeader と CardContent を使わずに Card を直接使う場合、デフォルトの padding と gap で不要な余白ができる。`p-0 gap-0` をつける。

```tsx
// CardHeader + CardContent を使う場合はそのまま
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>

// 直接使う場合は p-0 gap-0
<Card className="p-0 gap-0">
  <div className="p-4">...</div>
</Card>
```
