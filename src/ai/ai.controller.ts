import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service.js';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('characters/:id/description')
  @ApiOperation({ summary: 'AI-generated character description (cached in DB after first call)' })
  @ApiResponse({ status: 503, description: 'AI is not configured (no GEMINI_API_KEY)' })
  @ApiResponse({ status: 502, description: 'AI provider error' })
  describeCharacter(@Param('id', ParseIntPipe) id: number) {
    return this.ai.describeCharacter(id);
  }
}
