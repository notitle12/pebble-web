"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { parseTableSpec, type TableColumn, type TableSpec } from "../api/post-list";
import { TableBlock } from "./table-block";

type Row = TableColumn & { rowKey: number };
const sample: TableSpec = {
  schemaVersion: 1,
  tableName: "member",
  description: "Pebble 회원의 기본 프로필 정보",
  columns: [
    { name: "id", dataType: "BIGINT", nullable: false, primaryKey: true, description: "회원 식별자" },
    { name: "handle", dataType: "VARCHAR(30)", nullable: false, primaryKey: false, description: "고정 공개 아이디" },
    { name: "nickname", dataType: "VARCHAR(30)", nullable: false, primaryKey: false, description: "화면에 표시하는 이름" },
    { name: "created_at", dataType: "TIMESTAMPTZ", nullable: false, primaryKey: false, description: "생성 시각" },
  ],
};
export function TableSpecEditor({ onChange, initialValue, embedded = false }: { onChange?: (value: TableSpec | null) => void; initialValue?: TableSpec; embedded?: boolean }) {
  const id = useId().replaceAll(":", "");
  const [tableName, setTableName] = useState(() => initialValue?.tableName ?? sample.tableName);
  const [description, setDescription] = useState(() => initialValue ? initialValue.description ?? "" : sample.description ?? "");
  const [columns, setColumns] = useState<Row[]>(() => (initialValue ?? sample).columns.map((column, rowKey) => ({ ...column, rowKey })));
  const nextKey = useRef((initialValue ?? sample).columns.length);
  const spec = useMemo<TableSpec>(() => ({ schemaVersion: 1, tableName, description: description || null, columns: columns.map(({ rowKey: _key, ...column }) => column) }), [tableName, description, columns]);
  let validationMessage = "";
  try {
    parseTableSpec(spec);
    if (Array.from(JSON.stringify(spec)).length > 50000) throw new Error("content length");
  } catch {
    validationMessage = "입력값을 확인해 주세요. 필수값은 비워둘 수 없고 각 길이 제한은 Unicode 문자 수 기준입니다. 본문은 최대 50,000자입니다. 컬럼명은 중복될 수 없으며 기본 키는 NULL을 허용하지 않습니다.";
  }
  useEffect(() => { onChange?.(validationMessage ? null : spec); }, [onChange, spec, validationMessage]);
  const update = (key: number, change: Partial<Row>) => setColumns(rows => rows.map(row => row.rowKey === key ? { ...row, ...change } : row));

  return <div className="table-editor-layout">
    <form className="table-editor" onSubmit={event => event.preventDefault()}>
      <div className="table-editor-field"><label htmlFor={`${id}-table-name`}>테이블명</label><input id={`${id}-table-name`} value={tableName} onChange={event => setTableName(event.target.value)} /></div>
      <div className="table-editor-field"><label htmlFor={`${id}-table-description`}>테이블 설명</label><textarea id={`${id}-table-description`} value={description} onChange={event => setDescription(event.target.value)} /></div>
      <div className="table-editor-columns-heading"><h2>컬럼 ({columns.length}/50)</h2><button type="button" disabled={columns.length >= 50} onClick={() => setColumns(rows => [...rows, { rowKey: nextKey.current++, name: "", dataType: "", nullable: true, primaryKey: false }])}>컬럼 추가</button></div>
      {columns.map((column, index) => <fieldset className="table-column-editor" key={column.rowKey}>
        <legend>컬럼 {index + 1}</legend>
        <div className="table-editor-field"><label htmlFor={`${id}-column-${column.rowKey}-name`}>컬럼명 {index + 1}</label><input id={`${id}-column-${column.rowKey}-name`} value={column.name} onChange={event => update(column.rowKey, { name: event.target.value })} /></div>
        <div className="table-editor-field"><label htmlFor={`${id}-column-${column.rowKey}-type`}>자료형 {index + 1}</label><input id={`${id}-column-${column.rowKey}-type`} value={column.dataType} onChange={event => update(column.rowKey, { dataType: event.target.value })} /></div>
        <label className="table-editor-check"><input type="checkbox" checked={column.primaryKey} onChange={event => update(column.rowKey, { primaryKey: event.target.checked, nullable: event.target.checked ? false : column.nullable })} /> 기본 키 (PK)</label>
        <label className="table-editor-check"><input type="checkbox" checked={column.nullable} disabled={column.primaryKey} onChange={event => update(column.rowKey, { nullable: event.target.checked })} /> NULL 허용</label>
        <div className="table-editor-field"><label htmlFor={`${id}-column-${column.rowKey}-fk`}>외래 키 참조 {index + 1}</label><input id={`${id}-column-${column.rowKey}-fk`} value={column.foreignKey ?? ""} placeholder="예: post.id" onChange={event => update(column.rowKey, { foreignKey: event.target.value || null })} /></div>
        <div className="table-editor-field"><label htmlFor={`${id}-column-${column.rowKey}-description`}>컬럼 설명 {index + 1}</label><textarea id={`${id}-column-${column.rowKey}-description`} value={column.description ?? ""} onChange={event => update(column.rowKey, { description: event.target.value || null })} /></div>
        <button className="table-remove-column" type="button" disabled={columns.length <= 1} onClick={() => setColumns(rows => rows.filter(row => row.rowKey !== column.rowKey))}>컬럼 {index + 1} 삭제</button>
      </fieldset>)}
      {validationMessage && <p className="table-editor-error" role="alert">{validationMessage}</p>}
      {!embedded && <p className="table-editor-note">작성 미리보기입니다. 로그인, 게시글 편집기, 저장 및 게시 기능은 아직 제공하지 않습니다.</p>}
    </form>
    <section className="table-live-preview" aria-label="테이블 미리보기"><h2>미리보기</h2>{validationMessage
      ? <p className="table-preview-invalid">입력 오류를 수정하면 표 미리보기가 표시됩니다.</p>
      : <TableBlock spec={spec} title={null} />}</section>
  </div>;
}
