import { isDictionaryWord } from "./words";

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

export interface ScoreBreakdown {
  score: number;
  tier: "comum" | "bom" | "raro" | "lendário";
  reasons: string[];
}

/**
 * Heurística local de raridade/qualidade. Não usa LLM — o resultado é
 * determinístico para o mesmo nome, o que torna as comparações honestas.
 */
export function scoreName(name: string): ScoreBreakdown {
  const clean = name.toLowerCase();
  const len = clean.length;
  const reasons: string[] = [];
  let score = 42;

  // Comprimento: cada caractere a menos vale muito no mercado de handles.
  if (len <= 3) {
    score += 34;
    reasons.push("comprimento mínimo");
  } else if (len === 4) {
    score += 24;
    reasons.push("4 caracteres");
  } else if (len === 5) {
    score += 12;
    reasons.push("5 caracteres");
  } else if (len <= 7) {
    score += 3;
  } else {
    score -= Math.min(14, (len - 7) * 2);
  }

  const letters = clean.replace(/[^a-z]/g, "");
  const digits = clean.replace(/[^0-9]/g, "");
  const separators = clean.replace(/[a-z0-9]/g, "");

  if (digits.length) {
    score -= digits.length * 7;
    reasons.push("contém números");
  }
  if (separators.length) {
    score -= separators.length * 6;
    reasons.push("contém separadores");
  }

  if (/^([a-z])\1+$/.test(letters) && letters.length >= 2) {
    score += 18;
    reasons.push("padrão repetido");
  }
  if (letters.length > 2 && letters === [...letters].reverse().join("")) {
    score += 12;
    reasons.push("palíndromo");
  }
  if (/^[a-z]{3,6}$/.test(letters) && isDictionaryWord(letters)) {
    score += 20;
    reasons.push("palavra de dicionário");
  }

  // Sonoridade: alternância de vogais e consoantes.
  if (letters.length > 1) {
    let alternations = 0;
    for (let i = 1; i < letters.length; i += 1) {
      const prevVowel = VOWELS.has(letters[i - 1]);
      const currVowel = VOWELS.has(letters[i]);
      if (prevVowel !== currVowel) alternations += 1;
    }
    const ratio = alternations / (letters.length - 1);
    if (ratio > 0.6) {
      score += 9;
      reasons.push("fácil de pronunciar");
    } else if (ratio < 0.3) {
      score -= 8;
    }
    if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(letters)) {
      score -= 10;
      reasons.push("sequência de consoantes");
    }
    if (/(.)\1\1/.test(letters)) {
      score -= 8;
    }
    if (VOWELS.has(letters[letters.length - 1])) {
      score += 3;
    }
  }

  const finalScore = Math.max(1, Math.min(99, Math.round(score)));
  const tier: ScoreBreakdown["tier"] =
    finalScore >= 85 ? "lendário" : finalScore >= 70 ? "raro" : finalScore >= 55 ? "bom" : "comum";

  return { score: finalScore, tier, reasons: reasons.slice(0, 3) };
}

export function tierLabel(tier: ScoreBreakdown["tier"]): string {
  return tier;
}
