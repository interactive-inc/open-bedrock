---
id: procedure.access-lifecycle
title: Access lifecycle 手続きテンプレート
kind: procedure
version: 1.1.0-draft
classification: internal
owner_capability: information-security
steward_org_role: ciso
effective_from: null
effective_to: null
review_due_on: null
audience:
  all_employees: true
publication:
  mode: approval
  approver_org_roles: [ciso]
acknowledgement:
  required: false
tags: [human, asset, security, lifecycle]
references:
  - kind: policy
    code: policy.information-security
procedure:
  execution: sequence
  steps:
    - key: confirm-event
      name: 発効する人事 event と対象 Principal を確認する
      kind: instruction
      assignee:
        type: direct_manager
      due_days: 0
    - key: inventory-access
      name: Account、permission、assignment、connector access を棚卸しする
      kind: checklist
      assignee:
        type: department_manager
      due_days: 0
    - key: change-access
      name: 発効時点に不要な access を失効させる
      kind: evidence
      assignee:
        type: org_role
        code: ciso
      due_days: 0
      evidence_required: true
    - key: collect-assets
      name: 貸与物の custody と回収結果を更新する
      kind: evidence
      assignee:
        type: department_manager
      due_days: 1
      evidence_required: true
    - key: reconcile
      name: 外部 system と内部 record の差を照合する
      kind: evidence
      assignee:
        type: org_role
        code: ciso
      due_days: 1
      evidence_required: true
    - key: confirm-completion
      name: 完了条件と未解決例外を確認する
      kind: acknowledgement
      assignee:
        type: direct_manager
      due_days: 1
authority_rules: []
controls: []
---

# Access lifecycle 手続きテンプレート

入社、異動、休職、退職、role change、委託終了などを起点に、Account、TechnicalPermission、OrganizationalAuthority assignment、TaskProxy、Agent mandate、Connector access、貸与物を変更する。自社が承認、施行するまでは手続きまたは実行根拠として使用しない。

## 実行上の注意

front matter の `procedure` は ProcedureDefinition であり、実行済みの ProcedureCase ではない。現行 `due_days` は基準時刻を表せないため、発効日時が重要な access 失効を単なる case 開始後の日数だけで制御しない。

実装時は各 task に次を固定する。

- trigger event と effective_at
- 対象 Person、Principal、Account、resource
- assignee snapshot と assignment 根拠
- 実行前後の permission、scope、field
- external connector と reconciliation
- evidence、executed_by、completed_at
- 失敗、例外、再試行、manual owner

## 完了条件

- 人事 event の valid time と access change の effective time が一致する。
- Human、Agent、Service、Connector の不要な access が失効している。
- 過去の decision と audit の主体参照は保持されている。
- 貸与物の custody、回収、例外が記録されている。
- 外部 system との差が照合済みか、例外 case と owner が存在する。
- assignment を物理削除せず、取消または終了時点を保持している。
