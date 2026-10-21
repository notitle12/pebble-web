import type {PublicBlogProfile} from '../../post/api/public-blog';
import {safeMediaUrl} from '../../media/model';
import {BlogMenuIcon} from './blog-menu-icon';

export function BlogProfileHeader({profile,query}:{profile:PublicBlogProfile;query?:string}){
 const photo=safeMediaUrl(profile.profileImageUrl);
 return <header className="blog-profile-header">
  <div className="blog-profile-heading">
   {photo?<img className="blog-profile-avatar" src={photo} alt={`${profile.nickname} 프로필 사진`} width={72} height={72}/>:<span className="blog-profile-avatar blog-avatar-fallback" aria-hidden="true">{Array.from(profile.nickname)[0]}</span>}
   <div><h1>{profile.blogName}</h1><p>{profile.nickname}<span aria-hidden="true"> · </span><span className="personal-blog-handle">@{profile.handle}</span></p></div>
  </div>
  <div className="blog-profile-tools">
   <form className="blog-header-search" action={`/blogs/${encodeURIComponent(profile.handle)}`} method="get" role="search" aria-label="이 블로그에서 검색"><label className="sr-only" htmlFor="blog-search">이 블로그에서 검색</label><div><input key={query??''} id="blog-search" name="q" type="search" maxLength={200} defaultValue={query??''} placeholder="이 블로그에서 검색"/><button type="submit" aria-label="블로그 검색"><BlogMenuIcon name="search"/></button></div></form>
  </div>
 </header>;
}
