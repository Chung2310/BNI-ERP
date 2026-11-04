import type { ReactNode } from "react";

export type IllustrationKind = "invite" | "sponsor" | "member" | "ticket" | "booth" | "frame" | "diamond" | "gold" | "silver" | "bronze";

const tierColors: Partial<Record<IllustrationKind, { fill: string; light: string }>> = {
  diamond: { fill: "#43bddd", light: "#d9f5fb" },
  gold: { fill: "#d7a42d", light: "#fff1c8" },
  silver: { fill: "#8a9caf", light: "#e7edf3" },
  bronze: { fill: "#ba7852", light: "#f7e7dc" },
};

export function CampaignIllustration({ kind, className = "h-12 w-12" }: { kind: IllustrationKind; className?: string }) {
  const tier = tierColors[kind];
  if (tier) {
    return <svg aria-hidden="true" viewBox="0 0 64 64" className={className} fill="none"><circle cx="32" cy="32" r="29" fill={tier.light} /><path d="M21 11h8l4 13h-8zM35 11h8l-4 13h-8z" fill={tier.fill} opacity=".8" /><circle cx="32" cy="36" r="17" fill={tier.fill} /><circle cx="32" cy="36" r="12" fill="white" opacity=".82" /><path d="m32 27 2.5 5 5.5.8-4 3.9.9 5.4-4.9-2.6-4.9 2.6.9-5.4-4-3.9 5.5-.8z" fill={tier.fill} /></svg>;
  }

  const art: Partial<Record<IllustrationKind, ReactNode>> = {
    invite: <><rect x="6" y="7" width="52" height="50" rx="14" fill="#fff0f2" /><path d="M13 23h38v26H13z" fill="#b4082d" /><path d="m13 23 19 16 19-16" fill="#ef7990" /><path d="M22 15h20v17H22z" fill="white" /><path d="M26 21h12M26 26h9" stroke="#8b9bab" strokeWidth="2" strokeLinecap="round" /><circle cx="44" cy="43" r="7" fill="#00adfc" /></>,
    sponsor: <><rect x="6" y="7" width="52" height="50" rx="14" fill="#e9f8ff" /><path d="M19 18h26l-4 11H23z" fill="#b4082d" /><path d="m23 29 9 20 9-20" fill="#ee7b90" /><path d="m26 29 6 20 6-20" fill="#b4082d" /><path d="m19 18 13 11 13-11" fill="#ffb7c4" /><path d="M27 14h10" stroke="#00adfc" strokeWidth="3" strokeLinecap="round" /></>,
    member: <><rect x="6" y="7" width="52" height="50" rx="14" fill="#fff0f2" /><circle cx="32" cy="23" r="8" fill="#b4082d" /><circle cx="17" cy="29" r="6" fill="#ee879b" /><circle cx="47" cy="29" r="6" fill="#00adfc" /><path d="M18 49c1-9 6-14 14-14s13 5 14 14" fill="#b4082d" /><path d="M9 49c0-6 3-10 8-11M55 49c0-6-3-10-8-11" stroke="#a9b4c4" strokeWidth="4" strokeLinecap="round" /></>,
    ticket: <><rect x="5" y="8" width="54" height="48" rx="14" fill="#e9f8ff" /><path d="M12 23h40v18H12a5 5 0 0 0 0-5 5 5 0 0 0 0-8z" fill="#b4082d" /><path d="M36 23v18" stroke="white" strokeWidth="2" strokeDasharray="3 3" /><path d="M20 30h9M20 35h7" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="45" cy="32" r="4" fill="#00adfc" /></>,
    booth: <><rect x="6" y="7" width="52" height="50" rx="14" fill="#e9f8ff" /><path d="M13 24h38l-4-9H17z" fill="#b4082d" /><path d="M13 24c0 5 7 5 7 0 0 5 8 5 8 0 0 5 8 5 8 0 0 5 8 5 8 0 0 5 7 5 7 0" fill="#f3a6b5" /><path d="M18 31v18h28V31" stroke="#b4082d" strokeWidth="3" /><path d="M24 49V37h16v12" fill="#00adfc" /><path d="M19 51h26" stroke="#8b9bab" strokeWidth="3" strokeLinecap="round" /></>,
    frame: <><rect x="6" y="7" width="52" height="50" rx="14" fill="#fff0f2" /><rect x="15" y="14" width="34" height="36" rx="5" fill="#00adfc" /><rect x="20" y="19" width="24" height="26" rx="3" fill="white" /><circle cx="32" cy="28" r="5" fill="#b4082d" /><path d="M23 42c1-6 4-9 9-9s8 3 9 9" fill="#ee879b" /><path d="M45 13h6v6" stroke="#b4082d" strokeWidth="3" strokeLinecap="round" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 64 64" className={className} fill="none">{art[kind]}</svg>;
}

