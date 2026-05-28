import { FastifyRequest } from 'fastify';
import { AuthUser } from './auth.types';

export type AuthenticatedRequest = FastifyRequest & {
  user: AuthUser;
};
