import type { ErrorMessage } from "./message.type";

export function serverError(code: string, message: string): ErrorMessage {
  return { type: "error", code, message };
}
