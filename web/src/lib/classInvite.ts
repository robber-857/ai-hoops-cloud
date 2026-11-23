const classInvitePath = /^\/join\/[A-Za-z0-9_-]{43}$/;

export function getClassInvitePath(path: string | null) {
  return path && classInvitePath.test(path) ? path : null;
}

export function classInviteUrl(token: string) {
  return `/join/${encodeURIComponent(token)}`;
}

export function withClassInvite(href: string, path: string | null) {
  const invitePath = getClassInvitePath(path);
  return invitePath ? `${href}?next=${encodeURIComponent(invitePath)}` : href;
}
