import {projectOrderPreviewPosts} from "../api/project-post-order";
import type {ProjectOrderPreviewState} from "./project-post-order";
import s from "./project-post-order-preview.module.css";
export function ProjectPostOrderPreview({state}:{state:ProjectOrderPreviewState}){
  const posts=projectOrderPreviewPosts(state.posts??[]);
  return <section className="related-posts" aria-label="관련 게시글 순서 미리보기"><h2>관련 게시글</h2>
    {state.loading?<p role="status">관련 게시글을 불러오고 있어요.</p>:state.posts===null?<p role="alert">{state.error||"관련 게시글을 불러오지 못했어요."}</p>:posts.length?<ol className={s.list}>{posts.map((post,index)=><li key={post.id}><span className={s.number}>{index+1}</span><span>{post.title}</span></li>)}</ol>:<p>아직 연결된 공개 글이 없어요.</p>}
  </section>;
}
