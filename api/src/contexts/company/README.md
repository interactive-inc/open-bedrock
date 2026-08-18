# Company Context

Company is the portable company layer. It owns legal identity, people, employment,
organization, definitions, account-to-employee links, and personnel actions. It does not own
product-specific workflows or the System account implementation.

## Dependency direction

```text
interface -> application -> domain
     |             |
     +-> infrastructure
```

- Domain is pure company policy.
- Application exposes named use cases and depends on function-shaped persistence ports.
- Infrastructure implements those ports with D1 and may know the database SDK.
- Interface owns Hono, Zod request schemas, HTTP status codes, and problem responses.
- The API root composes routes; the context never imports a product API root.

## Explicit operations

Every URL has one concrete route file. When the same URL supports both read and write,
that file exports both `GET` and `POST` so the complete HTTP contract is readable in one place.
Zod schemas are written directly in each validator. A schema change therefore cannot silently
change unrelated endpoints through a shared schema graph.

Application functions exist only when they enforce policy or invariants. A function that only
renames another function or forwards its arguments is forbidden. Shared code is limited to
security and consistency mechanisms that must have one implementation: organization access,
capability checks, revision conflicts, idempotency, canonical serialization, and the atomic
audit/write transaction.

## HTTP contract

Zod schemas in each route are the request contract. Hono validators expose those inferred inputs to
`hono/client` so tests and consumers use typed path, method, header, query, and JSON values.
Application and domain code do not depend on Hono or Zod.

## Safety

- Organization access and capability checks fail closed before persistence.
- Writes require an idempotency key and expected organization revision.
- Resource revisions and organization revisions are enforced again by D1.
- Organization changes validate hierarchy periods, unit references, primary assignment overlap,
  management cycles, and authority scope before writing.
- Reads at an effective date use immutable revisions rather than mutating history.
