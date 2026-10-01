export type SupportedModelName =
  | "users"
  | "hr-leave-templates"
  | "hr-leave-applications"
  | "timekeeping-logs";

export interface ICRUDQueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  filters?: Record<string, any>;
}
