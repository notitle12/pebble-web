import test from 'node:test';
import assert from 'node:assert/strict';
import {SIDEBAR_MENU_KEYS,isSidebarMenuOrder,reorderSidebarMenu} from '../src/features/blog-home/sidebar-order.ts';
import {parseBlogHomeSettings,defaultBlogHomeSettings,saveMyBlogHome,getPublicBlogNavigation} from '../src/features/blog-home/api/blog-home.ts';

test('sidebar order strictly preserves three movable menus and home cannot be supplied',async()=>{
 const chosen=['SERIES','PROJECTS','BOARDS'],home=defaultBlogHomeSettings();
 assert.deepEqual(home.sidebarOrder,SIDEBAR_MENU_KEYS);
 assert.deepEqual(parseBlogHomeSettings({data:{...home,sidebarOrder:chosen}}).sidebarOrder,chosen);
 const legacy={...home};delete legacy.sidebarOrder;
 assert.equal(parseBlogHomeSettings({data:legacy}).sidebarOrder,undefined);
 let calls=0;
 const result=await saveMyBlogHome({...home,sidebarOrder:chosen},async(path,options)=>{calls++;assert.equal(path,'/members/me/blog-home');assert.equal(options.method,'PUT');assert.deepEqual(options.body.sidebarOrder,chosen);assert.deepEqual(options.body.sections,home.sections);return {data:options.body};});
 assert.deepEqual(result.sidebarOrder,chosen);assert.equal(calls,1);
 await saveMyBlogHome(legacy,async(path,options)=>{assert.equal('sidebarOrder' in options.body,false);return {data:options.body};});
 for(const sidebarOrder of [null,[],['HOME','BOARDS','PROJECTS'],['BOARDS','PROJECTS'],['SERIES','SERIES','BOARDS'],['BOARDS','PROJECTS',1],['boards','PROJECTS','SERIES'],['BOARDS','PROJECTS','SERIES','HOME']]){
  assert.equal(isSidebarMenuOrder(sidebarOrder),false);
  assert.throws(()=>parseBlogHomeSettings({data:{...home,sidebarOrder}}));
  await assert.rejects(saveMyBlogHome({...home,sidebarOrder},async()=>{throw new Error('must not request');}),e=>e.code==='INVALID_REQUEST');
 }
});

test('sidebar drag gaps reorder immutably and ignore unchanged or invalid destinations',()=>{
 const original=[...SIDEBAR_MENU_KEYS];
 assert.deepEqual(reorderSidebarMenu(original,'SERIES',0),['SERIES','BOARDS','PROJECTS']);
 assert.deepEqual(reorderSidebarMenu(original,'BOARDS',3),['PROJECTS','SERIES','BOARDS']);
 for(const gap of [0,1,-1,4,1.5])assert.equal(reorderSidebarMenu(original,'BOARDS',gap),original);
 assert.equal(reorderSidebarMenu(original,'HOME',0),original);
 assert.deepEqual(original,SIDEBAR_MENU_KEYS);
});

test('public navigation uses a lightweight Guest read and rejects malformed ordering',async()=>{
 let calls=0;
 const result=await getPublicBlogNavigation('test-blog','https://example.test/api/v1',async(url,init)=>{
  calls++;assert.equal(url.pathname,'/api/v1/blogs/test-blog/navigation');assert.equal(url.search,'');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,undefined);
  return Response.json({data:{sidebarOrder:['SERIES','BOARDS','PROJECTS']}});
 });
 assert.deepEqual(result.sidebarOrder,['SERIES','BOARDS','PROJECTS']);assert.equal(calls,1);
 for(const sidebarOrder of [null,[],['HOME','BOARDS','PROJECTS']])await assert.rejects(getPublicBlogNavigation('test-blog','https://example.test/api/v1',async()=>Response.json({data:{sidebarOrder}})));
 await assert.rejects(getPublicBlogNavigation('bad handle','https://example.test/api/v1',async()=>{throw new Error('must not request');}));
});
