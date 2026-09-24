import { Contract } from "@/contexts/partner/domain/entities/contract.entity"
import { Partner } from "@/contexts/partner/domain/entities/partner.entity"
import type { ContractRepository } from "@/contexts/partner/infrastructure/repositories/contract/contract.repository"
import type { PartnerRepository } from "@/contexts/partner/infrastructure/repositories/partner.repository"

type PartnerRepositoryPort = Pick<
  PartnerRepository,
  "findByCode" | "findById" | "create" | "update"
>

type ContractRepositoryPort = Pick<ContractRepository, "findById" | "create" | "update">

/**
 * PartnerRepository の型付きfake。Domain model を採番付きで保持するだけで、SQLやD1を模倣しない。
 * code の一意性とDBの採番は partner.repository.d1.test.ts がローカルD1で検証する。
 */
export function createFakePartnerRepository(): PartnerRepositoryPort {
  const partners = new Map<number, Partner>()

  let nextId = 1

  return {
    findByCode: async (code) =>
      [...partners.values()].find((partner) => partner.code === code) ?? null,
    findById: async (id) => partners.get(id) ?? null,
    create: async (partner) => {
      const created = new Partner({ ...partnerProps(partner), id: nextId })
      nextId += 1
      partners.set(created.id ?? 0, created)
      return created
    },
    update: async (partner) => {
      if (partner.id === null || !partners.has(partner.id)) return null
      partners.set(partner.id, partner)
      return partner
    },
  }
}

/** ContractRepository の型付きfake。 */
export function createFakeContractRepository(): ContractRepositoryPort {
  const contracts = new Map<number, Contract>()

  let nextId = 1

  return {
    findById: async (id) => contracts.get(id) ?? null,
    create: async (contract) => {
      const created = new Contract({ ...contractProps(contract), id: nextId })
      nextId += 1
      contracts.set(created.id ?? 0, created)
      return created
    },
    update: async (contract) => {
      if (contract.id === null || !contracts.has(contract.id)) return null
      contracts.set(contract.id, contract)
      return contract
    },
  }
}

function partnerProps(partner: Partner) {
  return {
    id: partner.id,
    code: partner.code,
    name: partner.name,
    category: partner.category,
    corporateNumber: partner.corporateNumber,
    note: partner.note,
    status: partner.status,
    createdAt: partner.createdAt,
  }
}

function contractProps(contract: Contract) {
  return {
    id: contract.id,
    partnerId: contract.partnerId,
    title: contract.title,
    contractDate: contract.contractDate,
    startsOn: contract.startsOn,
    endsOn: contract.endsOn,
    renewalDeadline: contract.renewalDeadline,
    note: contract.note,
    createdAt: contract.createdAt,
  }
}
