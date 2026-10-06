import { describe, it, expect } from "vitest";
import { staffName, staffContact } from "../staffNames";
import { getStudentDisplayName } from "@/components/coach/coachUtils";
describe("staff-facing identity labels", () => {
  it("uses the recorded name and trims whitespace", () => {
    expect(staffName({ nickname: "  林小明  ", username: "elton" })).toBe("林小明");
  });
  it.each([null, "", "  "])("uses the registered username for nickname %j", (nickname) => {
    expect(staffName({ nickname, username: "elton" })).toBe("elton");
    expect(getStudentDisplayName("elton", nickname)).toBe("elton");
  });
  it("keeps the nickname in coach student labels", () => {
    expect(getStudentDisplayName("elton", "  Elton  ")).toBe("Elton");
  });
  it("uses a placeholder only when both names are missing", () => {
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
