import test from 'node:test';
import assert from 'node:assert/strict';
import {trendGeometry,trendIndexAtX} from '../src/features/content-insights/trend-chart.ts';

test('a single day is visible in the center even when both counters are zero',()=>{
 assert.deepEqual(trendGeometry([{label:'2026-11-05',values:[0,0]}]),{maximum:1,points:[{x:360,ys:[140,140]}]});
 assert.deepEqual(trendGeometry([{label:'2026-11-05',values:[8,4]}]),{maximum:8,points:[{x:360,ys:[24,82]}]});
 assert.equal(trendIndexAtX(1,0),0);assert.equal(trendIndexAtX(1,1),0);
});

test('mouse and touch positions select the nearest bounded day with shared series scale',()=>{
 const geometry=trendGeometry([{label:'a',values:[0,10]},{label:'b',values:[5,0]},{label:'c',values:[0,0]}]);
 assert.deepEqual(geometry.points.map(point=>point.x),[16,360,704]);
 assert.equal(geometry.points[1].ys[0],82);
 assert.equal(trendIndexAtX(3,-1),0);assert.equal(trendIndexAtX(3,.5),1);assert.equal(trendIndexAtX(3,2),2);
 assert.equal(trendIndexAtX(0,.5),null);assert.equal(trendIndexAtX(3,NaN),null);
});
