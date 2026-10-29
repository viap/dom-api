export enum ApplicationMessageDirection {
  Outbound = 'outbound',
  Inbound = 'inbound',
}

export enum ApplicationMessageStatus {
  Pending = 'pending',
  Sending = 'sending',
  Sent = 'sent',
  Failed = 'failed',
  Unknown = 'unknown',
  Received = 'received',
}
