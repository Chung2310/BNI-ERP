export type SupportedModelName = "users";

export interface ICRUDQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, unknown>;
}
