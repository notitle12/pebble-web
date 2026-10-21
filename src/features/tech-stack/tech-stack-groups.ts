import type {PublicTechStack} from "./api/public-tech-stacks.ts";

// These are display filters, not a catalog: selectable records always come from the API.
export const TECH_FILTERS = [
  {id:"all",label:"전체"}, {id:"frontend",label:"프론트엔드"},
  {id:"backend",label:"백엔드"}, {id:"database",label:"DB"},
  {id:"devops",label:"DevOps"}, {id:"infra",label:"인프라"},
  {id:"ai",label:"AI"}, {id:"external",label:"외부 서비스"},
  {id:"language",label:"언어"}, {id:"other",label:"기타"},
] as const;
export type TechFilter = typeof TECH_FILTERS[number]["id"];
const key = (name:string) => name.normalize("NFKC").toLowerCase().replace(/[\s._-]+/g, "");
const names:Record<string,string[]> = {
  frontend:["React","Next.js","Vue","Vue.js","Nuxt","Nuxt.js","Svelte","SvelteKit","Angular","HTML","HTML5","CSS","CSS3","Tailwind","Tailwind CSS","React Native","Flutter","Android","iOS","JavaScript","TypeScript"],
  backend:["Java","Kotlin","Spring","Spring Boot","Springboot","JPA","Hibernate","Node.js","Express","NestJS","Django","FastAPI","Flask",".NET","ASP.NET","Laravel","Ruby on Rails","GraphQL","Go","Python","PHP","Ruby"],
  database:["PostgreSQL","Postgres","MySQL","MariaDB","SQLite","MongoDB","Redis","Elasticsearch","OpenSearch","Oracle","Oracle Database","DynamoDB","Cassandra","Supabase","Firebase","Prisma"],
  devops:["Docker","Docker Compose","Kubernetes","K8s","Git","GitHub Actions","GitLab CI","Jenkins","Terraform","Ansible","Argo CD","Helm","Prometheus","Grafana"],
  infra:["Docker","Kubernetes","K8s","AWS","Amazon Web Services","Google Cloud","GCP","Azure","Cloudflare","Vercel","Netlify","Nginx","Apache","Linux","Ubuntu","Oracle Cloud","OCI","Naver Cloud","NCP","Terraform","Kafka","RabbitMQ"],
  ai:["Python","PyTorch","TensorFlow","Keras","scikit-learn","Hugging Face","Transformers","LangChain","LlamaIndex","OpenAI","ChatGPT","Gemini","Claude","Ollama"],
  external:["OpenAI","Gemini","Claude","Firebase","Supabase","Stripe","PortOne","Toss Payments","Naver Maps","Kakao Maps","Google Maps","Sentry","Resend","Twilio","Figma"],
  language:["Java","Kotlin","JavaScript","TypeScript","Python","Go","Golang","Rust","C","C++","C#","Swift","Dart","PHP","Ruby","Scala","SQL","R"],
};
const groups = Object.fromEntries(Object.entries(names).map(([group,values])=>[group,new Set(values.map(key))]));
export function techStackGroups(name:string):TechFilter[] {
  const matched=Object.entries(groups).filter(([,values])=>values.has(key(name))).map(([group])=>group as TechFilter);
  return matched.length ? matched : ["other"];
}
export function filterTechStacks(items:PublicTechStack[],group:TechFilter,query:string):PublicTechStack[] {
  const search=key(query);
  return items.filter(item=>(group==="all" || techStackGroups(item.name).includes(group)) && key(item.name).includes(search));
}
export function mergeTechStacks(existing:PublicTechStack[],fetched:PublicTechStack[]):PublicTechStack[] {
  return [...new Map([...existing,...fetched].map(item=>[item.id,item])).values()];
}
