import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateFeedSourceDto {
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultTopics?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
