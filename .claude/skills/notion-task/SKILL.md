---
name: notion-task
description: Fetch a Notion task into a local backlog file, and write back the GitHub Issue number to the task's `Issue番号` property.
user-invocable: true
disable-model-invocation: true
metadata:
  author: shigurenimo
  description: Notion タスクをローカルバックログ化する。GitHub Issue 番号の Notion 書き戻し (Issue番号 プロパティ) もこのスキルの責務。
  dev: true
---

Notion のタスクリストから指定タスクを取得して、以下を行うスキル。

- ローカルのバックログファイル化 (Notion → ローカル)
- Notion タスクの `Issue番号` プロパティに GitHub Issue 番号を書き戻し (ローカル → Notion、限定書き込み)

書き込みは **`Issue番号` プロパティのみ**。ステータス変更や本文書き換えはしない (Manager 承認フローを跨ぐため)。

## Skills and plugins

Invoke via the Skill tool.

- `docs` — バックログファイルのパス・フォーマットを参照する
- `backlog` — ローカルファイルの作成・更新と壁打ち
- `notion-tasks-system` — Notion のタスク検索・取得・スキーマルール

## Arguments

```
/notion-task TASK-{N}                # Notion → backlog ファイル化
/notion-task TASK-{N} link {issue}   # 既存 backlog に Issue 番号を結び、Notion `Issue番号` プロパティも更新
/notion-task link TASK-{N} {issue}   # backlog 化をスキップして Notion `Issue番号` プロパティだけ更新
```

`{issue}` は GitHub Issue 番号 (例: `1146`) または `#1146`。

## 手順

### Notion からタスクを取得

`notion-tasks-system` スキルの「タスクの取得手順」に従って、指定 TASK 番号のタスクを取得する。

### ローカルファイルの作成・更新 (backlog 化)

`backlog` スキルを呼び出してローカルファイルを作成・更新する。`backlog` スキルの手順に従う。

取得した Notion タスクの情報をバックログファイルに反映する。

- FrontMatter に `reference-id` と `notion-page-id` を書き込む
- タスクのタイトルと内容を反映する
- `---` 分離のゾーン規約に従う (人間ゾーン / Claude ゾーン分離、`docs/references/backlogs.md` 参照)

FrontMatter の例:

```yaml
---
reference-id: TASK-222
notion-page-id: abc-def-123
---
```

### Notion `Issue番号` プロパティに書き戻し (`link` 指定時)

GitHub Issue 番号を Notion 側に保存する。Notion DB には `Issue番号` (number 型) プロパティが必要。

#### `Issue番号` プロパティの存在確認

```
mcp__notion__API-retrieve-a-data-source { data_source_id: "{CUSTOM_NOTION_TABLE_TASK_ID}" }
```

レスポンスの `properties` に `Issue番号` が含まれていなければ、ユーザーに以下を案内する:

```
Notion DB に `Issue番号` (number) プロパティが存在しません。
追加するために mcp__notion__API-update-a-data-source を実行しますか?

リクエスト例:
{
  "data_source_id": "{CUSTOM_NOTION_TABLE_TASK_ID}",
  "properties": {
    "Issue番号": { "number": { "format": "number" } }
  }
}
```

`AskUserQuestion` で yes/no を確認し、yes なら自動追加する。no なら「`Issue番号` プロパティの追加が必要なため処理を中断します」と報告して終了する。

DB スキーマの変更は破壊的になり得るので、自動追加前に必ず確認する。

#### プロパティ更新

```
mcp__notion__API-patch-page {
  page_id: "{Notion ページ ID}",
  properties: {
    "Issue番号": { "number": {Issue 番号} }
  }
}
```

`{Issue 番号}` は GitHub の Issue 番号 (整数)。`#` プレフィックスは外す。

更新後、念のため再取得して値が反映されたことを確認する。

#### 既に値が入っている場合

別の Issue 番号が既に登録されている場合は上書きせず、ユーザーに確認する (`AskUserQuestion` で「現在の値: {既存番号} → {新番号} に上書きしますか?」)。

## やらないこと

- Notion ページの本文の作成・更新
- Notion タスクのステータス変更 (Manager 承認フローを跨ぐため)
- `Issue番号` 以外のプロパティ (担当者、優先度、種類等) の変更
- バックログファイル以外のローカルファイルの操作

## Rules

- Notion 側への書き込みは `Issue番号` プロパティの 1 点のみ
- DB スキーマ変更 (プロパティ追加) は必ずユーザー確認後に実行
- 既存値の上書きは必ずユーザー確認後に実行
- description は日本語
