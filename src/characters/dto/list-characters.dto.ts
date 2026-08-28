import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto.js';
import { emptyToUndefined, toLowerCase } from '../../common/query.js';
import { CHARACTER_GENDERS, CHARACTER_STATUSES } from '../../common/types.js';

/** Upstream filters are case-insensitive; we normalise to lowercase. */
const STATUS_FILTERS = CHARACTER_STATUSES.map((s) => s.toLowerCase());
const GENDER_FILTERS = CHARACTER_GENDERS.map((g) => g.toLowerCase());

export class ListCharactersDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by name (substring, case-insensitive)',
  })
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: STATUS_FILTERS })
  @emptyToUndefined()
  @toLowerCase()
  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  species?: string;

  @ApiPropertyOptional()
  @emptyToUndefined()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional({ enum: GENDER_FILTERS })
  @emptyToUndefined()
  @toLowerCase()
  @IsOptional()
  @IsIn(GENDER_FILTERS)
  gender?: string;
}
