import { Suspense } from "react";
import { PopularPosts } from "./popular-posts";
import { PostListLoading } from "./post-list";
import { PopularProjects } from "../../project/components/popular-projects";
import { ProjectsLoading } from "../../project/components/project-list";

export function HomeFeed() {
  return <>
    <Suspense fallback={<PostListLoading/>}><PopularPosts retryHref="/" showTags={false} title="공감받은 글"/></Suspense>
    <Suspense fallback={<ProjectsLoading/>}><PopularProjects retryHref="/"/></Suspense>
  </>;
}
