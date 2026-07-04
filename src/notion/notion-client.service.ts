import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTION_CLIENT_FACTORY } from './notion.constants';
import type { NotionClientFactory, NotionClientPort } from './notion.types';

/**
 * Fournit un client Notion pret a l'emploi.
 *
 * Resolution du token pour le socle : un `tokenOverride` explicite (futur token
 * par agence) sinon le token global `NOTION_TOKEN`. Le seam par agence pourra
 * etre branche en iteration 2 sans changer les appelants.
 */
@Injectable()
export class NotionClientService {
  constructor(
    @Inject(NOTION_CLIENT_FACTORY)
    private readonly factory: NotionClientFactory,
    private readonly config: ConfigService,
  ) {}

  getClient(tokenOverride?: string | null): NotionClientPort {
    const token =
      tokenOverride?.trim() || this.config.get<string>('NOTION_TOKEN');

    if (!token) {
      throw new Error(
        'Notion token is not configured (set NOTION_TOKEN or provide a per-agency token).',
      );
    }

    return this.factory(token);
  }
}
