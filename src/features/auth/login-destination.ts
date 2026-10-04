const destinations = new Set(["/me/blog", "/me/posts", "/posts/new"]);
export function loginDestination(value: string | null): string {
  return value && destinations.has(value) ? value : "/me/posts";
}
