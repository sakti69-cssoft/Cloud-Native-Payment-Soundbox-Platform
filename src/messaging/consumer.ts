export interface PaymentEventConsumer{start(handler:(event:unknown)=>Promise<void>):Promise<void>;stop():Promise<void>}
export class LocalPaymentEventConsumer implements PaymentEventConsumer{async start(_handler:(event:unknown)=>Promise<void>){}async stop(){}}
export class GooglePubSubPaymentEventConsumer implements PaymentEventConsumer{async start(_handler:(event:unknown)=>Promise<void>){throw new Error('Google Pub/Sub adapter is a production scaffold; configure credentials and subscription before use')}async stop(){}}
