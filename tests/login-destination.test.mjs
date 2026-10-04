import test from "node:test";
import assert from "node:assert/strict";
import {loginDestination} from "../src/features/auth/login-destination.ts";
test("login return accepts known local destinations and rejects external or unrecognized paths",()=>{
 for(const path of ["/me/blog","/me/posts","/posts/new"])assert.equal(loginDestination(path),path);
 for(const path of [null,"//evil.example","https://evil.example","/me/blog?next=https://evil.example","/auth/naver/callback","/admin","javascript:alert(1)"])assert.equal(loginDestination(path),"/me/posts");
});
