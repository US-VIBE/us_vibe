const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.log("Usage: node scripts/prompt-to-spec.js \"요구사항 문장\"");
  process.exit(0);
}

console.log("# Prompt-to-Spec");
console.log("- Goal:", prompt);
console.log("- Scope: MVP 범위 내로 제한");
console.log("- Acceptance: 체크리스트 Gate 기준 충족");
