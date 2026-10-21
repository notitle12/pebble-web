import test from "node:test";
import assert from "node:assert/strict";
import {loginDestination,memberActionDestination} from "../src/features/auth/login-destination.ts";
test("login return accepts known local destinations and rejects external or unrecognized paths",()=>{
 for(const path of ["/me/blog","/me/posts","/posts/new","/posts","/search"])assert.equal(loginDestination(path),path);
 for(const path of [null,"//evil.example","https://evil.example","/me/blog?next=https://evil.example","/auth/naver/callback","/admin","javascript:alert(1)"])assert.equal(loginDestination(path),"/me/posts");
});

test("댓글 로그인은 유효한 공개 상세로만 돌아간다",()=>{
 for(const path of ["/projects/910000000000003001","/blogs/local-preview/posts/27","/blogs/local-preview/posts/test-record"])assert.equal(loginDestination(path),path);
 for(const path of ["/projects/9223372036854775808","/projects/01","/blogs/local-preview/posts/search","/blogs/local-preview/posts/../admin","/blogs/local-preview/posts/27?next=//evil.example","/blogs/local-preview/posts/%2f%2fevil.example","/projects/1#bad"])assert.equal(loginDestination(path),"/me/posts");
});

test("프로젝트 작성과 관리의 로그인 복귀 경로를 제한한다",()=>{
 for(const path of ["/me/projects","/projects/new","/projects/123/edit"])assert.equal(loginDestination(path),path);
 for(const path of ["/projects/01/edit","/projects/123/edit?next=//evil.example","/projects/123/../../admin"])assert.equal(loginDestination(path),"/me/posts");
});

test("작성 목적지는 로그인 뒤 동의·프로필 단계를 거쳐 보존하며 외부 주소는 거절한다",()=>{
 assert.equal(memberActionDestination('/posts/new',{agreementsAccepted:true,profileCompleted:true}),'/posts/new');
 assert.equal(memberActionDestination('/projects/new',{agreementsAccepted:false,profileCompleted:false}),'/agreements?returnTo=%2Fprojects%2Fnew');
 assert.equal(memberActionDestination('/projects/new',{agreementsAccepted:true,profileCompleted:false}),'/settings/profile?returnTo=%2Fprojects%2Fnew');
 assert.equal(memberActionDestination('https://evil.example',{agreementsAccepted:true,profileCompleted:true}),'/me/posts');
});


test("내 블로그는 완료된 프로필의 공개 주소로 바로 이동한다",()=>{
 const member={agreementsAccepted:true,profileCompleted:true,handle:"owner-test"};
 assert.equal(memberActionDestination("/me/blog",member),"/blogs/owner-test");
 assert.equal(memberActionDestination("/me/blog",{...member,handle:null}),"/me/blog");
 assert.equal(memberActionDestination("/me/blog",{...member,handle:"//evil.example"}),"/me/blog");
 assert.equal(memberActionDestination("/me/blog",{...member,agreementsAccepted:false}),"/agreements?returnTo=%2Fme%2Fblog");
 assert.equal(memberActionDestination("/me/blog",{...member,profileCompleted:false}),"/settings/profile?returnTo=%2Fme%2Fblog");
});
test("설정 페이지의 재로그인은 원래 설정 경로를 보존한다",()=>{
 for(const path of ["/settings/account","/settings/blog","/settings/profile","/me/boards","/agreements"])assert.equal(loginDestination(path),path);
 assert.equal(loginDestination("/settings/account?token=secret"),"/me/posts");
});

test("작성·비공개 보기와 블로그 하위 설정의 로그인 복귀 경로를 보존한다",()=>{
 for(const path of ["/posts/123/edit","/posts/123/view","/settings/blog/home","/settings/blog/links","/settings/blog/stones"])assert.equal(loginDestination(path),path);
 for(const path of ["/posts/01/edit","/posts/9223372036854775808/edit","/posts/123/edit?next=//evil.example","/settings/blog/unknown"])assert.equal(loginDestination(path),"/me/posts");
});
