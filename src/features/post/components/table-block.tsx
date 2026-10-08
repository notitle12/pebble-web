import { PrimaryKeyNote } from "./primary-key-note";
import type { TableSpec } from "../api/post-list";

export function TableBlock({ spec, title }: { spec: TableSpec; title: string | null }) {
  return <section className="table-block" aria-label={title ?? `${spec.tableName} 테이블 명세`}>
    <div className="table-block-heading"><div><h2>{title ?? spec.tableName}</h2>{spec.description && <p>{spec.description}</p>}</div></div>
    <PrimaryKeyNote columns={spec.columns}/>
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`${spec.tableName} 열람 가능한 표`}>
      <table><caption>{spec.tableName} 데이터베이스 테이블 명세</caption>
        <thead><tr><th scope="col">컬럼</th><th scope="col">자료형</th><th scope="col">NULL 허용</th><th scope="col">키</th><th scope="col">참조</th><th scope="col">설명</th></tr></thead>
        <tbody>{spec.columns.map((column, index) => <tr key={`${column.name}-${index}`}>
          <th scope="row">{column.name}</th><td>{column.dataType}</td><td>{column.nullable ? "허용" : "불가"}</td>
          <td>{column.primaryKey && column.foreignKey ? "PK·FK" : column.primaryKey ? "PK" : column.foreignKey ? "FK" : ""}</td><td>{column.foreignKey ?? ""}</td><td>{column.description ?? ""}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
