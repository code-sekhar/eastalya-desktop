export interface MessageResponse { message: string }
export interface TokenPair extends MessageResponse { accessToken: string; refreshToken: string }
export interface AstrologyInputs { revision: number; birthDate: string; birthTimeKnown: boolean; birthTimeMinutes: number | null; birthPlace: string | null; timezone: string | null; consentAt: string | null; consentWithdrawnAt: string | null; visibility: 'PRIVATE'; }
export interface ProfileFields { displayName: string; bio: string | null; avatarUrl: string | null; revision: number; visibility: 'PRIVATE' | 'PUBLIC'; }
export interface Account { id: string; email: string; username: string; emailVerified?: boolean; profile?: ProfileFields | null; astrologyProfile?: AstrologyInputs | null; completeness?: {completed:number;total:number} }
export interface LoginResponse extends TokenPair { user: Account }
export interface Registration { email: string; username: string; displayName: string; password: string }
export type FailureKind = 'credentials' | 'validation' | 'rate' | 'unavailable' | 'network' | 'expired' | 'uncertain' | 'protocol' | 'conflict' | 'permission';
export class AuthFailure extends Error { constructor(readonly kind: FailureKind) { super(kind); } }
