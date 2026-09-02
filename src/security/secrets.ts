export interface SecretManager{get(name:string):Promise<string>}
export class EnvironmentSecretManager implements SecretManager{async get(name:string){const v=process.env[name];if(!v)throw new Error(`Missing secret: ${name}`);return v}}
export class GoogleSecretManager implements SecretManager{async get(_name:string):Promise<string>{throw new Error('Google Secret Manager adapter requires explicit production configuration')}}
