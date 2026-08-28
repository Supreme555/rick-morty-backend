import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FinishReason, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { envOr } from '../common/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CharactersService } from '../characters/characters.service.js';
import type { AiDescription, CharacterDetail } from '../common/types.js';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const AI_TIMEOUT_MS = 45_000;

interface StoredDescription {
  characterId: number;
  description: string;
  model: string;
  updatedAt: Date;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  /** Collapses concurrent misses for the same character into one paid generation. */
  private readonly inflight = new Map<number, Promise<AiDescription>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  get isConfigured(): boolean {
    return envOr('GEMINI_API_KEY') !== undefined;
  }

  /**
   * Already generated descriptions are served from the DB even without an API
   * key; only new generations require GEMINI_API_KEY (503 otherwise).
   */
  async describeCharacter(characterId: number): Promise<AiDescription> {
    const cached = await this.prisma.aiDescription.findUnique({
      where: { characterId },
    });
    if (cached) return toResponse(cached, true);

    const pending = this.inflight.get(characterId);
    if (pending) return pending;

    const task = this.generateAndStore(characterId).finally(() =>
      this.inflight.delete(characterId),
    );
    this.inflight.set(characterId, task);
    return task;
  }

  private async generateAndStore(characterId: number): Promise<AiDescription> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('AI is not configured');
    }

    // Throws 404 if the character does not exist — before we spend an AI call.
    const character = await this.characters.getById(characterId);
    const model = envOr('GEMINI_MODEL', DEFAULT_MODEL);
    const description = await this.generate(model, buildPrompt(character));

    const saved = await this.prisma.aiDescription.upsert({
      where: { characterId },
      create: { characterId, description, model },
      update: { description, model },
    });
    return toResponse(saved, false);
  }

  private async generate(model: string, prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: envOr('GEMINI_API_KEY') });
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.8,
          // Thinking tokens count towards this limit, so it must stay generous.
          maxOutputTokens: 4096,
          httpOptions: { timeout: AI_TIMEOUT_MS },
          ...thinkingConfigFor(model),
        },
      });
      const usage = response.usageMetadata;
      this.logger.log(
        `Gemini ${model}: thoughts=${usage?.thoughtsTokenCount ?? 0} out=${usage?.candidatesTokenCount ?? 0} finish=${response.candidates?.[0]?.finishReason}`,
      );
      if (response.candidates?.[0]?.finishReason === FinishReason.MAX_TOKENS) {
        throw new Error('response truncated (MAX_TOKENS)');
      }
      text = response.text;
    } catch (error) {
      this.logger.error(
        `Gemini request failed (${model}): ${(error as Error).message}`,
      );
      throw new BadGatewayException('AI provider error');
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadGatewayException('AI returned an empty response');
    }
    return trimmed;
  }
}

/**
 * Thinking settings are model-specific: Gemini 2.5 Flash accepts
 * `thinkingBudget: 0` (thinking off — fast and cheap), Gemini 3.x uses
 * `thinkingLevel` instead and rejects a zero budget. A short factual
 * description does not need deep reasoning, so thinking is kept minimal.
 * Overrides: GEMINI_THINKING_LEVEL (MINIMAL|LOW|MEDIUM|HIGH) or
 * GEMINI_THINKING_BUDGET (integer tokens, 0 = off, -1 = automatic).
 */
function thinkingConfigFor(model: string): {
  thinkingConfig?: { thinkingLevel?: ThinkingLevel; thinkingBudget?: number };
} {
  const level = envOr('GEMINI_THINKING_LEVEL')?.toUpperCase();
  if (level && level in ThinkingLevel) {
    return { thinkingConfig: { thinkingLevel: level as ThinkingLevel } };
  }
  const budget = envOr('GEMINI_THINKING_BUDGET');
  if (budget !== undefined && Number.isInteger(Number(budget))) {
    return { thinkingConfig: { thinkingBudget: Number(budget) } };
  }
  if (model.startsWith('gemini-2.5-flash'))
    return { thinkingConfig: { thinkingBudget: 0 } };
  if (model.startsWith('gemini-3'))
    return { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };
  return {};
}

function toResponse(row: StoredDescription, cached: boolean): AiDescription {
  return {
    characterId: row.characterId,
    description: row.description,
    cached,
    model: row.model,
    generatedAt: row.updatedAt.toISOString(),
  };
}

function buildPrompt(c: CharacterDetail): string {
  const first = c.episodes[0];
  const last = c.episodes[c.episodes.length - 1];
  const facts = [
    `Имя: ${c.name}`,
    `Статус: ${c.status}`,
    `Вид: ${c.species}${c.type ? ` (${c.type})` : ''}`,
    `Пол: ${c.gender}`,
    `Происхождение: ${c.origin.name}`,
    `Последняя известная локация: ${c.location.name}`,
    `Количество эпизодов: ${c.episodes.length}`,
    first ? `Первое появление: ${first.episode} «${first.name}»` : null,
    last && last !== first
      ? `Последнее появление: ${last.episode} «${last.name}»`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Ты — энциклопедия по мультсериалу «Рик и Морти». Напиши на русском языке живое, но точное описание персонажа: кто это, чем известен, какую роль играет в сюжете, интересные детали. 2–3 абзаца, 120–180 слов, без заголовков, без markdown-разметки и без списков. Опирайся на известные факты о сериале; если персонаж эпизодический и о нём почти ничего не известно — честно скажи об этом и опиши его по имеющимся данным, не выдумывай сюжетные подробности.

Данные персонажа:
${facts}`;
}
