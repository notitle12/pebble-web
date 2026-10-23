import test from 'node:test';
import assert from 'node:assert/strict';
import {postEditorExitHref} from '../src/features/post/editor-exit.ts';
import {projectEditorExitHref} from '../src/features/project/editor-exit.ts';
import {projectOrderPreviewPosts,reorderProjectPosts} from '../src/features/project/api/project-post-order.ts';
const post={id:'9007199254740993',draft:false,visibilityStatus:'PUBLIC',isBlocked:false,author:{handle:'pebble'},urlKey:'my-post'};
test('editing exits to the existing article or project; only unsaved new content returns to management',()=>{
 assert.equal(postEditorExitHref(post),'/blogs/pebble/posts/my-post');
 assert.equal(projectEditorExitHref(post),'/projects/9007199254740993');
 assert.equal(postEditorExitHref(null),'/me/posts');
 assert.equal(projectEditorExitHref(null),'/me/projects');
});
test('private, blocked and draft articles exit to the owner viewer instead of a public 404',()=>{
 for(const changes of [{visibilityStatus:'HIDDEN'},{isBlocked:true},{draft:true}])assert.equal(postEditorExitHref({...post,...changes}),'/posts/9007199254740993/view');
 for(const changes of [{visibilityStatus:'HIDDEN'},{isBlocked:true}])assert.equal(projectEditorExitHref({...post,...changes}),'/projects/9007199254740993/view');
 assert.equal(postEditorExitHref({...post,id:'../bad'}),'/me/posts');
 assert.equal(projectEditorExitHref({...post,id:'0'}),'/me/projects');
});
test('preview follows the unsaved reading order without exposing private, blocked or draft posts',()=>{
 const rows=[{...post,id:'1'}, {...post,id:'2',visibilityStatus:'HIDDEN'}, {...post,id:'3',isBlocked:true}, {...post,id:'4',draft:true}, {...post,id:'5'}];
 const staged=reorderProjectPosts(rows,4,0);
 assert.deepEqual(projectOrderPreviewPosts(staged).map(p=>p.id),['5','1']);
 assert.deepEqual(rows.map(p=>p.id),['1','2','3','4','5']);
 assert.deepEqual(projectOrderPreviewPosts([]),[]);
});
