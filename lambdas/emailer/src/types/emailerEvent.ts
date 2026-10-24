export interface EmailerEvent {
  email: string;
  messageObject: {
    bucket: string;
    object: string;
  };
  eventIdentifier?: string;
  token?: string;
}
