---
name: backlog-planning
description: "?"
user-invocable: true
disable-model-invocation: false
metadata:
  author: shigurenimo
  description: backlog スキルから呼び出され、議論内容を受け取って `.docs/` フォーマットのバックログ下書きを返す内部ヘルパースキル。
  dev: true
---

Receive discussion results and return drafted backlog content in the docs format.

Does not read or write files. Does not operate GitHub/Notion.

## Workflow

- Receive the discussion results from the backlog skill
- Read the docs skill to understand `.docs/` format
- Draft backlog content following the format
- Return the drafted content

## Plugins

Invoke via the Skill tool.

- docs: `.docs/` format and rules.
- superpowers: Spawn parallel agents, create plans, review code.
