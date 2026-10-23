import { describe, expect, it } from "vitest";
import {
  getOrCreateDeviceId,
  loadStudent,
  saveStudent,
  type KeyValueStorage,
} from "./student-storage";

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("getOrCreateDeviceId", () => {
  it("creates an id once and reuses it", () => {
    const storage = memoryStorage();
    let calls = 0;
    const create = () => `id-${(calls += 1)}`;

    expect(getOrCreateDeviceId(storage, create)).toBe("id-1");
    expect(getOrCreateDeviceId(storage, create)).toBe("id-1");
    expect(calls).toBe(1);
  });

  it("still returns an id when storage throws", () => {
    expect(getOrCreateDeviceId(throwingStorage, () => "fresh")).toBe("fresh");
  });
});

describe("loadStudent / saveStudent", () => {
  it("round-trips the student's code and name", () => {
    const storage = memoryStorage();
    saveStudent({ studentCode: "SV12345", studentName: "Đào Anh Ngọc" }, storage);

    expect(loadStudent(storage)).toEqual({ studentCode: "SV12345", studentName: "Đào Anh Ngọc" });
  });

  it("ignores corrupted or unexpected data", () => {
    const storage = memoryStorage();
    storage.setItem("peerscore:student", "{not json");
    expect(loadStudent(storage)).toBeNull();

    storage.setItem("peerscore:student", JSON.stringify({ studentCode: 1 }));
    expect(loadStudent(storage)).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    expect(loadStudent(throwingStorage)).toBeNull();
    expect(() => saveStudent({ studentCode: "A", studentName: "B" }, throwingStorage)).not.toThrow();
  });
});
