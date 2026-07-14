import {
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(30000)
  context?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32000)
  maxTokens?: number;

  @IsOptional()
  @IsIn(['json'])
  responseFormat?: 'json';
}
