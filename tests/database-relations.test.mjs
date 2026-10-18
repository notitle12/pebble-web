import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseLinks,crowFootPaths,routeTableConnection,segmentHitsRect} from '../src/features/post/database-relations.ts';
import {updateDbColumn,relationCardinality} from '../src/features/post/database-schema.ts';
const schema=()=>({schemaVersion:1,display:'BOTH',tables:[{id:'users',name:'users',description:'',position:{x:32,y:32},columns:[{id:'id',name:'id',dataType:'BIGINT',nullable:false,primaryKey:true,unique:false,description:'',reference:null}]},{id:'posts',name:'posts',description:'',position:{x:372,y:32},columns:[{id:'user-id',name:'user_id',dataType:'BIGINT',nullable:true,primaryKey:false,unique:false,description:'',reference:{tableId:'users',columnId:'id'}}]}]});
test('1:1 and required relation labels follow UNIQUE and NULL, and survive renaming',()=>{
 let s=schema();let l=databaseLinks(s)[0];assert.equal(l.many,true);assert.equal(l.targetRequired,false);assert.equal(l.sourceRequired,false);assert.equal(l.notation,'IE');
 s=updateDbColumn(s,'posts','user-id',{unique:true,nullable:false,reference:{tableId:'users',columnId:'id',notation:'BARKER',sourceRequired:true}});
 l=databaseLinks(s)[0];assert.equal(l.many,false);assert.equal(l.targetRequired,true);assert.equal(l.sourceRequired,true);assert.equal(l.notation,'IE');
 s=updateDbColumn(s,'users','id',{name:'member_id'});assert.match(databaseLinks(s)[0].label,/users.member_id/);
});
test('column ports use compact table coordinates and follow movement',()=>{
 const s=schema(),sizes={users:{width:280,height:74},posts:{width:280,height:74}};
 let l=databaseLinks(s,true,sizes)[0];assert.equal(l.source.x,372);assert.equal(l.target.x,312);assert.equal(l.source.y,88);assert.equal(l.target.y,88);assert.equal(l.source.angle,180);assert.equal(l.target.angle,0);
 s.tables[1].position={x:32,y:240};l=databaseLinks(s,true,sizes)[0];assert.equal(l.source.y,296);assert.equal(l.target.y,88);
 for(let i=1;i<l.points.length;i++)for(const t of s.tables)assert.equal(segmentHitsRect(l.points[i-1],l.points[i],{x:t.position.x,y:t.position.y,width:280,height:74}),false);
});
test('vertical, reversed, diagonal, close and obstacle routes avoid card interiors',()=>{
 for(const [a,b,other] of [
  [{x:100,y:100,width:200,height:100},{x:100,y:300,width:200,height:180}],
  [{x:100,y:300,width:200,height:180},{x:100,y:100,width:200,height:100}],
  [{x:100,y:100,width:200,height:180},{x:500,y:450,width:200,height:100}],
  [{x:100,y:100,width:200,height:180},{x:325,y:100,width:200,height:180}],
  [{x:100,y:100,width:200,height:180},{x:800,y:100,width:200,height:180},{x:450,y:60,width:180,height:300}],
 ]){
  const obstacles=[a,b,...(other?[other]:[])],route=routeTableConnection(a,b,obstacles);
  assert.ok(route.points.length>=2);
  for(let i=1;i<route.points.length;i++){const start=route.points[i-1],end=route.points[i];assert.ok(start.x===end.x||start.y===end.y);for(const r of obstacles)assert.equal(segmentHitsRect(start,end,r),false,JSON.stringify({start,end,r}));}
  const first=route.points[1],last=route.points.at(-2);assert.ok((first.x-route.source.x)*route.source.normal.x+(first.y-route.source.y)*route.source.normal.y>0);assert.ok((last.x-route.target.x)*route.target.normal.x+(last.y-route.target.y)*route.target.normal.y>0);
 }
});
test('self-table FK has two separate right-side ports and optional IE markers',()=>{
 const s=schema();s.tables[1].columns[0].reference={tableId:'posts',columnId:'key'};s.tables[1].columns.push({...s.tables[0].columns[0],id:'key'});
 const l=databaseLinks(s)[0];assert.equal(l.source.x,l.target.x);assert.notEqual(l.source.y,l.target.y);assert.ok(l.points[1].x>l.source.x);
 const optional=crowFootPaths(0,0,1,true,false);assert.equal(optional.circle.cx,23);assert.match(optional.maximum,/L10 0/);assert.equal(optional.minimum,null);
 const required=crowFootPaths(0,0,1,false,true);assert.equal(required.circle,null);assert.match(required.minimum,/M23 -7/);
});
test('a single PK remains one-to-one without an explicit UNIQUE checkbox',()=>{
 const s=schema();const t=s.tables[1],c={...t.columns[0],primaryKey:true,nullable:false};t.columns[0]=c;assert.equal(relationCardinality(t,c).many,false);
});

test('parallel foreign keys anchor to distinct rows and take separate routes',()=>{
 const s=schema();s.tables[1].columns.push({...s.tables[1].columns[0],id:'reviewer-id',name:'reviewer_id'});
 const links=databaseLinks(s);assert.equal(links.length,2);assert.notEqual(links[0].d,links[1].d);assert.notEqual(links[0].source.y,links[1].source.y);
 assert.equal(links[0].targetColumnId,'id');assert.equal(links[1].targetColumnId,'id');
 assert.deepEqual(databaseLinks(s).map(l=>l.d),links.map(l=>l.d));
 for(const l of links)for(let i=1;i<l.points.length;i++)for(const t of s.tables)assert.equal(segmentHitsRect(l.points[i-1],l.points[i],{x:t.position.x,y:t.position.y,width:280,height:42+t.columns.length*32}),false);
});
