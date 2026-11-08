import test from 'node:test';
import assert from 'node:assert/strict';
import {seriesPostDropOrder,seriesDropOrder} from '../src/features/post/series-post-order.ts';
test('series list drag supports all 100 series, both directions and no-op drops',()=>{
 assert.equal(seriesDropOrder(0,100,100),99);
 assert.equal(seriesDropOrder(99,0,100),0);
 assert.equal(seriesDropOrder(20,20,100),null);
 assert.equal(seriesDropOrder(20,21,100),null);
 for(const args of [[-1,0,2],[2,0,2],[0,3,2],[0,0,0],[0,1.5,2]])assert.equal(seriesDropOrder(...args),null);
});
test('series drops use insertion gaps, including first/last and unchanged locations',()=>{
 assert.equal(seriesPostDropOrder(0,3,0,3,3),2);
 assert.equal(seriesPostDropOrder(2,0,0,3,3),0);
 assert.equal(seriesPostDropOrder(1,1,0,3,3),null);
 assert.equal(seriesPostDropOrder(1,2,0,3,3),null);
});
test('series ranks come from the page position rather than possibly gapped stored orders',()=>{
 assert.equal(seriesPostDropOrder(0,5,1,5,25),24);
 assert.equal(seriesPostDropOrder(4,0,1,5,25),20);
 for(const args of [[-1,1,0,3,3],[3,1,0,3,3],[0,4,0,3,3],[0,1,-1,3,3],[0,1,0,0,3],[0,1,0,21,21],[0,1,1,5,24],[0,1.5,0,3,3]])assert.equal(seriesPostDropOrder(...args),null);
});
