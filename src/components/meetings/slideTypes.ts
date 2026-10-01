export interface ProfileSlide {
  id: string;
  kind: "member" | "guest";
  name: string;
  company: string;
  photoURL: string;
  coverImage: string;
  phone: string;
  industry: string;
  bio: string;
}

export interface SlideDeck {
  slides: ProfileSlide[];
  version: number;
}
