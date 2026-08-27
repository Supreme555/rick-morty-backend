import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { emptyToUndefined } from '../../common/query.js';

export class SearchDto {
  @ApiPropertyOptional({ description: 'Search text matched against names' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
