import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service.js';
import { ListLocationsDto } from './dto/list-locations.dto.js';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List locations (20 per page) with optional filters' })
  list(@Query() query: ListLocationsDto) {
    return this.locations.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Location details with its residents' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.locations.getById(id);
  }
}
