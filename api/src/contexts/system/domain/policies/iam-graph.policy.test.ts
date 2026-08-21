import { IamGraphPolicy } from "@system/domain/policies/iam-graph.policy"
import { IamRoleEntity } from "@system/domain/entities/iam-role.entity"
import { InvalidIamGraphError } from "@system/domain/errors"
import { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"
import { describe, expect, test } from "bun:test"

const NOW = new Date("2026-08-11T00:00:00.000Z")

function requireRole(id: string, permissionKeys: ReadonlyArray<string>): IamRoleEntity {
  const role = IamRoleEntity.create({
    id,
    key: `system:${id}`,
    kind: "managed",
    name: id,
    permissionKeys,
    createdAt: NOW,
    updatedAt: NOW,
  })
  if (role instanceof Error) throw role
  return role
}

function requireBinding(
  id: string,
  accountId: string,
  roleId: string,
  resource: Readonly<{ type: string; id: string }> | null = null,
): RoleBindingEntity {
  const binding = RoleBindingEntity.create({
    id,
    accountId,
    roleId,
    resource,
    createdAt: NOW,
    revokedAt: null,
  })
  if (binding instanceof Error) throw binding
  return binding
}

function requireGraph(
  roles: ReadonlyArray<IamRoleEntity>,
  bindings: ReadonlyArray<RoleBindingEntity>,
): IamGraphPolicy {
  const graph = IamGraphPolicy.create(roles, bindings)
  expect(graph).toBeInstanceOf(IamGraphPolicy)
  if (graph instanceof Error) throw graph
  return graph
}

describe("IamGraphPolicy permission evaluation", () => {
  test("global bindingと完全一致resource bindingをliveに評価する", () => {
    const reader = requireRole("reader", ["care:read"])
    const global = requireBinding("global", "account-1", reader.id)
    const scoped = requireBinding("scoped", "account-2", reader.id, {
      type: "company:facility",
      id: "facility-1",
    })
    const graph = requireGraph([reader], [global, scoped])

    expect(
      graph.getPermissionDecision({
        accountId: "account-1",
        permissionKey: "care:read",
        resource: { type: "company:facility", id: "facility-2" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "account-2",
        permissionKey: "care:read",
        resource: { type: "company:facility", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "account-2",
        permissionKey: "care:read",
        resource: { type: "company:facility", id: "facility-2" },
        at: NOW,
      }),
    ).toBe("denied")
  })

  test("global system:adminだけが全permissionを短絡する", () => {
    const root = requireRole("root", ["system:admin"])
    const global = requireBinding("root-binding", "account-1", root.id)
    const scoped = requireBinding("scoped-root", "account-2", root.id, {
      type: "company:facility",
      id: "facility-1",
    })
    const graph = requireGraph([root], [global, scoped])

    expect(
      graph.getPermissionDecision({
        accountId: "account-1",
        permissionKey: "future:operate",
        resource: { type: "future:resource", id: "resource-1" },
        at: NOW,
      }),
    ).toBe("allowed")
    expect(
      graph.getPermissionDecision({
        accountId: "account-2",
        permissionKey: "future:operate",
        resource: { type: "company:facility", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("denied")
    expect(
      graph.getPermissionDecision({
        accountId: "account-2",
        permissionKey: "system:admin",
        resource: { type: "company:facility", id: "facility-1" },
        at: NOW,
      }),
    ).toBe("denied")
  })

  test("未知入力と不正clockをinvalidとしてdenyする", () => {
    const graph = requireGraph([], [])

    for (const props of [
      { accountId: "", permissionKey: "iam:read", resource: null, at: NOW },
      { accountId: "account-1", permissionKey: "invalid", resource: null, at: NOW },
      { accountId: "account-1", permissionKey: "iam:read", resource: {}, at: NOW },
      {
        accountId: "account-1",
        permissionKey: "iam:read",
        resource: null,
        at: new Date(Number.NaN),
      },
      { accountId: "account-1", permissionKey: "iam:read", resource: null, at: "now" },
    ]) {
      expect(graph.getPermissionDecision(props)).toBe("invalid")
    }
  })
})

describe("IamGraphPolicy integrity and last-root", () => {
  test.each(["duplicate_role_id", "duplicate_binding_id", "unknown_binding_role"] as const)(
    "破損graphをfail closedで拒否する: %s",
    (reason) => {
      const role = requireRole("root", ["system:admin"])
      const binding = requireBinding("binding-1", "account-1", role.id)
      const roles = reason === "duplicate_role_id" ? [role, role] : [role]
      const bindings =
        reason === "duplicate_binding_id"
          ? [binding, binding]
          : reason === "unknown_binding_role"
            ? [requireBinding("unknown", "account-1", "missing-role")]
            : [binding]
      const graph = IamGraphPolicy.create(roles, bindings)

      expect(graph).toBeInstanceOf(InvalidIamGraphError)
      expect(graph instanceof InvalidIamGraphError ? graph.reason : null).toBe(reason)
    },
  )

  test("最後のactive global root bindingだけを削除拒否する", () => {
    const root = requireRole("root", ["system:admin"])
    const reader = requireRole("reader", ["iam:read"])
    const rootBinding = requireBinding("root-1", "account-1", root.id)
    const readerBinding = requireBinding("reader-1", "account-1", reader.id)
    const graph = requireGraph([reader, root], [readerBinding, rootBinding])
    const activeAccountIds = new Set(["account-1"])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: rootBinding.id,
        activeAccountIds,
        at: NOW,
      }),
    ).toBe("last_root_binding")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: readerBinding.id,
        activeAccountIds,
        at: NOW,
      }),
    ).toBeNull()
  })

  test("別のactive global rootが残れば削除でき、resource rootとinactive Accountは数えない", () => {
    const root = requireRole("root", ["system:admin"])
    const first = requireBinding("root-1", "account-1", root.id)
    const second = requireBinding("root-2", "account-2", root.id)
    const scoped = requireBinding("root-scoped", "account-3", root.id, {
      type: "company:facility",
      id: "facility-1",
    })
    const graph = requireGraph([root], [first, second, scoped])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: first.id,
        activeAccountIds: new Set(["account-1", "account-2"]),
        at: NOW,
      }),
    ).toBeNull()
    expect(
      graph.getBindingRevocationRejection({
        bindingId: first.id,
        activeAccountIds: new Set(["account-1"]),
        at: NOW,
      }),
    ).toBe("last_root_binding")
  })

  test("不正Account集合・binding ID・clockをinvalidとして拒否する", () => {
    const graph = requireGraph([], [])

    expect(
      graph.getBindingRevocationRejection({
        bindingId: "",
        activeAccountIds: new Set(),
        at: NOW,
      }),
    ).toBe("invalid_evaluation_input")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: "binding-1",
        activeAccountIds: new Set([""]),
        at: NOW,
      }),
    ).toBe("invalid_evaluation_input")
    expect(
      graph.getBindingRevocationRejection({
        bindingId: "binding-1",
        activeAccountIds: new Set(),
        at: new Date(Number.NaN),
      }),
    ).toBe("invalid_evaluation_input")
  })
})
