/**
 * Ollama: вызовы API, сбор системного промпта и проверка ответов бота.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:3b";
const OLLAMA_FALLBACK_MODEL = process.env.OLLAMA_FALLBACK_MODEL || "qwen2.5:1.5b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 45000;
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT) || 20;
const MAX_USER_MESSAGE_LENGTH = Number(process.env.MAX_USER_MESSAGE_LENGTH) || 2000;
const MIN_BOT_REPLY_CHARS = Number(process.env.MIN_BOT_REPLY_CHARS) || 260;
const MAX_REPLY_REWRITE_ATTEMPTS = Number(process.env.MAX_REPLY_REWRITE_ATTEMPTS) || 2;
const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE) || 0.55;
const OLLAMA_TOP_P = Number(process.env.OLLAMA_TOP_P) || 0.85;
const OLLAMA_REPEAT_PENALTY = Number(process.env.OLLAMA_REPEAT_PENALTY) || 1.12;

function buildSystemPrompt(botSystemPrompt, personaPrompt, botName) {
  const rawSystemPrompt = String(botSystemPrompt || "");
  const promptMetadata = extractPromptMetadata(rawSystemPrompt);
  const scenario = getPromptSection(rawSystemPrompt, "Сценарий:");
  const roleplayRules =
    promptMetadata?.roleplayRules ||
    getPromptSection(rawSystemPrompt, "Правила отыгрыша роли:");
  const memoryFacts =
    promptMetadata?.memoryFacts ||
    getPromptSection(rawSystemPrompt, "Ключевые факты для памяти:");
  const characterRules =
    promptMetadata?.characterRules ||
    getPromptSection(rawSystemPrompt, "Ограничения и предупреждения:");

  const parts = [];
  parts.push(
    `Ты — персонаж "${botName || "бот"}". Всегда отвечай от лица этого персонажа.`,
  );
  parts.push(
    [
      "Стиль ответа: художественный ролевой формат в духе character-chat.",
      "Пиши живо, эмоционально и выразительно, с описанием тона, реакции и микродействий персонажа.",
      "Ответ должен быть обычно 6-12 предложений (или больше, если сцена этого требует), а не односложной фразой.",
      "Давай детальную атмосферу: телесные реакции персонажа, мимику, голос, темп, детали окружения.",
      "Сохраняй атмосферу, развивай сцену и добавляй естественную динамику диалога.",
      "Пиши от первого лица персонажа: используй 'я/мне/мой'.",
      "Запрещен рассказ о себе в третьем лице (например: 'она', имя персонажа как подлежащее действий персонажа).",
      "Ты генерируешь ТОЛЬКО реплику и действия персонажа, но НЕ пользователя.",
      "Строго запрещено описывать мысли, эмоции, слова и действия пользователя как свершившийся факт.",
      "Запрещены конструкции вида: 'ты сказала', 'ты сделал', 'ты подошел', 'ты улыбнулась', 'пользователь сделал'.",
      "Если нужно отреагировать на пользователя, ссылайся только на уже написанное им сообщение без дописывания новых действий.",
      "Можно описывать только реакцию персонажа на уже сказанное пользователем и предлагать пользователю выбор.",
      "Не вставляй реплики за пользователя и не дописывай продолжение его фраз.",
      "Хороший формат: 1) короткое атмосферное действие персонажа, 2) выразительная речь персонажа, 3) эмоциональный хвост сцены.",
      "Структура ответа ОБЯЗАТЕЛЬНА и всегда такая:",
      "1) первая строка: *действие/реакция от первого лица*",
      '2) вторая строка: "реплика персонажа"',
      "3) третья строка: *короткая эмоциональная реакция/намерение*",
      "Соблюдай нормы русского языка: орфография, пунктуация, согласование слов, естественные формулировки.",
      "Если пользователь не просил иначе, отвечай на русском.",
      "Не выдумывай случайные факты, если их нет в сценарии или истории чата.",
      "Не пиши бессвязные и противоречивые фразы; сохраняй причинно-следственную логику.",
    ].join("\n"),
  );

  if (promptMetadata?.scenario || scenario) {
    parts.push(`Сценарий:\n${String(promptMetadata?.scenario || scenario).trim()}`);
  }
  if (roleplayRules && String(roleplayRules).trim()) {
    parts.push(`Правила отыгрыша:\n${String(roleplayRules).trim()}`);
  }
  if (memoryFacts && String(memoryFacts).trim()) {
    parts.push(`Факты для памяти:\n${String(memoryFacts).trim()}`);
  }
  if (characterRules && String(characterRules).trim()) {
    parts.push(`Ограничения:\n${String(characterRules).trim()}`);
  }

  if (!promptMetadata && rawSystemPrompt.trim()) {
    parts.push(`Дополнительные настройки:\n${rawSystemPrompt.trim().slice(0, 1500)}`);
  }

  if (personaPrompt && personaPrompt.trim()) {
    parts.push(
      `Персона пользователя (учитывай стиль речи и роль в диалоге):\n${personaPrompt.trim()}`,
    );
  }

  return parts.join("\n\n");
}

function mapMessagesToOllamaHistory(rows) {
  return rows
    .slice()
    .reverse()
    .map((row) => ({
      role: row.sender_type === "user" ? "user" : "assistant",
      content: String(row.content || ""),
    }))
    .filter((message) => message.content.trim().length > 0);
}

function extractPromptMetadata(systemPrompt) {
  const prompt = String(systemPrompt || "");
  const match = prompt.match(
    /^\[CHARITOR_PROMPT_V1\]\n([\s\S]*?)\n\[\/CHARITOR_PROMPT_V1\]\n\n/,
  );
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function getPromptSection(promptText, sectionTitle) {
  const text = String(promptText || "");
  if (!text) return "";

  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRegex = new RegExp(
    `${escaped}\\s*\\n([\\s\\S]*?)(?:\\n(?:Биография персонажа:|Сценарий:|Правила отыгрыша роли:|Ключевые факты для памяти:|Ограничения и предупреждения:|Метки:)|$)`,
    "i",
  );
  const match = text.match(sectionRegex);
  return match?.[1]?.trim() || "";
}

async function buildBotReplyFromHistory(
  dbQuery,
  chatId,
  chat,
  personaPrompt,
  personaName,
  upperMessageId = null,
  flags = {},
) {
  const historySql = upperMessageId
    ? `
        SELECT
          sender_type,
          content
        FROM messages
        WHERE chat_id = ? AND id <= ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `
    : `
        SELECT
          sender_type,
          content
        FROM messages
        WHERE chat_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `;
  const historyParams = upperMessageId
    ? [chatId, upperMessageId, CHAT_HISTORY_LIMIT]
    : [chatId, CHAT_HISTORY_LIMIT];
  const historyRows = await dbQuery(historySql, historyParams);

  return generateBotReply({
    botName: chat.bot_name,
    botSystemPrompt: chat.bot_system_prompt,
    personaPrompt: String(personaPrompt || ""),
    personaName: String(personaName || ""),
    history: mapMessagesToOllamaHistory(historyRows),
    regenerate: Boolean(flags.regenerate),
  });
}

function buildSamplingOptions(regenerate) {
  if (!regenerate) return {};
  return {
    temperature: Math.min(0.92, OLLAMA_TEMPERATURE + 0.2),
    top_p: Math.max(OLLAMA_TOP_P, 0.9),
    repeat_penalty: Math.min(1.3, OLLAMA_REPEAT_PENALTY + 0.12),
  };
}

async function requestOllamaChat(model, messages, optionOverrides = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const options = {
      temperature: OLLAMA_TEMPERATURE,
      top_p: OLLAMA_TOP_P,
      repeat_penalty: OLLAMA_REPEAT_PENALTY,
      seed: Math.floor(Math.random() * 2147483647),
      ...optionOverrides,
    };

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options,
      }),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Ollama error (${response.status})`);
    }

    const text = String(data?.message?.content || "").trim();
    if (!text) {
      throw new Error("Пустой ответ от модели");
    }

    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

function containsUserAgencyViolation(text, personaName = "") {
  const value = String(text || "").toLowerCase();
  if (!value.trim()) return false;
  const safePersonaName = String(personaName || "").trim().toLowerCase();
  const escapedPersonaName = safePersonaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    /\bты\s+(сказал|сказала|сделал|сделала|улыбнул[а-я]*|подош[её]л|подошла|взял|взяла|крикнул|крикнула|ответил|ответила|почувствовал|почувствовала)\b/i,
    /\bпользователь\s+(сказал|сказала|сделал|сделала|подош[её]л|подошла|улыбнул[а-я]*)\b/i,
    /\b(?:она|он)\s+(сказал|сказала|сделал|сделала|начала|начал|пош[её]л|пошла|атаковал[а]?|ударил[а]?|отступил[а]?)\b/i,
  ];
  const hasGenericViolation = patterns.some((pattern) => pattern.test(value));

  if (!escapedPersonaName) return hasGenericViolation;

  const personaActionPattern = new RegExp(
    `\\b${escapedPersonaName}\\b[^.!?\\n]{0,60}\\b(сказал|сказала|сделал|сделала|начала|начал|пош[её]л|пошла|атаковал[а]?|ударил[а]?|отступил[а]?|улыбнул[а-я]*)\\b`,
    "i",
  );
  return hasGenericViolation || personaActionPattern.test(value);
}

function hasPoorRussianQuality(text) {
  const value = String(text || "");
  if (!value.trim()) return true;
  if (value.length < MIN_BOT_REPLY_CHARS) return true;

  const sentenceCount = value
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
  return sentenceCount < 3;
}

function hasThirdPersonSelfReference(text, botName) {
  const value = String(text || "");
  const lower = value.toLowerCase();
  const lowerBotName = String(botName || "").trim().toLowerCase();

  const selfByNamePattern = lowerBotName
    ? new RegExp(`\\b${lowerBotName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    : null;
  const mentionsSelfByName = selfByNamePattern ? selfByNamePattern.test(lower) : false;
  const hasThirdPersonPronouns = /\b(она|он|ей|ему|её|его|ею)\b/i.test(lower);
  if (mentionsSelfByName) return true;
  return hasThirdPersonPronouns;
}

function hasBadRoleplayStructure(text) {
  const value = String(text || "").trim();
  if (!value) return true;

  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hasActionLike = lines.some((line) => line.startsWith("*") && line.endsWith("*"));
  const hasQuoteLike = /["«][^"»]+["»]/.test(value);
  /* Не требуем ровно 3 строки — иначе модель часто «проваливается» в один и тот же запасной шаблон. */
  return lines.length < 3 || !hasActionLike || !hasQuoteLike;
}

function buildHardSafeFallbackReply() {
  return [
    "*Я делаю медленный вдох, удерживая взгляд и контролируя каждое движение.*",
    '"Говори со мной прямо. Я отвечу честно и в своей манере, но не стану приписывать тебе того, чего ты не делала."',
    "*Я сохраняю дистанцию и жду твоего следующего шага, внимательно отслеживая каждую деталь ситуации.*",
  ].join("\n");
}

function isReplyAcceptable(text, botName, personaName) {
  return (
    !containsUserAgencyViolation(text, personaName) &&
    !hasThirdPersonSelfReference(text, botName) &&
    !hasBadRoleplayStructure(text) &&
    !hasPoorRussianQuality(text)
  );
}

async function enforceReplyQuality(
  model,
  baseMessages,
  draftReply,
  botName,
  personaName,
  samplingOptions = {},
) {
  let currentReply = String(draftReply || "").trim();
  let attempts = 0;

  while (
    attempts < MAX_REPLY_REWRITE_ATTEMPTS &&
    !isReplyAcceptable(currentReply, botName, personaName)
  ) {
    const rewriteInstruction = [
      "Перепиши ответ строго по правилам.",
      "1) Пиши ТОЛЬКО от первого лица персонажа: я, мне, мой; не используй он/она о себе и не ставь своё имя как подлежащее.",
      "2) Не пиши за пользователя и не описывай его действия как факт.",
      `2.1) Не используй имя персоны пользователя "${String(personaName || "").trim()}" в связке с глаголами действий.`,
      "3) Формат ровно 3 строки:",
      "   *действие/реакция от первого лица*",
      '   "реплика персонажа"',
      "   *эмоциональная реакция/намерение*",
      "4) Исправь русский язык: орфография, пунктуация, логика.",
      "5) Сохрани атмосферу сцены и характер персонажа.",
      "6) Верни только итоговый ответ без пояснений.",
    ].join("\n");

    currentReply = await requestOllamaChat(
      model,
      [
        ...baseMessages,
        { role: "assistant", content: currentReply },
        { role: "user", content: rewriteInstruction },
      ],
      samplingOptions,
    );
    attempts += 1;
  }

  if (!isReplyAcceptable(currentReply, botName, personaName)) {
    const variantHint = [
      "Сгенерируй новый вариант ответа на последнюю реплику пользователя.",
      "Другие слова, образы и детали — не копируй и не перефразируй дословно предыдущие черновики.",
      "Формат: минимум 3 строки — *действие от первого лица*, реплика в кавычках, затем *короткое действие или эмоция*.",
      "Только я/мне о себе; не пиши за пользователя.",
      "Верни только текст ответа.",
    ].join("\n");

    const fresh = await requestOllamaChat(
      model,
      [
        ...baseMessages,
        {
          role: "user",
          content: variantHint,
        },
      ],
      {
        ...samplingOptions,
        temperature: Math.min(0.95, OLLAMA_TEMPERATURE + 0.38),
        top_p: 0.93,
        repeat_penalty: Math.min(1.35, OLLAMA_REPEAT_PENALTY + 0.15),
      },
    );
    const refined = String(fresh || "").trim();
    if (isReplyAcceptable(refined, botName, personaName)) {
      return refined;
    }
    if (
      refined.length >= MIN_BOT_REPLY_CHARS &&
      !containsUserAgencyViolation(refined, personaName) &&
      !hasThirdPersonSelfReference(refined, botName)
    ) {
      return refined;
    }
    if (
      currentReply.length >= MIN_BOT_REPLY_CHARS &&
      !containsUserAgencyViolation(currentReply, personaName) &&
      !hasThirdPersonSelfReference(currentReply, botName)
    ) {
      return currentReply;
    }
    return buildHardSafeFallbackReply();
  }

  return currentReply;
}

async function generateBotReply({
  botName,
  botSystemPrompt,
  personaPrompt,
  personaName,
  history,
  regenerate = false,
}) {
  const samplingOptions = buildSamplingOptions(regenerate);

  const messages = [
    {
      role: "system",
      content: buildSystemPrompt(botSystemPrompt, personaPrompt, botName),
    },
    ...history,
  ];

  try {
    let reply = await requestOllamaChat(OLLAMA_MODEL, messages, samplingOptions);
    reply = await enforceReplyQuality(
      OLLAMA_MODEL,
      messages,
      reply,
      botName,
      personaName,
      samplingOptions,
    );
    if (isReplyAcceptable(reply, botName, personaName)) {
      return reply;
    }

    const expansionMessages = [
      ...messages,
      {
        role: "assistant",
        content: reply,
      },
      {
        role: "user",
        content:
          "Сделай ответ значительно более развернутым и атмосферным: добавь эмоции, реакцию персонажа, детали сцены и плавное развитие диалога. Не сокращай. Не добавляй текст и действия за пользователя.",
      },
    ];

    const expandedDraft = await requestOllamaChat(OLLAMA_MODEL, expansionMessages, samplingOptions);
    const expanded = await enforceReplyQuality(
      OLLAMA_MODEL,
      messages,
      expandedDraft,
      botName,
      personaName,
      samplingOptions,
    );
    return expanded;
  } catch (primaryError) {
    if (!OLLAMA_FALLBACK_MODEL || OLLAMA_FALLBACK_MODEL === OLLAMA_MODEL) {
      throw primaryError;
    }

    let fallbackReply = await requestOllamaChat(OLLAMA_FALLBACK_MODEL, messages, samplingOptions);
    fallbackReply = await enforceReplyQuality(
      OLLAMA_FALLBACK_MODEL,
      messages,
      fallbackReply,
      botName,
      personaName,
      samplingOptions,
    );
    if (isReplyAcceptable(fallbackReply, botName, personaName)) {
      return fallbackReply;
    }

    const fallbackExpansionMessages = [
      ...messages,
      {
        role: "assistant",
        content: fallbackReply,
      },
      {
        role: "user",
        content:
          "Сделай ответ более длинным и выразительным: эмоции, действия персонажа, атмосфера, развитие сцены. Не пиши за пользователя и не описывай его действия как факт.",
      },
    ];
    const fallbackExpanded = await requestOllamaChat(
      OLLAMA_FALLBACK_MODEL,
      fallbackExpansionMessages,
      samplingOptions,
    );
    const fallbackExpandedChecked = await enforceReplyQuality(
      OLLAMA_FALLBACK_MODEL,
      messages,
      fallbackExpanded,
      botName,
      personaName,
      samplingOptions,
    );
    return fallbackExpandedChecked;
  }
}

module.exports = {
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  OLLAMA_FALLBACK_MODEL,
  OLLAMA_TIMEOUT_MS,
  CHAT_HISTORY_LIMIT,
  MAX_USER_MESSAGE_LENGTH,
  MIN_BOT_REPLY_CHARS,
  MAX_REPLY_REWRITE_ATTEMPTS,
  OLLAMA_TEMPERATURE,
  OLLAMA_TOP_P,
  OLLAMA_REPEAT_PENALTY,
  buildSystemPrompt,
  mapMessagesToOllamaHistory,
  extractPromptMetadata,
  getPromptSection,
  buildBotReplyFromHistory,
  generateBotReply,
};
