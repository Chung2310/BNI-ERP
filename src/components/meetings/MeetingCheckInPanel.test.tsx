// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MeetingCheckInPanel } from "./MeetingCheckInPanel";
vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,qr" } }));
const expiry = "2099-01-01T00:00:00Z";
const meeting = { _id: "a", title: "Buổi A", status: "live", latitude: 10, longitude: 106, checkInQrExpiresAt: expiry, speakers: [] };
const props = { canManage: true, api: vi.fn(), onRefresh: async () => {}, onConfigure: vi.fn(), onOperate: vi.fn() };
afterEach(() => { cleanup(); sessionStorage.clear(); });
it("keeps the QR visible during live and paused meetings but hides a revoked QR", async () => {
  sessionStorage.setItem("meeting-qr:a", JSON.stringify({ url: "https://example.com/meeting-checkin/token-a", expiresAt: expiry }));
  const view = render(<MeetingCheckInPanel {...props} key="a" meeting={meeting} />);
  await screen.findByAltText("QR check-in Buổi A");
  view.rerender(<MeetingCheckInPanel {...props} key="a" meeting={{ ...meeting, status:"paused" }} />);
  expect(screen.getByAltText("QR check-in Buổi A")).toBeTruthy();
  view.rerender(<MeetingCheckInPanel {...props} key="a" meeting={{ ...meeting, checkInQrExpiresAt:undefined }} />);
  expect(screen.queryByAltText("QR check-in Buổi A")).toBeNull();
});
it("does not display the previous meeting QR when another meeting is opened", async () => {
  sessionStorage.setItem("meeting-qr:a", JSON.stringify({ url: "https://example.com/meeting-checkin/token-a", expiresAt: expiry }));
  const view = render(<MeetingCheckInPanel {...props} key="a" meeting={meeting} />);
  await screen.findByAltText("QR check-in Buổi A");
  view.rerender(<MeetingCheckInPanel {...props} key="b" meeting={{ ...meeting, _id:"b", title:"Buổi B" }} />);
  expect(screen.queryByAltText("QR check-in Buổi A")).toBeNull();
  expect(screen.queryByRole("link", {name:"Mở trang check-in"})).toBeNull();
});
