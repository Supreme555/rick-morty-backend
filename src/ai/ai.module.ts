import { Module } from '@nestjs/common';
import { CharactersModule } from '../characters/characters.module.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';

@Module({
  imports: [CharactersModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
