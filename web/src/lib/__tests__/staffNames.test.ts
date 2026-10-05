import { describe, it, expect } from "vitest";
import { staffName, staffContact } from "../staffNames";
describe("staff-facing identity labels", () => {
  it("uses the recorded name and trims whitespace", () => {
    expect(staffName({ nickname: "  林小明  " })).toBe("林小明");
  });
  it("never substitutes an account identifier for a missing name", () => {
    expect(staffName({ nickname: null })).toBe("Name not added");
    expect(staffName({ nickname: "  " })).toBe("Name not added");
  });
  it("uses contacts to distinguish names with nullable phone accounts", () => {
    expect(staffContact({ email: "one@example.com", phone_number: null })).toBe(
      "one@example.com",
    );
    expect(staffContact({ phone_number: "0400123456" })).toBe("0400123456");
    expect(staffContact({})).toBe("Contact not added");
  });
});
