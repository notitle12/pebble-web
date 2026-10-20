import {ContentPlaceholder} from "@/components/content-placeholder";
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

  return <ContentPlaceholder kind="project" className="project-cover project-cover-general"/>;
}
