export const ownerSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export const memberUserSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export const workspaceListInclude = {
  owner: { select: ownerSelect },
  members: { include: { user: { select: memberUserSelect } } },
  _count: { select: { projects: true, members: true } },
} as const;

export const workspaceDetailInclude = {
  owner: { select: ownerSelect },
  members: {
    include: { user: { select: memberUserSelect } },
    orderBy: { joinedAt: "asc" as const },
  },
  projects: {
    take: 10,
    orderBy: { updatedAt: "desc" as const },
    include: { _count: { select: { tasks: true } } },
  },
  _count: { select: { projects: true, members: true, labels: true } },
} as const;

export const invitationInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logo: true,
      color: true,
    },
  },
} as const;
