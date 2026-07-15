export type NotificationMessageEntity =
  | {
      type: 'url';
      offset: number;
      length: number;
    }
  | {
      type: 'text_link';
      offset: number;
      length: number;
      url: string;
    };

