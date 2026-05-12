"use strict";

/**
 * Единая политика публичных меток (тегов) ботов.
 * Дублируйте запреты в pages/search.html (FORBIDDEN_TAGS) и в pages/create.html для UI.
 */

const FORBIDDEN_TAGS = new Set([
  "18+",
  "16+",
  "18_",
  "16_",
  "18plus",
  "16plus",
  "18_plus",
  "18_+",
  "16_+",
  "r18",
  "mature",
  "adult",
  "nsfw",
  "porn",
  "porno",
  "порно",
  "sex",
  "секс",
  "xxx",
  "bdsm",
  "эротика",
  "hentai",
  "хентай",
  "wlw",
  "mlm",
  "poly",
  "polyamory",
  "полиамория",
  "submissive",
  "dominant",
  "сабмиссив",
  "доминант",
  "flirt",
  "флирт",
  "politics",
  "religion",
  "политика",
  "религия",
]);

const MAX_BOT_TAGS = 16;

function normalizeTagKey(raw) {
  return String(raw ?? "")
    .trim()
    .normalize("NFKC")
    .replace(/^#+/g, "")
    .replace(/\+/g, "_")
    .replace(/,/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function isForbiddenTagKey(key) {
  const k = normalizeTagKey(key);
  if (!k || k === "all") return true;
  if (FORBIDDEN_TAGS.has(k)) return true;

  const parts = k.split("_").filter(Boolean);
  for (const part of parts) {
    if (FORBIDDEN_TAGS.has(part)) return true;
  }

  for (let i = 0; i < parts.length - 1; i += 1) {
    if (parts[i] === "18" && parts[i + 1] === "plus") return true;
    if (parts[i] === "16" && parts[i + 1] === "plus") return true;
  }

  return false;
}

/** Свои метки: буквы (любой язык), цифры, подчёркивание; без +, /, emoji и т.п. */
function isAllowedCustomTagShape(key) {
  const k = normalizeTagKey(key);
  if (k.length < 2 || k.length > 40) return false;
  if (!/^[\p{L}\p{N}_]+$/u.test(k)) return false;
  if (/^\d+$/.test(k)) return false;
  return true;
}

/**
 * Очищает строку тегов для записи в БД: убирает запрещённые и мусор, дедуп, лимит.
 */
function sanitizeBotTagsField(tagsInput, maxTags = MAX_BOT_TAGS) {
  const raw = String(tagsInput ?? "");
  const parts = raw
    .split(/[,;]+/g)
    .map((s) => normalizeTagKey(s))
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const p of parts) {
    if (seen.has(p)) continue;
    if (isForbiddenTagKey(p)) continue;
    if (!isAllowedCustomTagShape(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= maxTags) break;
  }

  return out.join(", ");
}

function isTagForbiddenForClient(key) {
  return isForbiddenTagKey(key);
}

module.exports = {
  FORBIDDEN_TAGS,
  MAX_BOT_TAGS,
  normalizeTagKey,
  isForbiddenTagKey,
  isAllowedCustomTagShape,
  sanitizeBotTagsField,
  isTagForbiddenForClient,
};
