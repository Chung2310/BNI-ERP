// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({}) }));
import { extractLuckyWinners, drawSourceLabels, LuckyWinnersTable, meetingAbsentCount, meetingCountsAbsences } from './MeetingStatisticsPanel';
import type { Meeting } from '../../services/meetingService';

it('aggregates all draw sources including legacy results with meeting and prize details', () => {
  const meeting = { _id: 'meeting', title: 'Meeting', startsAt: '2026-10-02T08:00:00Z',
    luckyDraw: { prizes: [{ id: 'prize', name: 'Prize', reward: 'Gift', winners: [{ id: 'old', name: 'Legacy' }] }] },
    gameWinners: [
      { id: 'wheel', name: 'Wheel winner', source: 'wheel', prizeName: 'Wheel prize', wonAt: '2026-10-02T09:00:00Z' },
      { id: 'bingo', name: 'Bingo winner', source: 'bingo', prizeName: 'Bingo prize', ticketNumber: 7 },
    ],
  } as unknown as Meeting;
  const winners = extractLuckyWinners(meeting);
  expect(winners.map(w => drawSourceLabels[w.source])).toEqual(['Bốc thăm', 'Vòng quay may mắn', 'Lồng cầu bingo']);
  expect(winners.every(w => w.meetingId === meeting._id && w.meetingTitle === 'Meeting')).toBe(true);
  expect(winners[0].reward).toBe('Gift');
  expect(winners[1].wonAt).toBe('2026-10-02T09:00:00Z');
  expect(winners[2].ticketNumber).toBe(7);
  expect(extractLuckyWinners({ ...meeting, luckyDraw: undefined, gameWinners: undefined })).toEqual([]);
});

it('paginates winners and keeps row numbers continuous across pages', () => {
  const winners = Array.from({ length: 11 }, (_, index) => ({
    source: 'draw' as const,
    id: `winner-${index + 1}`,
    name: `Winner ${index + 1}`,
    prizeId: 'prize',
    prizeName: 'Prize',
    meetingId: 'meeting',
    meetingTitle: 'Meeting',
    meetingDate: '2026-10-05T08:00:00Z',
  }));

  render(<LuckyWinnersTable winners={winners} />);

  expect(screen.getByText('Winner 1')).toBeTruthy();
  expect(screen.queryByText('Winner 11')).toBeNull();
  expect(screen.getByText('Trang 1/2')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: '2' }));

  expect(screen.queryByText('Winner 1')).toBeNull();
  expect(screen.getByText('Winner 11')).toBeTruthy();
  expect(screen.getByText('11')).toBeTruthy();
  expect(screen.getByText('Trang 2/2')).toBeTruthy();
});

it.each([
  ['scheduled', false, 0],
  ['cancelled', false, 0],
  ['live', true, 8],
  ['paused', true, 8],
  ['ended', true, 8],
] as const)('counts absences only after a meeting has started: %s', (status, eligible, absent) => {
  const meeting = {
    status,
    speakers: [
      { id: 'member-a', userId: 'member-a', name: 'Member A' },
      { id: 'guest', name: 'Guest' },
    ],
  } as unknown as Meeting;

  expect(meetingCountsAbsences(meeting)).toBe(eligible);
  expect(meetingAbsentCount(meeting, 9)).toBe(absent);
});
