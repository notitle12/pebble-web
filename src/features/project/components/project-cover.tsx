import { safeMediaUrl } from "@/features/media/model";

type ProjectCoverProps = {
  title: string;
  techStacks?: string[];
  index: number;
  imageUrl?: string | null;
};

export function ProjectCover({ imageUrl }: ProjectCoverProps) {
  const safeUrl = safeMediaUrl(imageUrl ?? null);
  if (safeUrl) {
    return (
      <div className="project-cover project-cover-image-wrap" aria-hidden="true">
        <img src={safeUrl} alt="" className="project-cover-image" loading="lazy" />
      </div>
    );
  }

  return <div className="project-cover project-cover-general" aria-hidden="true">
    <svg className="project-cover-art" viewBox="0 0 640 360" fill="none" focusable="false">
      <rect x="205" y="89" width="230" height="182" rx="22" opacity=".13" fill="currentColor" stroke="none"/>
      <path d="M231 112h63l22 23h93v105a14 14 0 0 1-14 14H245a14 14 0 0 1-14-14V112Z" strokeWidth="3"/>
      <path d="M258 172h124m-124 23h83" strokeWidth="3" opacity=".5"/>
      <circle cx="366" cy="222" r="5" fill="currentColor" stroke="none" opacity=".65"/>
      <circle cx="382" cy="222" r="5" fill="currentColor" stroke="none" opacity=".35"/>
    </svg>
  </div>;
}
