const isSafeHref = (value: string) => /^https?:/i.test(value.trim());

type ImagePreview = { src: string; previewUrl: string };

export async function prepareImageAttachments(files: readonly File[], prepare: (file: File) => Promise<ImagePreview>) {
  const images: (ImagePreview & { name: string })[] = [];
  const errors: string[] = [];
  // 선택 순서를 유지하며 일부 파일이 실패해도 나머지는 첨부한다.
  for (const file of files) {
    try {
      const image = await prepare(file);
      if (!isSafeHref(image.src) || !(isSafeHref(image.previewUrl) || image.previewUrl.startsWith("blob:"))) throw new Error("이미지 응답 주소가 올바르지 않습니다.");
      images.push({ ...image, name: file.name });
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "이미지를 첨부하지 못했습니다."}`);
    }
  }
  return { images, errors };
}
