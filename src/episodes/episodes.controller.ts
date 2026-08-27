import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EpisodesService } from './episodes.service.js';
import { ListEpisodesDto } from './dto/list-episodes.dto.js';

@ApiTags('episodes')
@Controller('episodes')
export class EpisodesController {
  constructor(private readonly episodes: EpisodesService) {}

  @Get()
  @ApiOperation({ summary: 'List episodes (20 per page) with optional filters' })
  list(@Query() query: ListEpisodesDto) {
    return this.episodes.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Episode details with its characters' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.episodes.getById(id);
  }
}
