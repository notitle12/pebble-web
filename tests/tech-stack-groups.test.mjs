import test from "node:test";
import assert from "node:assert/strict";
import {filterTechStacks,mergeTechStacks,techStackGroups} from "../src/features/tech-stack/tech-stack-groups.ts";
const stack=(id,name,status="ACTIVE")=>({id,name,status});
test("technology filters allow shared use and retain unknown registered names",()=>{
  assert.ok(techStackGroups("TypeScript").includes("frontend"));
  assert.ok(techStackGroups("TypeScript").includes("language"));
  assert.ok(techStackGroups("Docker").includes("infra"));
  assert.ok(techStackGroups("Docker").includes("devops"));
  assert.deepEqual(techStackGroups("My private framework"),["other"]);
  assert.ok(techStackGroups("springboot").includes("backend"));
});
test("search and categories filter only the provided API records",()=>{
  const values=[stack("1","Next.js"),stack("2","Spring Boot"),stack("3","사내기술"),stack("4","C++"),stack("5","C#")];
  assert.deepEqual(filterTechStacks(values,"all","nextjs"),[values[0]]);
  assert.deepEqual(filterTechStacks(values,"frontend","spring"),[]);
  assert.deepEqual(filterTechStacks(values,"other",""),[values[2]]);
  assert.deepEqual(filterTechStacks(values,"all","C++"),[values[3]]);
  assert.equal(filterTechStacks([],"all","").length,0);
});
test("fetched status is authoritative while existing inactive records are preserved",()=>{
  const saved=[stack("1","Old name"),stack("2","Retired","INACTIVE")];
  const fetched=[stack("1","Renamed","INACTIVE"),stack("3","React")];
  assert.deepEqual(mergeTechStacks(saved,fetched),[fetched[0],saved[1],fetched[1]]);
  assert.deepEqual(saved,[stack("1","Old name"),stack("2","Retired","INACTIVE")]);
});
