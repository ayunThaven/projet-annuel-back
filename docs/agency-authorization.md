# Agency authorization

Cette doc explique comment proteger une route qui agit sur une agence.

## Principe

- `AuthGuard` verifie que l'utilisateur est connecte.
- `AgencyRolesGuard` verifie que l'utilisateur a le bon role dans l'agence.
- `@AgencyRoles(...)` declare les roles autorises sur la route.

Les roles disponibles sont :

```ts
AgencyRole.OWNER
AgencyRole.EDITOR
AgencyRole.VIEWER
```

## Utilisation classique

Dans un controller, importer :

```ts
import { AuthGuard } from '../auth/auth.guard';
import { AgencyRole } from '../common/enums/agency-role.enum';
import { AgencyRoles } from './decorators/agency-roles.decorator';
import { AgencyRolesGuard } from './guards/agency-roles.guard';
```

Ajouter les guards au controller :

```ts
@Controller('my-resource')
@UseGuards(AuthGuard, AgencyRolesGuard)
export class MyResourceController {}
```

Puis annoter les routes :

```ts
@Post()
@AgencyRoles(AgencyRole.OWNER, AgencyRole.EDITOR)
create(@Body() body: CreateResourceDto) {
  return this.service.create(body);
}
```

Par defaut, le guard cherche `agencyId` dans cet ordre :

1. `body.agencyId`
2. `params.agencyId`
3. `query.agencyId`

Donc le DTO, l'URL ou la query doit contenir un `agencyId`.

## Cas speciaux

Si la cle ne s'appelle pas `agencyId` :

```ts
@AgencyRoles(AgencyRole.OWNER, { agencyIdKey: 'workspaceId' })
```

Si l'agence doit etre lue dans une source precise :

```ts
@AgencyRoles(AgencyRole.EDITOR, {
  agencyIdSource: 'params',
  agencyIdKey: 'agencyId',
})
```

Si la route ne recoit qu'un `membershipId`, comme `PATCH /members/:id/role` :

```ts
@Patch(':id/role')
@AgencyRoles(AgencyRole.OWNER, { membershipIdParam: 'id' })
updateRole(@Param('id') membershipId: string) {
  return this.agenciesService.updateMemberRole(membershipId);
}
```

## Regle d'equipe

Mettre les autorisations dans les controllers avec `@AgencyRoles`.
Garder dans les services uniquement la logique metier :

- creation d'entites ;
- validation supplementaire ;
- regles comme "ne pas supprimer le dernier OWNER".

Pour les futurs modules, importer `AgenciesModule` si le module a besoin de
`AgencyRolesGuard` ou `AgenciesService`.
