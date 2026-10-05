// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingCalendar } from "./MeetingCalendar";
afterEach(cleanup);
const meeting = { _id:"one",title:"Họp tuần",startsAt:"2030-01-01T17:30:00Z",status:"scheduled",__v:0,seriesId:"series" };
const props = () => ({ month:"2030-01",onMonthChange:vi.fn(),revision:0,load:vi.fn().mockResolvedValue([meeting]),canManage:true,onOpen:vi.fn(),onEdit:vi.fn(),onReschedule:vi.fn(),onCancel:vi.fn().mockResolvedValue(undefined),filter:()=>true });
it("loads the chosen month and uses Vietnam dates and times", async () => {
 const p=props();render(<MeetingCalendar {...p}/>);
 expect(await screen.findByText("00:30 · Họp tuần")).toBeTruthy();
 expect(p.load).toHaveBeenCalledWith("?month=2030-01");
 fireEvent.click(screen.getByRole("button",{name:"Tháng sau"}));expect(p.onMonthChange).toHaveBeenCalledWith("2030-02");
 fireEvent.click(screen.getByRole("button",{name:"Sửa cuộc họp"}));expect(p.onEdit).toHaveBeenCalledWith(meeting);fireEvent.click(screen.getByRole("button",{name:"Dời lịch"}));expect(p.onReschedule).toHaveBeenCalledWith(meeting);
 fireEvent.click(screen.getByRole("button",{name:"Hủy buổi"}));expect(p.onCancel).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Hủy buổi họp"}));await waitFor(()=>expect(p.onCancel).toHaveBeenCalledWith(meeting));
});
it("shows cancelled occurrences and hides management actions from members", async () => {
 const p=props();p.load.mockResolvedValue([{...meeting,status:"cancelled"}]);
 render(<MeetingCalendar {...p} canManage={false}/>);
 expect(await screen.findByText(/Đã hủy/)).toBeTruthy();expect(screen.queryByRole("button",{name:"Hủy buổi"})).toBeNull();
 expect(screen.queryByRole("button",{name:"Sửa cuộc họp"})).toBeNull();expect(screen.queryByRole("button",{name:"Dời lịch"})).toBeNull();
});
it("supports empty months and retries failed loads", async () => {
 const p=props();p.load.mockRejectedValueOnce(new Error("Lỗi tải lịch")).mockResolvedValue([]);
 render(<MeetingCalendar {...p}/>);expect(await screen.findByRole("alert")).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Thử lại"}));await waitFor(()=>expect(screen.queryByRole("alert")).toBeNull());
 expect(await screen.findByText(/0 buổi/)).toBeTruthy();
});
