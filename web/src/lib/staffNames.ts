/** Prefer the nickname, then the registered username. */
export function staffName(user: { nickname?: string | null; username?: string | null }) {
  return user.nickname?.trim() || user.username?.trim() || "Name not added";
}
export function staffContact(user: {
  email?: string | null;
  phone_number?: string | null;
}) {
  return user.email?.trim() || user.phone_number?.trim() || "Contact not added";
}
