import { describe, it, expect, beforeEach } from "vitest"

// Mock the Clarity functions and types
const mockClarity = {
  tx: {
    sender: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  },
  types: {
    uint: (value: number) => ({ type: "uint", value }),
    principal: (value: string) => ({ type: "principal", value }),
    string: (value: string) => ({ type: "string", value }),
    bool: (value: boolean) => ({ type: "bool", value }),
  },
}

// Mock contract state
let lastDrugId = 0
const drugs = new Map()
const drugDistributions = new Map()
const patientAdherence = new Map()
const authorizedDistributors = new Map()

// Mock contract calls
const contractCalls = {
  "add-drug": (name: string, description: string, totalSupply: number) => {
    const drugId = ++lastDrugId
    drugs.set(drugId, {
      name: mockClarity.types.string(name),
      description: mockClarity.types.string(description),
      "total-supply": mockClarity.types.uint(totalSupply),
      "remaining-supply": mockClarity.types.uint(totalSupply),
    })
    return { success: true, value: mockClarity.types.uint(drugId) }
  },
  "authorize-distributor": (trialId: number, distributor: string) => {
    authorizedDistributors.set(`${trialId}-${distributor}`, { authorized: mockClarity.types.bool(true) })
    return { success: true, value: true }
  },
  "distribute-drug": (trialId: number, drugId: number, patient: string, amount: number) => {
    if (!authorizedDistributors.get(`${trialId}-${mockClarity.tx.sender}`)?.authorized.value) {
      return { success: false, error: "err-unauthorized" }
    }
    const drug = drugs.get(drugId)
    if (!drug) {
      return { success: false, error: "err-not-found" }
    }
    if (drug["remaining-supply"].value < amount) {
      return { success: false, error: "err-insufficient-supply" }
    }
    drug["remaining-supply"] = mockClarity.types.uint(drug["remaining-supply"].value - amount)
    const distributionId = ++lastDrugId
    drugDistributions.set(distributionId, {
      "drug-id": mockClarity.types.uint(drugId),
      patient: mockClarity.types.principal(patient),
      amount: mockClarity.types.uint(amount),
      timestamp: mockClarity.types.uint(100), // Mock block height
      distributor: mockClarity.types.principal(mockClarity.tx.sender),
    })
    return { success: true, value: mockClarity.types.uint(distributionId) }
  },
  "record-adherence": (drugId: number, patient: string) => {
    const key = `${patient}-${drugId}`
    const adherence = patientAdherence.get(key) || {
      "doses-taken": mockClarity.types.uint(0),
      "last-dose-timestamp": mockClarity.types.uint(0),
    }
    adherence["doses-taken"] = mockClarity.types.uint(adherence["doses-taken"].value + 1)
    adherence["last-dose-timestamp"] = mockClarity.types.uint(100) // Mock block height
    patientAdherence.set(key, adherence)
    return { success: true, value: true }
  },
  "get-drug": (drugId: number) => {
    const drug = drugs.get(drugId)
    return drug ? { success: true, value: drug } : { success: false, error: "err-not-found" }
  },
  "get-distribution": (distributionId: number) => {
    const distribution = drugDistributions.get(distributionId)
    return distribution ? { success: true, value: distribution } : { success: false, error: "err-not-found" }
  },
  "get-patient-adherence": (patient: string, drugId: number) => {
    const adherence = patientAdherence.get(`${patient}-${drugId}`)
    return adherence ? { success: true, value: adherence } : { success: false, error: "err-not-found" }
  },
}

describe("Drug Supply Contract", () => {
  beforeEach(() => {
    lastDrugId = 0
    drugs.clear()
    drugDistributions.clear()
    patientAdherence.clear()
    authorizedDistributors.clear()
  })
  
  it("should add a new drug", () => {
    const result = contractCalls["add-drug"]("Test Drug", "A test drug description", 1000)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
    
    const drug = drugs.get(1)
    expect(drug).toBeDefined()
    expect(drug?.name).toEqual(mockClarity.types.string("Test Drug"))
    expect(drug?.["total-supply"]).toEqual(mockClarity.types.uint(1000))
  })
  
  it("should authorize a distributor", () => {
    const result = contractCalls["authorize-distributor"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
  })
  
  it("should distribute drug to a patient", () => {
    contractCalls["add-drug"]("Test Drug", "A test drug description", 1000)
    contractCalls["authorize-distributor"](1, mockClarity.tx.sender)
    const result = contractCalls["distribute-drug"](1, 1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 100)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(2))
    
    const drug = drugs.get(1)
    expect(drug?.["remaining-supply"]).toEqual(mockClarity.types.uint(900))
    
    const distribution = drugDistributions.get(2)
    expect(distribution).toBeDefined()
    expect(distribution?.amount).toEqual(mockClarity.types.uint(100))
  })
  
  it("should fail to distribute drug without authorization", () => {
    contractCalls["add-drug"]("Test Drug", "A test drug description", 1000)
    const result = contractCalls["distribute-drug"](1, 1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 100)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should record patient adherence", () => {
    const result = contractCalls["record-adherence"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const adherence = patientAdherence.get("ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM-1")
    expect(adherence).toBeDefined()
    expect(adherence?.["doses-taken"]).toEqual(mockClarity.types.uint(1))
  })
  
  it("should get drug details", () => {
    contractCalls["add-drug"]("Test Drug", "A test drug description", 1000)
    const result = contractCalls["get-drug"](1)
    expect(result.success).toBe(true)
    expect(result.value.name).toEqual(mockClarity.types.string("Test Drug"))
    expect(result.value["total-supply"]).toEqual(mockClarity.types.uint(1000))
  })
  
  it("should get distribution details", () => {
    contractCalls["add-drug"]("Test Drug", "A test drug description", 1000)
    contractCalls["authorize-distributor"](1, mockClarity.tx.sender)
    contractCalls["distribute-drug"](1, 1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 100)
    const result = contractCalls["get-distribution"](2)
    expect(result.success).toBe(true)
    expect(result.value["drug-id"]).toEqual(mockClarity.types.uint(1))
    expect(result.value.amount).toEqual(mockClarity.types.uint(100))
  })
  
  it("should get patient adherence", () => {
    contractCalls["record-adherence"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    const result = contractCalls["get-patient-adherence"]("ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1)
    expect(result.success).toBe(true)
    expect(result.value["doses-taken"]).toEqual(mockClarity.types.uint(1))
  })
  
  it("should fail to get non-existent drug", () => {
    const result = contractCalls["get-drug"](999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
})

