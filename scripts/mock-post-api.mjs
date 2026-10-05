import http from "node:http";

const samples = [
  ["Spring Security 인증 흐름을 정리하며 배운 것들", "필터 체인부터 예외 처리까지, 인증과 인가의 책임을 나눈 과정을 기록합니다.", "수민", ["Spring", "Java"]],
  ["SSR 페이지에서 API 오류와 빈 목록을 구분하기", "조회 실패를 빈 목록으로 숨기지 않고, 로딩과 재시도까지 함께 설계했습니다.", "지우", ["Next.js", "TypeScript"]],
  ["Oracle Cloud에 백엔드를 배포한 기록", "애플리케이션 실행 환경과 HTTPS, 배포 후 확인해야 할 항목을 정리했습니다.", "민준", ["Oracle Cloud", "Docker"]],
  ["R2 이미지 업로드와 만료되는 URL 다루기", "스토리지의 파일과 데이터베이스 참조의 수명이 다른 상황을 살펴봅니다.", "서연", ["Cloudflare", "R2"]],
  ["긴 한글 제목과 아주긴태그이름이 모바일 목록에서도 자연스럽게 줄바꿈되는지 확인하는 개발 기록", "작은 화면에서 제목과 태그가 잘리지 않는지 확인하는 미리보기용 글입니다.", "긴닉네임을사용하는개발자", ["접근성", "아주긴태그이름을사용한반응형검증"]],
  ["처음 작성하는 개발 기록", null, "도윤", []],
];
const tagNames = [...new Set(samples.flatMap(sample => sample[3]))];
export const mockTags = tagNames.map((name, index) => ({ id: String(index + 1), name, slug: `tag-${index + 1}`, displayOrder: index, status: "ACTIVE" }));
export const mockCategories=[
  {id:"101",parentId:null,name:"Backend",slug:"backend",displayOrder:0,status:"ACTIVE",children:[{id:"102",parentId:"101",name:"Spring",slug:"spring",displayOrder:0,status:"ACTIVE",children:[]}]},
  {id:"201",parentId:null,name:"Frontend",slug:"frontend",displayOrder:1,status:"ACTIVE",children:[{id:"202",parentId:"201",name:"React와 아주긴이름의반응형화면분류",slug:"react",displayOrder:0,status:"ACTIVE",children:[]}]},
  {id:"301",parentId:null,name:"운영 기록",slug:"operations",displayOrder:2,status:"INACTIVE",children:[{id:"302",parentId:"301",name:"Cloudflare",slug:"cloudflare",displayOrder:0,status:"ACTIVE",children:[]}]}
];
export const mockPosts = Array.from({ length: 21 }, (_, index) => {
  const [title, summary, nickname, names] = samples[index % samples.length];
  return {
    id: String(721389012345678901n + BigInt(index)), urlKey: `note-${index + 1}`, title: index < 6 ? title : `${title} (${index + 1})`, summary,
    author: { id: String(721389012345679000n + BigInt(index % samples.length)), handle: `writer-${index % samples.length + 1}`, nickname, blogName: null },
    category:{id:["102","202","302"][index%3],name:["Spring","React","Cloudflare"][index%3]},
    tags: names.map(name => ({ id: mockTags.find(tag => tag.name === name).id, name })),
    likeCount: 0, likedByMe: false,
    publishedAt: index === 5 ? null : new Date(Date.UTC(2026, 9, 3 - index, 3)).toISOString(),
    createdAt: new Date(Date.UTC(2026, 9, 3 - index, 3)).toISOString(),
  };
});

export const mockProjects = Array.from({length:21},(_,i)=>({
  id:String(721389012345680000n+BigInt(i)),owner:{id:"721389012345679000",nickname:["수민","지우","민준"][i%3]},
  name:["Pebble 개발 기록 플랫폼","작은 팀을 위한 일정 관리","R2 이미지 아카이브"][i%3]+(i>2 ? ` (${i+1})` : ""),
  summary:["개발자의 글과 프로젝트를 한곳에 모아 공유하는 서비스입니다.","함께 작업할 때 필요한 일정과 기록을 간결하게 정리했습니다.","이미지를 저장하고 만료되는 URL을 안전하게 관리합니다."][i%3],
  likeCount:0,likedByMe:false,description:"목 프로젝트 상세 소개",lifecycleStatus:i%2 ? "COMPLETED" : "IN_PROGRESS",
  tags:[mockTags[i%mockTags.length]],publishedAt:new Date(Date.UTC(2026,9,3-i,3)).toISOString(),createdAt:new Date(Date.UTC(2026,9,3-i,3)).toISOString()
}));

export function createMockApi(state = "normal") {
  if (!["normal", "empty", "error", "slow"].includes(state)) throw new Error("지원 상태: normal, empty, error, slow");
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    const detail = url.pathname.match(/^\/api\/v1\/blogs\/([^/]+)\/posts\/([^/]+)$/);
    const numericPost = url.pathname.match(/^\/api\/v1\/posts\/([1-9]\d*)$/);
    const projectDetail=url.pathname.match(/^\/api\/v1\/projects\/([1-9]\d*)(\/posts)?$/);
    if (request.method !== "GET" || (!projectDetail && !detail && !numericPost && !["/api/v1/posts", "/api/v1/posts/search", "/api/v1/tags", "/api/v1/categories", "/api/v1/projects", "/api/v1/projects/search"].includes(url.pathname))) {
      response.writeHead(404); response.end(JSON.stringify({ error: { code: "NOT_FOUND" } })); return;
    }
    if (state === "slow") await new Promise(resolve => setTimeout(resolve, 2500));
    if (state === "error") {
      response.writeHead(503); response.end(JSON.stringify({ error: { code: "INTERNAL_ERROR" } })); return;
    }
    if (projectDetail) {
      const project=state === "empty" ? undefined : mockProjects.find(project=>project.id===projectDetail[1]);
      if(!project){response.writeHead(404);response.end(JSON.stringify({error:{code:"PROJECT_NOT_FOUND"}}));return;}
      if(projectDetail[2]){
        const page=Number(url.searchParams.get("page")??0);const posts=project.id===mockProjects[0].id ? mockPosts : [];const totalPages=Math.ceil(posts.length/20);
        response.end(JSON.stringify({data:{content:posts.slice(page*20,(page+1)*20),page,size:20,totalElements:posts.length,totalPages,hasNext:page+1<totalPages,hasPrevious:page>0}}));return;
      }
      response.end(JSON.stringify({data:{...project,description:"개발 기록을 글과 프로젝트 단위로 정리하는 서비스입니다.\n\n이 소개는 목 데이터이며 <script>alert('example')</script>도 실행하지 않고 문자로 표시합니다.",
        architectureDescription:"사용자 web → API → 데이터베이스\n파일은 R2에 저장하고 인증은 API에서 처리합니다.",executionInstructions:"저장소를 준비한 뒤 환경변수를 설정합니다.\nNode 22에서 npm install, npm run dev를 실행합니다.",startedOn:"2026-09-01",completedOn:project.lifecycleStatus==="COMPLETED"?"2026-10-01":null,
        features:[{id:"1",title:"개발 기록 정리",description:"태그로 글과 프로젝트를 찾아볼 수 있습니다.",displayOrder:0},{id:"2",title:"공개 프로젝트 소개",description:"진행 상태와 주요 기능을 공유합니다.",displayOrder:1}],
        links:[{id:"1",linkType:"OTHER",label:"예시 링크",url:"https://example.com",displayOrder:0}]
      }}));return;
    }
    if (detail || numericPost) {
      const post = state === "empty" ? undefined : mockPosts.find(post => numericPost ? post.id === numericPost[1] : post.author.handle === detail[1] && post.urlKey === detail[2]);
      if (!post) { response.writeHead(404); response.end(JSON.stringify({error:{code:"POST_NOT_FOUND"}})); return; }
      response.end(JSON.stringify({data:{...post, blocks:[
        {type:"TEXT",content:"작은 문제부터 나누어 살펴보고, 각 단계의 책임을 정리했습니다.\n\n이 본문은 화면 검증을 위한 목 데이터입니다. <script>alert('example')</script>도 텍스트로 표시합니다.",language:null,title:null,displayOrder:0},
        {type:"CODE",content:'public class Pebble {\n    public static void main(String[] args) {\n        System.out.println("긴 코드도 본문 폭을 넘지 않고 코드 영역 안에서 가로로 스크롤할 수 있습니다.");\n    }\n}',language:"JAVA",title:"실행 예제",displayOrder:1},
        {type:"TEXT",content:"검증 결과를 기록하고 다음 개선점을 정리합니다.",language:null,title:null,displayOrder:2}
      ]}})); return;
    }
    if (url.pathname === "/api/v1/tags") { response.end(JSON.stringify({ data: state === "empty" ? [] : mockTags })); return; }
    if (url.pathname === "/api/v1/categories") { response.end(JSON.stringify({data: state === "empty" ? [] : mockCategories})); return; }
    const page = Number(url.searchParams.get("page") ?? "0");
    const size = Number(url.searchParams.get("size") ?? "20");
    if (!Number.isSafeInteger(page) || page < 0 || size !== 20) {
      response.writeHead(400); response.end(JSON.stringify({ error: { code: "INVALID_REQUEST" } })); return;
    }
    const q = url.searchParams.get("q")?.trim().toLocaleLowerCase() ?? "";
    if (url.pathname.endsWith("/search") && !q) { response.writeHead(400); response.end(JSON.stringify({ error: { code: "VALIDATION_ERROR" } })); return; }
    const tagId = url.searchParams.get("tagId");
    if (url.pathname.startsWith("/api/v1/projects")) {
      const lifecycleStatus=url.searchParams.get("lifecycleStatus");
      const projects=(state === "empty" ? [] : mockProjects).filter(project=>
        (!q || [project.name,project.summary,project.description,...project.tags.map(tag=>tag.name)].some(text=>text.toLowerCase().includes(q)))
        && (!tagId || project.tags.some(tag=>tag.id===tagId)) && (!lifecycleStatus || project.lifecycleStatus===lifecycleStatus));
      const totalPages=Math.ceil(projects.length/size);
      const content=projects.slice(page*size,(page+1)*size).map(({description,...project})=>project);
      response.end(JSON.stringify({data:{content,page,size,totalElements:projects.length,totalPages,hasNext:page+1<totalPages,hasPrevious:page>0}}));return;
    }
    const categoryId=url.searchParams.get("categoryId");
    const categoryIds=categoryId ? [categoryId,...(mockCategories.find(category=>category.id===categoryId)?.children.map(child=>child.id)??[])] : [];
    // 목 글은 본문을 갖지 않는다. 제목·태그·연결 분류와 상위 분류를 검색한다.
    const posts = (state === "empty" ? [] : mockPosts).filter(post =>
      (!q || [post.title, ...post.tags.map(tag => tag.name), ...mockCategories.filter(category=>category.id===post.category.id || category.children.some(child=>child.id===post.category.id)).flatMap(category=>[category.name,...category.children.filter(child=>child.id===post.category.id).map(child=>child.name)])].some(text => text.toLocaleLowerCase().includes(q)))
      && (!tagId || post.tags.some(tag => tag.id === tagId)) && (!categoryId || categoryIds.includes(post.category.id)));

    const totalPages = Math.ceil(posts.length / size);
    response.end(JSON.stringify({ data: {
      content: posts.slice(page * size, (page + 1) * size), page, size,
      totalElements: posts.length, totalPages, hasNext: page + 1 < totalPages, hasPrevious: page > 0,
    } }));
  });
}
