import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service.js';
import { SearchDto } from './dto/search.dto.js';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search characters, episodes and locations by name at once',
  })
  search(@Query() query: SearchDto) {
    return this.searchService.search(query.q);
  }
}
