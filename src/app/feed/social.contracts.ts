export type PostVisibility='PUBLIC'|'PRIVATE';
export interface SocialPost {id:string;content:string;visibility:PostVisibility;revision:number;createdAt:string;updatedAt:string;author:{id:string;username:string;displayName:string|null};}
export interface PostPage {items:SocialPost[];nextCursor:string|null;}
export function validPostText(value:string){const text=value.trim();return !!text && Array.from(text).length<=3000 && new TextEncoder().encode(text).length<=12000 && !Array.from(text).some(char=>{const n=char.codePointAt(0)!;return (n<32 && ![9,10,13].includes(n)) || (n>=127 && n<=159);});}
