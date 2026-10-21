import assert from 'node:assert/strict';
import {test} from 'node:test';
import {unstable_getResponseFromNextConfig} from 'next/experimental/testing/server.js';
import nextConfig from '../next.config.ts';
const request=url=>unstable_getResponseFromNextConfig({url,nextConfig,headers:{host:new URL(url).host}});
test('루트 HTTP/HTTPS는 경로와 쿼리를 유지해 HTTPS www로 영구 이동한다',async()=>{
 for(const scheme of ['http','https'])for(const path of ['/','/sitemap.xml','/robots.txt','/projects/899907444891119227?tab=db&keyword=a%20b']){
  const r=await request(`${scheme}://pebble-log.com${path}`);assert.equal(r.status,308);
  const location=new URL(r.headers.get('location'));assert.equal(location.origin,'https://www.pebble-log.com');assert.equal(location.pathname,new URL('https://pebble-log.com'+path).pathname);assert.equal(location.searchParams.get('keyword'),path.includes('keyword=')?'a b':null);
 }
});
test('www, localhost 및 유사 도메인은 루트 리디렉션 대상이 아니다',async()=>{
 for(const host of ['www.pebble-log.com','localhost:3000','api.pebble-log.com','pebble-log.com.evil.example']){
  const r=await request(`https://${host}/sitemap.xml`);assert.equal(r.headers.get('location'),null);assert.notEqual(r.status,308);
 }
});
