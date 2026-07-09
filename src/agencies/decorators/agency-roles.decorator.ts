import { SetMetadata } from '@nestjs/common';
import { AgencyRole } from '../../common/enums/agency-role.enum';

export const AGENCY_ROLES_KEY = 'agency_roles';

export type AgencyRolesOptions = {
  agencyIdKey?: string;
  agencyIdSource?: 'body' | 'params' | 'query';
  membershipIdParam?: string;
};

export type AgencyRolesMetadata = {
  roles: AgencyRole[];
  options: AgencyRolesOptions;
};

/**
 * Declares which agency roles are allowed to call a route.
 *
 * By default, AgencyRolesGuard reads `agencyId` from body, params or query.
 * Use `membershipIdParam` when the route identifies a membership instead.
 */
export function AgencyRoles(
  ...rolesOrOptions: Array<AgencyRole | AgencyRolesOptions>
) {
  const maybeOptions = rolesOrOptions.at(-1);
  const options = typeof maybeOptions === 'object' ? maybeOptions : {};
  const roles = rolesOrOptions.filter(
    (value): value is AgencyRole => typeof value === 'string',
  );

  return SetMetadata(AGENCY_ROLES_KEY, { roles, options });
}
