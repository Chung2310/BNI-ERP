// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SpeakerAvatar } from "./SpeakerAvatar";
import { getAvatarInitial, getAvatarColor } from "./speakerAvatarUtils";

describe("SpeakerAvatar", () => {
  afterEach(() => {
    cleanup();
  });

  it("extracts the first letter of a name as initial", () => {
    expect(getAvatarInitial("Chung")).toBe("C");
    expect(getAvatarInitial("An")).toBe("A");
    expect(getAvatarInitial("")).toBe("?");
    expect(getAvatarInitial("   Bình   ")).toBe("B");
  });

  it("returns a deterministic palette for a name", () => {
    const p1 = getAvatarColor("Chung");
    const p2 = getAvatarColor("Chung");
    expect(p1).toEqual(p2);
  });

  it("renders img tag when valid photoURL is provided", () => {
    render(<SpeakerAvatar name="Chung" photoURL="https://example.com/avatar.jpg" />);
    const img = screen.getByAltText("Chung");
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://example.com/avatar.jpg");
  });

  it("falls back to letter avatar when photoURL is empty", () => {
    render(<SpeakerAvatar name="Chung" photoURL="" />);
    expect(screen.queryByAltText("Chung")).toBeNull();
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("falls back to letter avatar when photoURL is 'null' or 'undefined'", () => {
    render(<SpeakerAvatar name="Chi" photoURL="null" />);
    expect(screen.queryByAltText("Chi")).toBeNull();
    expect(screen.getByText("C")).toBeTruthy();
  });

  it("falls back to letter avatar when image loading fails (onError)", () => {
    render(<SpeakerAvatar name="Hoa" photoURL="https://example.com/broken-image.jpg" />);
    const img = screen.getByAltText("Hoa");
    expect(img).toBeTruthy();

    // Trigger onError
    fireEvent.error(img);

    // img should disappear and letter fallback "H" should be rendered
    expect(screen.queryByAltText("Hoa")).toBeNull();
    expect(screen.getByText("H")).toBeTruthy();
  });
});
