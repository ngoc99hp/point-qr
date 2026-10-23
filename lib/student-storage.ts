// Client-only helpers. localStorage may be unavailable (private mode, blocked
// storage), so every access is guarded and the form still works without it.

const DEVICE_ID_KEY = "peerscore:deviceId";
const STUDENT_KEY = "peerscore:student";

export interface StoredStudent {
  studentCode: string;
  studentName: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Stable per-browser UUID (SPEC §6.1); a fresh one per page load if storage fails. */
export function getOrCreateDeviceId(
  storage: KeyValueStorage | null = browserStorage(),
  createId: () => string = () => crypto.randomUUID(),
): string {
  try {
    const existing = storage?.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = createId();
    storage?.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return createId();
  }
}

/** Raw stored string — a stable snapshot for useSyncExternalStore. */
export function readStudentRaw(storage: KeyValueStorage | null = browserStorage()): string | null {
  try {
    return storage?.getItem(STUDENT_KEY) ?? null;
  } catch {
    return null;
  }
}

export function loadStudent(storage: KeyValueStorage | null = browserStorage()): StoredStudent | null {
  return parseStudent(readStudentRaw(storage));
}

export function parseStudent(raw: string | null): StoredStudent | null {
  try {
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "studentCode" in value &&
      "studentName" in value &&
      typeof value.studentCode === "string" &&
      typeof value.studentName === "string"
    ) {
      return { studentCode: value.studentCode, studentName: value.studentName };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStudent(
  student: StoredStudent,
  storage: KeyValueStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(STUDENT_KEY, JSON.stringify(student));
  } catch {
    // Autofill is a convenience only.
  }
}
