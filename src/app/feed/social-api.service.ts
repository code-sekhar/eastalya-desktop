import {inject,Injectable} from '@angular/core';
import {AuthSession} from '../core/auth/auth-session.service';
import {PostPage,PostVisibility,SocialPost} from './social.contracts';
@Injectable({providedIn:'root'})
export class SocialApi {
 private readonly session=inject(AuthSession);
 page(mine=false,cursor:string|null=null){return this.session.social<PostPage>('GET',`${mine?'posts/mine':'feed/home'}?limit=20${cursor?'&cursor='+encodeURIComponent(cursor):''}`);}
 create(content:string,visibility:PostVisibility){return this.session.social<SocialPost>('POST','posts',{content,visibility});}
 edit(post:SocialPost,content:string,visibility:PostVisibility){return this.session.social<SocialPost>('PATCH','posts/'+encodeURIComponent(post.id),{content,visibility,expectedRevision:post.revision});}
 remove(post:SocialPost){return this.session.social<{id:string;revision:number;deletedAt:string}>('DELETE','posts/'+encodeURIComponent(post.id),{expectedRevision:post.revision});}
}
