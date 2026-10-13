import { expect, test } from "vitest";
import { chapterDisplayName, chapterNameForCode } from "./chapterDisplayName";

test("replaces only legacy BNI chapter labels", () => {
  expect(chapterDisplayName("BNI Chapter")).toBe("Chapter");
  expect(chapterDisplayName("Chapter BNI")).toBe("Chapter");
  expect(chapterNameForCode("BNI")).toBe("Chapter");
  expect(chapterDisplayName("Chapter Hà Nội")).toBe("Chapter Hà Nội");
});
