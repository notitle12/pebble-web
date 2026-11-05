import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInsightFilters,insightPageHref,insightDetailLink,insightLocationHref} from '../src/features/content-insights/insight-query.ts';

test('insight filters default to seven days and reject duplicate, oversized and unsupported URL values',()=>{
 const defaults=parseInsightFilters(new URLSearchParams());
 assert.deepEqual(defaults,{days:7,kind:'posts',sort:'LATEST',direction:'DESC',query:'',from:'posts'});
 for(const query of ['days=0','days=1','days=90','days=7&days=14','days=-1','sort=TITLE','direction=DOWN','from=https://evil.test',`q=${'a'.repeat(101)}`]){
  assert.deepEqual(parseInsightFilters(new URLSearchParams(query)),defaults);
 }
});

test('detail and return links preserve list kind, search, sort and selected days without external return URLs',()=>{
 const filters=parseInsightFilters(new URLSearchParams('days=7&kind=projects&sort=POPULAR&direction=ASC&q=검색+%26+글'));
 const href=insightDetailLink('projects','9007199254740993',filters,'projects');
 const detail=new URL(href,'http://localhost');
 assert.equal(detail.pathname,'/settings/blog/insights/projects/9007199254740993');
 const restored=parseInsightFilters(detail.searchParams);
 assert.equal(restored.query,'검색 & 글');assert.equal(restored.days,7);assert.equal(restored.sort,'POPULAR');assert.equal(restored.direction,'ASC');
 const back=new URL(insightPageHref(restored.from,restored),'http://localhost');
 assert.equal(back.pathname,'/settings/blog/insights/content');assert.equal(back.searchParams.get('kind'),'projects');
 assert.equal(back.searchParams.get('q'),'검색 & 글');
});

test('overview links retain context and a ranking detail explicitly returns to overview',()=>{
 const filters=parseInsightFilters(new URLSearchParams('days=30&sort=VIEWS'));
 const detail=new URL(insightDetailLink('posts','1',filters,'overview'),'http://localhost');
 const restored=parseInsightFilters(detail.searchParams);
 assert.equal(restored.from,'overview');
 assert.equal(insightPageHref(restored.from,restored),'/settings/blog/insights?days=30&sort=VIEWS');
});


test('legacy all-period URLs normalize to seven days while keeping the detail return context',()=>{
 const params=new URLSearchParams('days=0&sort=POPULAR&q=한글&from=posts');
 assert.equal(insightLocationHref('/settings/blog/insights/posts/123',parseInsightFilters(params)),'/settings/blog/insights/posts/123?days=7&sort=POPULAR&q=%ED%95%9C%EA%B8%80&from=posts');
 const fortnight=parseInsightFilters(new URLSearchParams('days=14'));
 assert.equal(fortnight.days,14);
 assert.equal(insightPageHref('overview',fortnight),'/settings/blog/insights?days=14');
});
