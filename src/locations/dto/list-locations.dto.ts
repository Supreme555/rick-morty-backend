import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto.js';
import { emptyToUndefined } from '../../common/query.js';

export class ListLocationsDto extends PaginationDto {
  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dimension?: string;
}
