export interface ProfileSlide {
  id: string;
  kind: "member" | "guest";
  name: string;
  company: string;
  photoURL: string;
  coverImage: string;
  phone: string;
  email?: string;
  industry: string;
  bio: string;
  address?: string;
  targetMarket?: string;
  galleryImages?: string[];
}

export interface SlideDeck {
  slides: ProfileSlide[];
  version: number;
}
