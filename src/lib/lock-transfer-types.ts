export type LockTransfer = {
  id: string;
  status: string;
  source_sub_id: string;
  source_device_id: string;
  target_sub_id: string | null;
  target_device_id: string | null;
  created_at: string;
  expires_at: string;
  requested_at: string | null;
  decided_at: string | null;
  source_username: string | null;
  source_device_name: string | null;
  target_username: string | null;
  target_device_name: string | null;
};

export type LockTransferEvent = {
  id: string;
  transfer_id: string;
  event_type: string;
  actor: string;
  created_at: string;
};

export type LockTransferSource = {
  id: string;
  sub_id: string;
  device_name: string | null;
  username: string | null;
};

export type LockTransferHistory = {
  transfers: LockTransfer[];
  events: LockTransferEvent[];
  eligibleSources: LockTransferSource[];
};
