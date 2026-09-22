export type BeautyDocsChatSenderType = "CONSUMER" | "SALON" | "SYSTEM";

export type BeautyDocsChatMessageKind =
  | "TEXT"
  | "ATTACHMENT"
  | "VISIT_CREATED"
  | "VISIT_RESCHEDULED"
  | "VISIT_CANCELLED"
  | "VISIT_REMINDER";

export interface BeautyDocsChatAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface BeautyDocsChatMessage {
  readonly id: string;
  readonly senderType: BeautyDocsChatSenderType;
  readonly senderName: string;
  readonly kind: BeautyDocsChatMessageKind;
  readonly body: string;
  readonly createdAt: string;
  readonly attachments: readonly BeautyDocsChatAttachment[];
}

export interface BeautyDocsChatConversation {
  readonly id: string;
  readonly tenantSlug: string;
  readonly salonName: string;
  readonly consumerName: string;
  readonly practitionerId: string | null;
  readonly practitionerName: string | null;
  readonly practitionerJobTitle: string | null;
  readonly lastMessageBody: string | null;
  readonly lastMessageSenderType: BeautyDocsChatSenderType | null;
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
}

export interface BeautyDocsChatConversationList {
  readonly items: readonly BeautyDocsChatConversation[];
  readonly unreadCount: number;
}

export interface BeautyDocsChatConversationDetail
  extends BeautyDocsChatConversation {
  readonly messages: readonly BeautyDocsChatMessage[];
}
