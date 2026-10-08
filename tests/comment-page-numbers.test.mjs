import test from 'node:test';
import assert from 'node:assert/strict';
import {commentPageNumbers} from '../src/features/comment/page-numbers.ts';
test('page window keeps valid zero-based pages at empty, first, middle and last pages',()=>{
 assert.deepEqual(commentPageNumbers(0,0),[0]);assert.deepEqual(commentPageNumbers(0,3),[0,1,2]);
 assert.deepEqual(commentPageNumbers(0,20),[0,1,2,3,4]);assert.deepEqual(commentPageNumbers(10,20),[8,9,10,11,12]);
 assert.deepEqual(commentPageNumbers(19,20),[15,16,17,18,19]);
});
