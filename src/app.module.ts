import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RickApiModule } from './rick-api/rick-api.module.js';
import { CharactersModule } from './characters/characters.module.js';
import { EpisodesModule } from './episodes/episodes.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { SearchModule } from './search/search.module.js';
import { AiModule } from './ai/ai.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RickApiModule,
    CharactersModule,
    EpisodesModule,
    LocationsModule,
    SearchModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
