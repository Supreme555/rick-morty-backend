import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CharactersService } from './characters.service.js';
import { ListCharactersDto } from './dto/list-characters.dto.js';

@ApiTags('characters')
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get()
  @ApiOperation({
    summary: 'List characters (20 per page) with optional filters',
  })
  list(@Query() query: ListCharactersDto) {
    return this.characters.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Character details with its episodes' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.characters.getById(id);
  }
}
