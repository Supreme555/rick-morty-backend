import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service.js';
import { CharactersService } from '../characters/characters.service.js';
import type { AiDescription, CharacterDetail } from '../common/types.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const AI_TIMEOUT_MS = 20_000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly characters: CharactersService,
  ) {}

  get isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async describeCharacter(characterId: number): Promise<AiDescription> {
    const cached = await this.prisma.aiDescription.findUnique({ where: { characterId } });
    if (cached) {
      return {
        characterId,
        description: cached.description,
        cached: true,
        model: cached.model,
        generatedAt: cached.createdAt.toISOString(),
      };
    }

    if (!this.isConfigured) {
      throw new ServiceUnavailableException('AI is not configured');
    }

    // Throws 404 if the character does not exist — before we spend an AI call.
    const character = await this.characters.getById(characterId);
    const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    const description = await this.generate(model, buildPrompt(character));

    const saved = await this.prisma.aiDescription.upsert({
      where: { characterId },
      create: { characterId, description, model },
      update: { description, model },
    });

    return {
      characterId,
      description: saved.description,
      cached: false,
      model: saved.model,
      generatedAt: saved.createdAt.toISOString(),
    };
  }

  private async generate(model: string, prompt: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let text: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.8,
          maxOutputTokens: 700,
          thinkingConfig: { thinkingBudget: 0 },
          httpOptions: { timeout: AI_TIMEOUT_MS },
        },
      });
      text = response.text;
    } catch (error) {
      this.logger.error(`Gemini request failed: ${(error as Error).message}`);
      throw new BadGatewayException('AI provider error');
    }

    const trimmed = text?.trim();
    if (!trimmed) {
      throw new BadGatewayException('AI returned an empty response');
    }
    return trimmed;
  }
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
    last && last !== first ? `Последнее появление: ${last.episode} «${last.name}»` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `Ты — энциклопедия по мультсериалу «Рик и Морти». Напиши на русском языке живое, но точное описание персонажа: кто это, чем известен, какую роль играет в сюжете, интересные детали. 2–3 абзаца, 120–180 слов, без заголовков, без markdown-разметки и без списков. Опирайся на известные факты о сериале; если персонаж эпизодический и о нём почти ничего не известно — честно скажи об этом и опиши его по имеющимся данным, не выдумывай сюжетные подробности.

Данные персонажа:
${facts}`;
}
