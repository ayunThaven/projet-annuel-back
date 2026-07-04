import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CurationStatus } from '../../common/enums/curation-status.enum';

export class CreateCurationItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsEnum(CurationStatus)
  status?: CurationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  curatedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
