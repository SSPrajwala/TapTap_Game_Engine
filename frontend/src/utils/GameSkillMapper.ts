/**
 * GameSkillMapper — automatically derives skill tags for a game config.
 *
 * Skill tags are shown on each game card and used to update the user's
 * skill progress after playing.  The mapping uses three layers:
 *
 *  1. Plugin type  → primary skill(s)
 *  2. Title/description keyword scan → topic skills
 *  3. Existing aptitudeTags passthrough
 */

import type { GameConfig } from "../types/engine.types"

// ── Skill meta ────────────────────────────────────────────────────────────────

export const SKILL_LABELS: Record<string, string> = {
  logical_reasoning:   "Logical Reasoning",
  algorithms:          "Algorithms",
  vocabulary:          "Vocabulary",
  attention_to_detail: "Attention to Detail",
  numerical_ability:   "Numerical Ability",
  pattern_recognition: "Pattern Recognition",
  problem_solving:     "Problem Solving",
  verbal_ability:      "Verbal Ability",
  memory:              "Memory",
  focus:               "Focus",
  general_knowledge:   "General Knowledge",
  coding:              "Coding",
  mathematics:         "Mathematics",
  language:            "Language",
  science:             "Science",
  history:             "History",
  aptitude:            "Aptitude",
}

export const SKILL_COLORS: Record<string, string> = {
  logical_reasoning:   "#A855F7",
  algorithms:          "#00D4FF",
  vocabulary:          "#22FFAA",
  attention_to_detail: "#FBBF24",
  numerical_ability:   "#F87171",
  pattern_recognition: "#818CF8",
  problem_solving:     "#34D399",
  verbal_ability:      "#F472B6",
  memory:              "#FB923C",
  focus:               "#60A5FA",
  general_knowledge:   "#A3E635",
  coding:              "#00D4FF",
  mathematics:         "#F87171",
  language:            "#22FFAA",
  science:             "#818CF8",
  history:             "#FBBF24",
  aptitude:            "#A855F7",
}

// ── Plugin → skills map ────────────────────────────────────────────────────────

const PLUGIN_SKILLS: Record<string, string[]> = {
  quiz:         ["general_knowledge", "attention_to_detail"],
  flashcard:    ["vocabulary", "memory"],
  puzzle:       ["logical_reasoning", "pattern_recognition"],
  memory:       ["memory", "focus"],
  sudoku:       ["numerical_ability", "logical_reasoning"],
  wordbuilder:  ["vocabulary", "verbal_ability"],
  tapblitz:     ["focus", "attention_to_detail"],
  binaryrunner: ["algorithms", "logical_reasoning", "coding"],
}

// ── Keyword → skill map ────────────────────────────────────────────────────────
// Each entry: [regex-pattern, skill-area]

const KEYWORD_SKILLS: [RegExp, string][] = [
  // Math / numbers
  [/\b(math|calcul|numeric|number|arithmetic|algebra|fraction|decimal|percent)\b/i, "numerical_ability"],
  [/\b(equation|formula|geometry|trigon|statistic|probability)\b/i, "mathematics"],
  // Logic / algorithms
  [/\b(logic|reasoning|deduc|sequence|pattern|puzzle|problem)\b/i, "logical_reasoning"],
  [/\b(algorithm|sort|search|recursion|data struct|binary|code|program|comput)\b/i, "algorithms"],
  [/\b(coding|programming|developer|software|javascript|python|java|c\+\+)\b/i, "coding"],
  // Language / vocabulary
  [/\b(vocab|word|language|grammar|spelling|synonym|antonym|defin|meaning)\b/i, "vocabulary"],
  [/\b(verbal|sentence|paragraph|compre|reading|essay|english|hindi|write)\b/i, "verbal_ability"],
  // Science
  [/\b(science|physics|chemistry|biology|astro|earth|environ|ecology|lab)\b/i, "science"],
  // History / general knowledge
  [/\b(history|histor|event|war|culture|geography|capital|country|world|civics)\b/i, "history"],
  [/\b(general|gk|knowledge|quiz|trivia|current|affair)\b/i, "general_knowledge"],
  // Memory / focus
  [/\b(memory|remem|recall|flash|card|pair|match)\b/i, "memory"],
  [/\b(focus|concentration|attent|reflex|speed|quick|reaction|blitz)\b/i, "focus"],
  // Aptitude
  [/\b(aptitude|placement|campus|interview|cat|gmat|gre|competitive)\b/i, "aptitude"],
]

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Returns up to 3 skill tags for a game, derived from plugin type + content.
 */
export function getGameSkills(game: GameConfig): string[] {
  const seen   = new Set<string>()
  const result: string[] = []

  const add = (skill: string) => {
    if (!seen.has(skill)) { seen.add(skill); result.push(skill) }
  }

  // 1. Passthrough existing aptitudeTags (already set by admin / AI)
  if (game.aptitudeTags?.length) {
    game.aptitudeTags.forEach(t => add(t.toLowerCase().replace(/\s+/g, "_")))
  }

  // 2. Plugin-based primary skills
  const pluginSkills = PLUGIN_SKILLS[game.plugin] ?? []
  pluginSkills.forEach(add)

  // 3. Keyword scan on title + description + learningOutcomes
  const text = [
    game.title ?? "",
    game.description ?? "",
    ...(game.learningOutcomes ?? []),
  ].join(" ").toLowerCase()

  for (const [pattern, skill] of KEYWORD_SKILLS) {
    if (pattern.test(text)) add(skill)
    if (result.length >= 5) break
  }

  // Return top 3 (most specific first)
  return result.slice(0, 3)
}

/**
 * Display label for a skill key, e.g. "logical_reasoning" → "Logical Reasoning"
 */
export function skillLabel(key: string): string {
  return SKILL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Hex colour for a skill tag badge.
 */
export function skillColor(key: string): string {
  return SKILL_COLORS[key] ?? "#A855F7"
}
