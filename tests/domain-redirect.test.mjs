import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unstable_doesMiddlewareMatch} from 'next/experimental/testing/server.js';
import {NextRequest} from 'next/server.js';
import {proxy,config} from '../src/proxy.ts';
const matches=url=>unstable_doesMiddlewareMatch({url,config,headers:{host:new URL(url).host}});
test('루트 HTTP/HTTPS는 경로와 쿼리를 유지해 HTTPS www로 영구 이동한다',()=>{
 for(const scheme of ['http','https'])for(const path of ['/','/sitemap.xml','/robots.txt','/projects/899907444891119227?tab=db&keyword=a%20b']){
  const url=`${scheme}://pebble-log.com${path}`;assert.ok(matches(url));const r=proxy(new NextRequest(url));assert.equal(r.status,308);
  assert.equal(r.headers.get('location'),'https://www.pebble-log.com'+path);
 }
});
test('www, localhost 및 유사 도메인은 공개 페이지 proxy를 실행하지 않는다',()=>{
 for(const host of ['www.pebble-log.com','localhost:3000','api.pebble-log.com','pebble-log.com.evil.example','pebble-logXcom'])assert.equal(matches(`https://${host}/sitemap.xml`),false);
});
test('기존 dev 전용 경로의 운영 차단과 개발 접근을 유지한다',()=>{
 const before=process.env.NODE_ENV;
 try{
  const url='https://www.pebble-log.com/dev/post';assert.ok(matches(url));
  process.env.NODE_ENV='production';assert.equal(proxy(new NextRequest(url)).status,404);
  process.env.NODE_ENV='development';assert.equal(proxy(new NextRequest(url)).headers.get('x-middleware-next'),'1');
 }finally{if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before;}
});
