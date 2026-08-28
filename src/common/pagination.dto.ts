import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

const PAGE_MESSAGE = 'page must be a positive integer';

/**
 * "" / missing -> 1 (keeps the default alive: class-transformer would otherwise
 * overwrite the initializer with undefined); anything non-integer -> 0 so that
 * exactly one validation message (@Min) is produced.
 */
function toPage() {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 1;
    const n = Number(value);
    return Number.isInteger(n) ? n : 0;
  });
}

export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @toPage()
  @IsInt({ message: PAGE_MESSAGE })
  @Min(1, { message: PAGE_MESSAGE })
  page: number = 1;
}
