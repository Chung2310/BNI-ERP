// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({}) }));
import { extractLuckyWinners, drawSourceLabels } from './MeetingStatisticsPanel';
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
