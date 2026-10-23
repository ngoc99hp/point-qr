/** Uniform Server Action result (SPEC §0.3, §7). */
export interface ActionError<Code extends string = string> {
  code: Code;
  message: string;
  field?: string;
}

export type ActionResult<Data = undefined, Code extends string = string> =
  | { success: true; data: Data }
  | { success: false; error: ActionError<Code> };

export function ok<Data>(data: Data): { success: true; data: Data } {
  return { success: true, data };
}

export function fail<Code extends string>(
  code: Code,
  message: string,
  field?: string,
): { success: false; error: ActionError<Code> } {
  return { success: false, error: field ? { code, message, field } : { code, message } };
}

/** Reads a string field from FormData ("" when missing or a File). */
export function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
