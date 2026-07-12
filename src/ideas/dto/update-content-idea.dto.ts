import { IsEnum, IsOptional } from 'class-validator';
import { ContentIdeaStatus } from '../enums/content-idea-status.enum';

export class UpdateContentIdeaDto {
  @IsOptional()
  @IsEnum(ContentIdeaStatus)
  status?: ContentIdeaStatus;
}
