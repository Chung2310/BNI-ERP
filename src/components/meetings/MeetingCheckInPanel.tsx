type Meeting = { title: string; status: string; speakers: { userId?: string }[] };
export function MeetingCheckInPanel({ meeting }: { meeting: Meeting }) {
  const open = ["scheduled", "live", "paused"].includes(meeting.status);
  const members = meeting.speakers.filter(person => person.userId).length;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-xl font-bold text-slate-900">Đón tiếp & check-in</h3><p className="mt-1 text-sm text-slate-500">{members} thành viên · {meeting.speakers.length - members} khách mời · thứ tự phát biểu theo check-in</p></div>
    </div>
    {!open && <p className="rounded-xl bg-slate-100 p-4 text-sm">Buổi họp đã đóng check-in.</p>}
  </section>;
}
