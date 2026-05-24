export type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export type JwtClaims = {
  tenant_id: string;
  user_id: string;
  role: Role;
  iat: number;
  exp: number;
};

export type RequestContext = {
  tenant_id: string;
  user_id: string;
  role: Role;
  request_id: string;
};
