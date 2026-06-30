import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAgencyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  notionDatabaseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  notionWorkspaceName?: string;
}
