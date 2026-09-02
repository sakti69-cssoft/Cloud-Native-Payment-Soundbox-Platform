export const languages=['en','hi','or','bn','ta','te'] as const;
export type Language=typeof languages[number];
export type Merchant={id:string;merchantCode:string;merchantName:string;status:string;createdAt:string;updatedAt:string};
export type Device={id:string;deviceCode:string;merchantId:string;serialNumber:string;language:Language;status:'ACTIVE'|'INACTIVE'|'SUSPENDED'|'OFFLINE';firmwareVersion:string;lastSeenAt:string|null;createdAt:string;updatedAt:string};
export type Transaction={id:string;transactionReference:string;merchantId:string;deviceId:string;amount:number;currency:string;paymentStatus:'PENDING'|'SUCCESS'|'FAILED';announcementStatus:'PENDING'|'PUBLISHED'|'DELIVERED'|'FAILED';createdAt:string};
export type DeviceEvent={id:string;deviceId:string;eventType:string;payload:Record<string,unknown>;createdAt:string};
