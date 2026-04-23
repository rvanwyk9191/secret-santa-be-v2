export interface EmailerEvent {
  email: string;
  messageObject: {
    bucket: string;
    object: string;
  };
}
