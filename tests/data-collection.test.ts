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
const trialData = new Map()
const authorizedDataCollectors = new Map()
const dataPointCounters = new Map()

// Mock contract calls
const contractCalls = {
  "authorize-data-collector": (trialId: number, collector: string) => {
    authorizedDataCollectors.set(`${trialId}-${collector}`, { authorized: mockClarity.types.bool(true) })
    return { success: true, value: true }
  },
  "add-data": (trialId: number, patient: string, dataType: string, value: string) => {
    if (!authorizedDataCollectors.get(`${trialId}-${mockClarity.tx.sender}`)?.authorized.value) {
      return { success: false, error: "err-unauthorized" }
    }
    if (dataType !== "numerical" && dataType !== "text") {
      return { success: false, error: "err-invalid-data" }
    }
    const currentCounter = dataPointCounters.get(trialId)?.counter.value || 0
    const newCounter = currentCounter + 1
    dataPointCounters.set(trialId, { counter: mockClarity.types.uint(newCounter) })
    trialData.set(`${trialId}-${patient}-${newCounter}`, {
      "data-type": mockClarity.types.string(dataType),
      value: mockClarity.types.string(value),
      timestamp: mockClarity.types.uint(100), // Mock block height
    })
    return { success: true, value: mockClarity.types.uint(newCounter) }
  },
  "get-patient-data": (trialId: number, patient: string, dataPointId: number) => {
    const data = trialData.get(`${trialId}-${patient}-${dataPointId}`)
    return data ? { success: true, value: data } : { success: false, error: "err-not-found" }
  },
  "is-authorized-collector": (trialId: number, collector: string) => {
    const auth = authorizedDataCollectors.get(`${trialId}-${collector}`)
    return { success: true, value: auth?.authorized || mockClarity.types.bool(false) }
  },
  "get-data-point-count": (trialId: number) => {
    const count = dataPointCounters.get(trialId)?.counter || mockClarity.types.uint(0)
    return { success: true, value: count }
  },
}

describe("Data Collection Contract", () => {
  beforeEach(() => {
    trialData.clear()
    authorizedDataCollectors.clear()
    dataPointCounters.clear()
  })
  
  it("should authorize a data collector", () => {
    const result = contractCalls["authorize-data-collector"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(result.success).toBe(true)
    expect(result.value).toBe(true)
    
    const isAuthorized = contractCalls["is-authorized-collector"](1, "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM")
    expect(isAuthorized.success).toBe(true)
    expect(isAuthorized.value).toEqual(mockClarity.types.bool(true))
  })
  
  it("should add numerical data for a patient", () => {
    contractCalls["authorize-data-collector"](1, mockClarity.tx.sender)
    const result = contractCalls["add-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "numerical", "75.5")
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
    
    const dataPointCount = contractCalls["get-data-point-count"](1)
    expect(dataPointCount.success).toBe(true)
    expect(dataPointCount.value).toEqual(mockClarity.types.uint(1))
  })
  
  it("should add text data for a patient", () => {
    contractCalls["authorize-data-collector"](1, mockClarity.tx.sender)
    const result = contractCalls["add-data"](
        1,
        "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        "text",
        "Patient reported mild discomfort",
    )
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(1))
  })
  
  it("should fail to add data with unauthorized collector", () => {
    const result = contractCalls["add-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "numerical", "75.5")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-unauthorized")
  })
  
  it("should fail to add data with invalid data type", () => {
    contractCalls["authorize-data-collector"](1, mockClarity.tx.sender)
    const result = contractCalls["add-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "invalid", "75.5")
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-invalid-data")
  })
  
  it("should get patient data", () => {
    contractCalls["authorize-data-collector"](1, mockClarity.tx.sender)
    contractCalls["add-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "numerical", "75.5")
    const result = contractCalls["get-patient-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 1)
    expect(result.success).toBe(true)
    expect(result.value["data-type"]).toEqual(mockClarity.types.string("numerical"))
    expect(result.value.value).toEqual(mockClarity.types.string("75.5"))
  })
  
  it("should fail to get non-existent patient data", () => {
    const result = contractCalls["get-patient-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", 999)
    expect(result.success).toBe(false)
    expect(result.error).toBe("err-not-found")
  })
  
  it("should get correct data point count", () => {
    contractCalls["authorize-data-collector"](1, mockClarity.tx.sender)
    contractCalls["add-data"](1, "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "numerical", "75.5")
    contractCalls["add-data"](
        1,
        "ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        "text",
        "Patient reported mild discomfort",
    )
    const result = contractCalls["get-data-point-count"](1)
    expect(result.success).toBe(true)
    expect(result.value).toEqual(mockClarity.types.uint(2))
  })
})

