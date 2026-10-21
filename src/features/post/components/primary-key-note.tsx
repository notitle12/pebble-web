import type { TableColumn } from "../api/post-list";

export function PrimaryKeyNote({ columns }: { columns: TableColumn[] }) {
  const keys = columns.filter(column => column.primaryKey).map(column => column.name || "이름 없는 컬럼");
  return <div className="table-primary-key-note"><p>PK는 테이블당 하나이며, 여러 컬럼을 선택하면 함께 하나의 복합 기본 키를 구성합니다.</p>
    {keys.length > 0 && <p><strong>{keys.length > 1 ? "복합 기본 키" : "기본 키"}</strong><code>({keys.join(", ")})</code></p>}
  </div>;
}
