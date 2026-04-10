import type { Proficiency } from "./session-types";

export function proficiencyLabel(p: Proficiency): string {
  switch (p) {
    case "beginner":
      return "초급";
    case "intermediate":
      return "중급";
    case "advanced":
      return "고급";
    default:
      return p;
  }
}
