import { AgencyRole } from '../common/enums/agency-role.enum';

export type AuthUser = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName?: string;
  memberships?: Array<{
    id: string;
    role: AgencyRole;
    agency: {
      id: string;
      name: string;
    };
  }>;
};
