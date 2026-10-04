type ProjectCoverProps = {
  title: string;
  tags?: string[];
  index: number;
};

export function ProjectCover({ title, tags = [], index }: ProjectCoverProps) {
  const firstTag = tags[0];
  const isFrontend = tags.some((tag) => /react|frontend|front-end/i.test(tag));
  const number = String(index).padStart(2, "0");

  return (
    <div className={`project-cover ${isFrontend ? "project-cover-frontend" : "project-cover-general"}`} aria-hidden="true">
      <svg className="project-cover-art" viewBox="0 0 640 360" fill="none" focusable="false">
        {isFrontend ? (
          <>
            <rect x="104" y="67" width="365" height="219" rx="14" />
            <path d="M104 105h365M137 86h2m17 0h2m17 0h2" />
            <rect x="142" y="131" width="123" height="122" rx="8" />
            <path d="M164 157h78m-78 18h55m-55 18h68m-68 18h43" />
            <rect x="284" y="131" width="151" height="51" rx="8" />
            <path d="M303 151h91m-91 14h56" />
            <rect x="284" y="194" width="151" height="59" rx="8" />
            <path d="M303 216h113m-113 16h77" />
            <path d="M478 105l44 35v121l-44 25" />
            <circle cx="509" cy="94" r="5" />
          </>
        ) : (
          <>
            <path d="M126 119l158-61 189 72-158 62-189-73Z" />
            <path d="M126 153l189 73 158-62v36l-158 63-189-73v-37Z" />
            <path d="M126 198l189 73 158-63v37l-158 62-189-73v-36Z" />
            <path d="M182 114l158-61m-99 92 158-61m-99 92 158-61" />
            <circle cx="466" cy="85" r="7" />
            <path d="M492 85h39m-19-19v38" />
          </>
        )}
      </svg>
      <span className="project-cover-index">PROJECT {number}</span>
      <span className="project-cover-title">{title}</span>
      {firstTag && <span className="project-cover-caption">{firstTag}</span>}
    </div>
  );
}
