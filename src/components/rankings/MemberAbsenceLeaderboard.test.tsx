// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemberAbsenceLeaderboard } from './MemberAbsenceLeaderboard';
import type { UserProfile } from '../../types/common';
import type { Meeting } from '../../services/meetingService';
afterEach(cleanup);
const members = [{ uid: 'a', displayName: 'Vắng An' }, { uid: 'b', displayName: 'Muộn Bình' }, { uid: 'c', displayName: 'Đúng giờ Chi' }] as UserProfile[];
const meetings = [{ _id: '1', startsAt: '2025-01-01T08:00:00Z', status: 'ended', speakers: [{ userId: 'b', checkedInAt: '2025-01-01T08:10:00Z' }, { userId: 'c', checkedInAt: '2025-01-01T08:00:00Z' }] }] as Meeting[];
it('renders absence ranking and preserves the rank when searching a member', () => {
  render(<MemberAbsenceLeaderboard members={members} meetings={meetings} loading={false} />);
  const rows = screen.getAllByRole('row');
  expect(within(rows[1]).getByText('Vắng An')).toBeTruthy();
  expect(within(rows[2]).getByText('Muộn Bình')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Tìm thành viên trong BXH lười'), { target: { value: 'Bình' } });
  expect(screen.getAllByRole('row')).toHaveLength(2);
  expect(screen.getByText('#2')).toBeTruthy();
  expect(screen.queryByText('Vắng An')).toBeNull();
});
it('shows an empty state when the filter includes only meetings still in progress', () => {
  render(<MemberAbsenceLeaderboard members={members} meetings={[{ ...meetings[0], status: 'live' }]} loading={false} />);
  expect(screen.getByText('Chưa có cuộc họp đã kết thúc trong bộ lọc hiện tại.')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});

it("shows the member empty state for an admin-only roster", () => {
  render(<MemberAbsenceLeaderboard members={[{ uid: "admin", role: "admin", displayName: "Admin" } as UserProfile]} meetings={meetings} loading={false} />);
  expect(screen.getByText("Chưa có dữ liệu thành viên để xếp hạng.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByText("Admin")).toBeNull();
});
