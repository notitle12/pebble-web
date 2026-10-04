import test from "node:test";
import assert from "node:assert/strict";
import {loginDestination} from "../src/features/auth/login-destination.ts";
test("login return accepts known local destinations and rejects external or unrecognized paths",()=>{
 for(const path of ["/me/blog","/me/posts","/posts/new"])assert.equal(loginDestination(path),path);
 for(const path of [null,"//evil.example","https://evil.example","/me/blog?next=https://evil.example","/auth/naver/callback","/admin","javascript:alert(1)"])assert.equal(loginDestination(path),"/me/posts");
});

test("댓글 로그인은 유효한 공개 상세로만 돌아간다",()=>{
 for(const path of ["/projects/910000000000003001","/blogs/local-preview/posts/27","/blogs/local-preview/posts/test-record"])assert.equal(loginDestination(path),path);
 for(const path of ["/projects/9223372036854775808","/projects/01","/blogs/local-preview/posts/search","/blogs/local-preview/posts/../admin","/blogs/local-preview/posts/27?next=//evil.example","/blogs/local-preview/posts/%2f%2fevil.example","/projects/1#bad"])assert.equal(loginDestination(path),"/me/posts");
});
