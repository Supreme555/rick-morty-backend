import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto.js';
import { emptyToUndefined } from '../../common/query.js';

export class ListEpisodesDto extends PaginationDto {
  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Episode code, e.g. S01E01 or S01' })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  episode?: string;
}
