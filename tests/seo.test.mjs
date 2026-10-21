import assert from 'node:assert/strict';
import {test} from 'node:test';
import {siteUrl,plainDescription,description,jsonLd,postSearchData,projectSearchData,SHARE_IMAGE,publicContent} from '../src/features/seo/model.ts';
import {siteVerification} from '../src/features/seo/verification.ts';
import {parsePostPage} from '../src/features/post/api/post-list.ts';
import {parseProjectPage} from '../src/features/project/api/project-list.ts';
import {sitemapIndex,sitemapShard,sitemapXml,parseShard,sitemapResponse} from '../src/features/seo/sitemaps.ts';
const date='2026-10-21T00:00:00Z';
const post={id:'123',urlKey:'test',title:'Title',summary:null,author:{id:'1',handle:'pebble',nickname:'작성자',blogName:'내 블로그'},tags:['DB'],publishedAt:date,createdAt:date,updatedAt:date,blocks:[{type:'ARCHITECTURE',content:'SECRET JSON'},{type:'HTML',content:'<p>첫 문장</p><p>둘째 문장</p>'}]};
const project={id:'456',name:'Project',summary:null,owner:{id:'1',nickname:'작성자'},techStacks:[{id:'1',name:'Java'}],publishedAt:date,createdAt:date,lifecycleStatus:'IN_PROGRESS',description:'설명',media:[],features:[],links:[]};
const page=(content=[],page=0,totalPages=content.length?1:0)=>({content,page,size:20,totalElements:totalPages===1?content.length:totalPages*20,totalPages,hasNext:page+1<totalPages,hasPrevious:page>0});
test('검색 설명은 HTML·스크립트를 제거하고 문단과 한글·이모지를 보존한다',()=>{
 assert.equal(plainDescription('<p>one &amp; two</p><p>three</p><script>alert(1)</script>'),'one & two three');
 assert.equal(plainDescription('## 제목\n\n**본문**',true),'제목 본문');
 assert.equal(description(null,post.blocks),'첫 문장 둘째 문장');
 const desc=description('😀'.repeat(200));assert.equal(Array.from(desc).length,160);assert.ok(desc.endsWith('…'));assert.ok(!desc.includes('\uFFFD'));
 assert.equal(description(null,[{type:'CODE',content:'password'}]),description(null));
});
test('canonical은 고정된 운영 도메인만 허용하고 JSON-LD의 태그 탈출을 막는다',()=>{
 for(const path of ['//evil.com','https://evil.com','/\\evil.com'])assert.throws(()=>siteUrl(path));
 const value={name:'</script><script>alert("x")</script>&\u2028\u2029'};
 const serialized=jsonLd(value);assert.ok(!serialized.includes('<'));assert.ok(!serialized.includes('&'));assert.deepEqual(JSON.parse(serialized),value);
});
test('공개 글 메타데이터는 작성자·수정일과 서명 없는 안정적인 대표 이미지를 사용한다',()=>{
 const {metadata,schema}=postSearchData({...post,thumbnailImageId:'789',thumbnailUrl:'https://r2.example/private?signature=expired'});
 assert.equal(metadata.alternates.canonical,'https://www.pebble-log.com/blogs/pebble/posts/test');
 assert.deepEqual(metadata.title,{absolute:'Title | 내 블로그'});assert.equal(schema['@type'],'BlogPosting');assert.equal(schema.dateModified,date);
 assert.equal(schema.image,'https://api.pebble-log.com/api/v1/posts/123/images/789/content');assert.equal(schema.author.url,'https://www.pebble-log.com/blogs/pebble');
 assert.equal(postSearchData(post).schema.image,SHARE_IMAGE);
 for(const flags of [{visibilityStatus:'HIDDEN'},{draft:true},{isBlocked:true}]){assert.equal(publicContent({...post,...flags}),false);assert.throws(()=>postSearchData({...post,...flags}));}
 const data=projectSearchData({...project,media:[{id:'900',mediaRole:'THUMBNAIL',url:'https://expired.example'}]});assert.equal(data.schema['@type'],'CreativeWork');assert.equal(data.schema.image,'https://api.pebble-log.com/api/v1/projects/456/media/900/content');
});
test('선택적 수정일과 썸네일 ID도 응답 경계에서 검증한다',()=>{
 assert.equal(parsePostPage({data:page([post])},0).content[0].updatedAt,date);
 for(const flags of [{updatedAt:'invalid'},{thumbnailImageId:123}])assert.throws(()=>parsePostPage({data:page([{...post,...flags}])},0));
 assert.throws(()=>parseProjectPage({data:page([{...project,updatedAt:'invalid'}])},0));
});
test('사이트맵은 공개 글과 블로그만 중복 없이 노출하고 XML을 이스케이프한다',async()=>{
 const xml=await sitemapShard('posts',0,{posts:async()=>page([post,{...post,id:'124',urlKey:'test2'},{...post,visibilityStatus:'HIDDEN'},{...post,draft:true},{...post,isBlocked:true}]),projects:async()=>page([])});
 assert.equal((xml.match(/<url>/g)||[]).length,3);assert.equal((xml.match(/<lastmod>/g)||[]).length,2);assert.ok(xml.includes('<lastmod>'+date+'</lastmod>'));
 assert.ok(sitemapXml([{url:'https://example.com/?a=1&b=<x>"'}]).includes('&amp;b=&lt;x&gt;&quot;'));
});
test('사이트맵은 최대 10페이지씩 분할하고 API 동시 요청을 3개로 제한한다',async()=>{
 let active=0,max=0;const calls=[];
 const reader=async n=>{calls.push(n);active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return page([{...project,id:String(n+1)}],n,25);};
 const xml=await sitemapShard('projects',1,{projects:reader,posts:async()=>page([])});
 assert.equal((xml.match(/<url>/g)||[]).length,10);assert.deepEqual(calls,[10,11,12,13,14,15,16,17,18,19]);assert.ok(max<=3);
 const index=await sitemapIndex({posts:async()=>page([],0,11),projects:async()=>page([],0,21)});
 assert.equal((index.match(/<sitemap>/g)||[]).length,6);assert.ok(index.includes('/sitemaps/posts/1.xml'));assert.ok(index.includes('/sitemaps/projects/2.xml'));
 await assert.rejects(sitemapIndex({posts:async()=>page([],0,500000),projects:async()=>page([])}),/capacity/);
});
test('잘못된 사이트맵 경로와 원본 장애는 빈 정상 응답으로 위장하지 않는다',async()=>{
 for(const value of ['01.xml','-1.xml','1e2.xml','50000.xml','0','../0.xml'])assert.equal(parseShard(value),null);
 assert.equal(parseShard('0.xml'),0);
 assert.equal(await sitemapShard('posts',2,{posts:async()=>page([],2,1),projects:async()=>page([])}),null);
 await assert.rejects(sitemapShard('posts',0,{posts:async()=>{throw new Error('upstream');},projects:async()=>page([])}),/upstream/);
 const response=sitemapResponse('Unavailable',503);assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'300');assert.equal(response.headers.get('cache-control'),'no-store');
});
test('사이트 인증은 실제 공개 확인 토큰만 허용하고 임의 태그나 인증정보는 사용하지 않는다',()=>{
 assert.deepEqual(siteVerification({}),{other:{}});
 assert.deepEqual(siteVerification({NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:' goog_123 ',NEXT_PUBLIC_NAVER_SITE_VERIFICATION:'naver-123',NEXT_PUBLIC_BING_SITE_VERIFICATION:'B123',NAVER_CLIENT_SECRET:'secret'}),{google:'goog_123',other:{'naver-site-verification':'naver-123','msvalidate.01':'B123'}});
 assert.deepEqual(siteVerification({NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:'<meta evil>',NEXT_PUBLIC_NAVER_SITE_VERIFICATION:'x'.repeat(257)}),{other:{}});
});
