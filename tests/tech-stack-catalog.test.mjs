import test from "node:test";
import assert from "node:assert/strict";
import {TECH_STACK_GROUPS, reorderTechStacks, techStackKey} from "../src/features/blog-home/tech-stack-catalog.ts";
test("catalog contains unique names that fit the saved stack contract",()=>{
 const names=TECH_STACK_GROUPS.flatMap(group=>group.names);
 assert.equal(new Set(names.map(techStackKey)).size,names.length);
 assert.ok(names.every(name=>name.length>0&&name.length<=50));
});
test("reordering preserves all selected values including older custom stacks",()=>{
 const values=["Java","Custom framework","React","Redis"];
 assert.deepEqual(reorderTechStacks(values,"Java","React"),["Custom framework","React","Java","Redis"]);
 assert.deepEqual(reorderTechStacks(values,"Redis","Java"),["Redis","Java","Custom framework","React"]);
 assert.deepEqual(values,["Java","Custom framework","React","Redis"]);
 assert.equal(reorderTechStacks(values,"missing","React"),values);
 assert.equal(reorderTechStacks(values,"Java","Java"),values);
});
