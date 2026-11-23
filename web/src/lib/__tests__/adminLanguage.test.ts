import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AddClassMembersByName } from "@/components/admin/AddClassMembersByName";
import { useAdminText } from "@/components/admin/adminCopy";
import type { AppLanguage } from "@/lib/language";

const preference = vi.hoisted(() => ({ language: "en" as AppLanguage }));
vi.mock("@/components/account/LanguagePreferenceProvider", () => ({
  useAppLanguage: () => preference.language,
}));
afterEach(() => { preference.language = "en"; });

it("switches the admin form labels while keeping the values submitted to the API", () => {
  const form = createElement(AddClassMembersByName, { classId: "sample", members: [], onAdded: async () => {} });
  expect(renderToStaticMarkup(form)).toContain('aria-label="Member role"');
  preference.language = "zh-CN";
  const html = renderToStaticMarkup(form);
  expect(html).toContain('aria-label="成员角色"');
  expect(html).toContain('value="student" selected="">学员');
  expect(html).toContain('value="coach">教练');
  expect(html).toContain('placeholder="姓名、邮箱或电话"');
});

it("keeps authored content verbatim when interpolating a translated admin message", () => {
  preference.language = "zh-CN";
  function Message() {
    const t = useAdminText();
    return createElement("span", null, t("Created template {0}.", "Templates"));
  }
  expect(renderToStaticMarkup(createElement(Message))).toContain("已创建模板「Templates」。");
});
