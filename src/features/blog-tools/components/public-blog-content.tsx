import {Suspense} from 'react';
import {LoadingIndicator} from '@/components/loading-state';
import {BlogSidebar} from './blog-sidebar';
import {BlogVisitCount} from './blog-visit-count';
import {PublicBlogLinks} from './public-blog-links';
import {BlogOwnerActions} from '../../auth/components/blog-owner-actions';
import {BlogHomeView,BlogHomeProjects} from '../../blog-home/components/blog-home-view';
import {BlogPosts} from '../../post/components/blog-posts';
import type {BlogPageData} from '../api/blog-page';

type SidebarProps={handle:string;homeView:boolean;projectView:boolean;boardView:boolean;searched:boolean;selected?:string};

export function BlogSidebarLoading(){
  return <aside className="personal-blog-profile" aria-label="블로그 탐색" aria-busy="true"><LoadingIndicator label="블로그 메뉴를 불러오는 중"/></aside>;
}

export async function PublicBlogSidebar({data,...props}:SidebarProps&{data:BlogPageData['sidebar']}){
  const sidebar=await data;
  return <BlogSidebar {...props} visitors={<BlogVisitCount handle={props.handle}/>} footer={<BlogOwnerActions handle={props.handle}/>}
    links={<PublicBlogLinks links={sidebar.links} failed={sidebar.linksError}/>}
    boards={sidebar.boards} projects={sidebar.sidebarProjects?.content.slice(0,5)??[]}
    boardError={sidebar.boardError} projectError={sidebar.projectError}/>;
}

type HomeData=NonNullable<Awaited<BlogPageData['home']>>;
async function HomePosts({data,handle,authorId}:{data:HomeData['posts'];handle:string;authorId:string}){
  const {posts,failed}=await data;
  return <BlogPosts initial={posts} failed={failed} handle={handle} authorId={authorId} variant="popular"/>;
}
async function HomeProjects({data,configured}:{data:HomeData['projects'];configured:boolean}){
  const {projects,errors}=await data;
  return <><BlogHomeProjects projects={projects} configured={configured} failed={errors>0}/>
    {errors>0&&projects.length>0&&<p className="blog-home-empty" role="alert">일부 대표 프로젝트를 불러오지 못했어요.</p>}</>;
}

export async function PublicBlogHomeContent({data,handle,authorId}:{data:BlogPageData['home'];handle:string;authorId:string}){
  const home=await data;
  if(!home)return <div className="blog-home-failure"><h2>블로그 홈을 불러올 수 없어요</h2><p role="alert">활동과 홈 구성을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p><a href={`/blogs/${encodeURIComponent(handle)}`}>다시 시도</a></div>;
  const configured=home.settings.featuredProjectIds.length>0;
  return <BlogHomeView handle={handle} settings={home.settings} activity={home.settings.activity}
    postsContent={<Suspense fallback={<LoadingIndicator label="인기 글을 불러오는 중"/>}><HomePosts data={home.posts} handle={handle} authorId={authorId}/></Suspense>}
    projectsContent={<Suspense fallback={<LoadingIndicator label="대표 프로젝트를 불러오는 중"/>}><HomeProjects data={home.projects} configured={configured}/></Suspense>}/>;
}
