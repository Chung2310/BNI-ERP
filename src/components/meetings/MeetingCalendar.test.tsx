// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MeetingCalendar } from "./MeetingCalendar";
beforeEach(() => {
 Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
 Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const meeting = { _id:"one",title:"Họp tuần",startsAt:"2030-01-01T17:30:00Z",status:"scheduled",__v:0,seriesId:"series" };
const props = () => ({ month:"2030-01",onMonthChange:vi.fn(),revision:0,load:vi.fn().mockResolvedValue([meeting]),canManage:true,onOpen:vi.fn(),onReschedule:vi.fn(),onCancel:vi.fn(),onDelete:vi.fn(),filter:()=>true });
it("loads the chosen month and uses Vietnam dates and times", async () => {
 const p=props();render(<MeetingCalendar {...p}/>);
 expect(await screen.findByText("00:30 · Họp tuần")).toBeTruthy();
 expect(p.load).toHaveBeenCalledWith("?month=2030-01");
 fireEvent.click(screen.getByRole("button",{name:"Tháng sau"}));expect(p.onMonthChange).toHaveBeenCalledWith("2030-02");
 fireEvent.click(document.querySelector('[data-calendar-day="2030-01-02"]')!);
 expect(p.onOpen).toHaveBeenCalledWith(meeting);
 expect(screen.queryByRole("dialog",{name:"Lịch ngày 02/01/2030"})).toBeNull();
 p.onOpen.mockClear();
 fireEvent.click(screen.getByRole("button",{name:"Xem lịch ngày 02/01/2030"}));
 expect(p.onOpen).toHaveBeenCalledWith(meeting);
});
it("shows cancelled occurrences and hides management actions from members", async () => {
 const p=props();p.load.mockResolvedValue([{...meeting,status:"cancelled"}]);
 render(<MeetingCalendar {...p} canManage={false}/>);
 await screen.findByText("Đã hủy · 00:30 · Họp tuần");
 fireEvent.click(screen.getByRole("button",{name:"Xem lịch ngày 02/01/2030"}));
 expect(p.onOpen).toHaveBeenCalledWith({...meeting,status:"cancelled"});
 expect(screen.queryByRole("dialog")).toBeNull();expect(screen.queryByRole("button",{name:"Hủy"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Dời lịch"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Xóa cuộc họp"})).toBeNull();
});

it("keeps all 31 days in a six-week month and exposes every meeting through the day dialog", async () => {
 const p=props();
 const meetings=Array.from({length:5},(_,index)=>({...meeting,_id:`meeting-${index}`,title:`Buổi ${index+1}`,startsAt:`2026-08-31T0${index}:00:00Z`}));
 p.load.mockResolvedValue([...meetings].reverse());
 render(<MeetingCalendar {...p} month="2026-08"/>);
 await screen.findByText("07:00 · Buổi 1");
 expect(screen.getAllByRole("button",{name:/^Xem lịch ngày/})).toHaveLength(31);
 expect(screen.queryByRole("button",{name:"11:00 · Buổi 5"})).toBeNull();
 fireEvent.click(document.querySelector('[data-calendar-day="2026-08-31"]')!);
 const dialog=screen.getByRole("dialog",{name:"Lịch ngày 31/08/2026"});
 expect(within(dialog).getAllByRole("button",{name:/Buổi \d/})).toHaveLength(5);
 fireEvent.click(within(dialog).getByRole("button",{name:/11:00 · Buổi 5/}));
 expect(p.onOpen).toHaveBeenCalledWith(meetings[4]);
 expect(screen.queryByRole("dialog")).toBeNull();
});
it("supports empty months and retries failed loads", async () => {
 const p=props();p.load.mockRejectedValueOnce(new Error("Lỗi tải lịch")).mockResolvedValue([]);
 render(<MeetingCalendar {...p}/>);expect(await screen.findByRole("alert")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Thử lại"}));await waitFor(()=>expect(screen.queryByRole("alert")).toBeNull());
 expect(await screen.findByText(/0 buổi/)).toBeTruthy();
});
