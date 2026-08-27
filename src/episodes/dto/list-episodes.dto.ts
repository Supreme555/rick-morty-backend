import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { emptyToUndefined, toOptionalInt } from '../../common/query.js';

export class ListEpisodesDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @toOptionalInt()
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

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
