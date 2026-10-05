/** Staff-facing names never fall back to account IDs or login identifiers. */
export function staffName(user: { nickname?: string | null }) {
  return user.nickname?.trim() || "Name not added";
}
export function staffContact(user: {
  email?: string | null;
  phone_number?: string | null;
}) {
  return user.email?.trim() || user.phone_number?.trim() || "Contact not added";
}
