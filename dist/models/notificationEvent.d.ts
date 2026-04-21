export interface NotificationEvent {
    event_id: string;
    party_id: string;
    email: string;
    type: 'INVITATION' | 'ASSIGNMENT' | 'REMINDER';
    sent_at: string;
    status: 'SENT' | 'FAILED';
    error_message?: string;
}
//# sourceMappingURL=notificationEvent.d.ts.map