export type Mode = "sandbox" | "live";

export interface EventVisibility {
  superadmin: boolean;
  business: boolean;
  consumer: boolean;
}

export interface EventEnvelope<TData = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  tenant_id: string;
  mode: Mode;
  resources: Record<string, unknown>;
  data: TData;
  visibility: EventVisibility;
}
