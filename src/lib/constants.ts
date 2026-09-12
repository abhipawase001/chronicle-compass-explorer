import { format, parseISO } from "date-fns";

export const LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Tamil",
  "Spanish",
  "French",
  "German",
] as const;

export const DATE_FORMATS = [
  { value: "dd MMM yyyy", label: "12 Mar 2026" },
  { value: "MMM d, yyyy", label: "Mar 12, 2026" },
  { value: "dd/MM/yyyy", label: "12/03/2026" },
  { value: "MM/dd/yyyy", label: "03/12/2026" },
  { value: "yyyy-MM-dd", label: "2026-03-12" },
] as const;

export function formatDate(value: string | null | undefined, pattern = "dd MMM yyyy") {
  if (!value) return "Undated";
  try {
    return format(parseISO(value.slice(0, 10)), pattern);
  } catch {
    return value;
  }
}
