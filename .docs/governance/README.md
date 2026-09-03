# Governance Markdown

Governance Markdown は文書型、metadata、状態、参照、公開制約を持つ。parser と保存処理は governance schema、route、migration に一致させる。自社の施行済み規程は非公開 deployment source で管理する。

公開リポジトリに同梱する文書は構造例であり、`effective_from: null` の未施行テンプレートとする。open-bedrock 開発元または利用者の自社に固有の内部規程、組織構造、決裁額、担当者を含めない。実在組織の規程は非公開 deployment source で管理する。

自社は、法域、定款、契約、組織構造、リスク、専門家の助言に合わせて内容を作成し、非公開の deployment source で管理する。公開 repository へ法人固有名、個人情報、秘密、実際の決裁金額を commit しない。

## 状態の区別

- draft: 編集中であり、閲覧用でも実行用でもない
- synced: 検索用投影へ同期済みだが、承認済みではない
- in_review: 公開候補版を固定して review 中
- published: 内容 hash と decision が固定された版
- effective: 施行期間と対象が一致し、自社の規範として有効
- superseded または expired: 過去版として保持するが新しい判断へ使わない
- enforced: 対応する実装 mapping と適合 test があり、技術的に強制される rule

同期、公開、施行、技術的強制は同義ではない。現行 schema はこの全状態を表現していないため、`effective_from: null` の同梱文書を実行 rule として利用しない。

## Markdown の契約

本文は CommonMark、構造化 metadata は YAML front matter で管理する。安定 ID を表示名から分け、公開済み版は上書きせず version を上げる。

- `Policy`: 許可、禁止、義務、責任を定める
- `ProcedureDefinition`: 手順の版付き定義
- `Guideline`: 推奨方法。違反だけで禁止を生まない
- `ControlDefinition`: リスクを下げる統制の定義
- `ProcedureCase`: 手続きの実行案件。Markdown 自体ではない
- `ControlRun`: 統制を実施した記録。front matter の `controls` 自体ではない

現行の `procedure` と `controls` は構造化された定義と表示 metadata であり、自動実行 engine ではない。既存の case、task、decision 基盤へ明示的に写像するまで、step 完了や control 実施を自動推定しない。

## 参照記法

- `[[capability:information-security]]`
- `[[org-role:ciso]]`
- `[[policy:policy.information-security]]`
- `[[procedure:procedure.access-lifecycle]]`
- `[[control:control.annual-security-training]]`
- `[[permission:governance:publish]]`
- `[[training:TR-SEC-01]]`

参照は link であり、権限を与えない。特に `org-role` は現行実装上の参照型であり、一人役職、責任 role、合議体を完全には区別しない。合議体の決議を一件の role approval で代用しない。

## AuthorityRule の制限

現行 front matter の `authority_rules` は、構文検査、参照、重複候補の表示に使う宣言 metadata である。全業務 API の Policy Decision Point へ接続されていないため、記載しただけで決裁権限を強制したとみなさない。

実行可能な authority rule には、[権限と意思決定モデル](../authority-model.md) が定める主体種類、合議体、定足数、職務分離、金額文脈、委任、法域、優先順位、既定拒否、実装 mapping、適合 test が必要になる。

## 公開手順

1. 自社の責任者と外部専門家が内容、法域、対象、保持、例外を確認する。
2. schema、参照、固定人名、組織 assignment、rule overlap を検証する。
3. review 開始時に candidate、authority assignment、quorum、policy version を固定する。
4. HumanPrincipal または合議体が不変版の content hash へ decision を記録する。
5. publish 権限者が承認済み hash だけを publish する。
6. effective date 到来後、対象者へ公開し、必要な acknowledgement を収集する。
7. 技術的に強制する rule は、実装 mapping と conformance test を別に有効化する。

現在の governance 実装は candidate snapshot、合議体 quorum、公開と施行の完全分離をまだ満たさない。このため同梱テンプレートを実運用へ publish する前に、実装差分を解消する。同梱する security と privacy の Policy、Procedure はすべて `publication.mode: approval` とし、現行実装が許す direct publication は使用しない。

## CLI

CLI は同期、impact 検査、review、publish、acknowledgement、org role assignment の入口を持つ。利用可能な command と引数は `cli/app/governance` と `bedrock governance --help` を正とする。

AI に CLI を許可する場合も、人間 account を共有しない。AgentPrincipal として proposal を作り、人間 review が必要な operation は [AI 自動化と人間承認](../automation-model.md) の immutable digest に結ぶ。
