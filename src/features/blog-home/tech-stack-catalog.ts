export const TECH_STACK_GROUPS = [
  {label: "언어", names: ["Java", "Kotlin", "JavaScript", "TypeScript", "Python", "Go", "Rust", "C", "C++", "C#", "Swift", "Dart", "PHP", "Ruby"]},
  {label: "프론트엔드 · 앱", names: ["React", "Next.js", "Vue.js", "Nuxt", "Svelte", "Angular", "HTML", "CSS", "Tailwind CSS", "React Native", "Flutter", "Android", "iOS"]},
  {label: "백엔드", names: ["Spring Boot", "Spring", "Node.js", "Express", "NestJS", "Django", "FastAPI", "Flask", ".NET", "Laravel", "Ruby on Rails", "GraphQL"]},
  {label: "데이터베이스", names: ["PostgreSQL", "MySQL", "MariaDB", "SQLite", "MongoDB", "Redis", "Elasticsearch", "Oracle"]},
  {label: "인프라 · 도구", names: ["Docker", "Kubernetes", "AWS", "Google Cloud", "Azure", "Cloudflare", "Vercel", "Nginx", "Linux", "Git", "GitHub Actions", "Jenkins", "Terraform", "Kafka", "RabbitMQ", "Figma"]},
] as const;
export const techStackKey = (name: string) => name.normalize("NFKC").trim().toLocaleLowerCase("und");
export function reorderTechStacks(items: string[], source: string, target: string): string[] {
  const from = items.indexOf(source), to = items.indexOf(target);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items]; next.splice(from, 1); next.splice(to, 0, source); return next;
}
