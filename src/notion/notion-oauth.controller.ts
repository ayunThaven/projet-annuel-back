import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AgencyRoles } from '../agencies/decorators/agency-roles.decorator';
import { AgencyRolesGuard } from '../agencies/guards/agency-roles.guard';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { NotionOAuthService } from './notion-oauth.service';

/**
 * Routes de gestion de la connexion Notion d'une agence (authentifiees).
 */
@Controller('agencies/:agencyId/notion/oauth')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class NotionOAuthController {
  constructor(private readonly notionOAuth: NotionOAuthService) {}

  @Get('authorize-url')
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  getAuthorizeUrl(
    @Param('agencyId') agencyId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return { url: this.notionOAuth.buildAuthorizeUrl(agencyId, req.user.sub) };
  }

  @Get('connection')
  @AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR, AgencyRole.VIEWER, {
    agencyIdSource: 'params',
  })
  getConnection(@Param('agencyId') agencyId: string) {
    return this.notionOAuth.getPublicConnection(agencyId);
  }

  @Delete()
  @AgencyRoles(AgencyRole.OWNER, { agencyIdSource: 'params' })
  disconnect(@Param('agencyId') agencyId: string) {
    return this.notionOAuth.disconnect(agencyId);
  }
}

/**
 * Callback OAuth appele par Notion (non authentifie : pas de cookie de session).
 * L'agence/utilisateur sont recuperes via le `state` signe.
 */
@Controller('notion/oauth')
export class NotionOAuthCallbackController {
  constructor(private readonly notionOAuth: NotionOAuthService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: FastifyReply,
  ) {
    const frontendUrl = this.notionOAuth.getFrontendUrl();

    try {
      if (!code || !state) {
        throw new Error('Missing code or state');
      }
      await this.notionOAuth.handleCallback(code, state);
      // Le code de statut doit etre passe explicitement : sans lui, Fastify
      // reutilise le code deja present sur la reponse (200 par defaut ici),
      // et le navigateur ne suit pas une redirection en 200.
      await res.redirect(`${frontendUrl}/parametres?notion=connected`, 302);
    } catch {
      await res.redirect(`${frontendUrl}/parametres?notion=error`, 302);
    }
  }
}
