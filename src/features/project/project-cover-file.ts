import {mediaFileError,safeMediaUrl} from '../media/model.ts';
export async function projectCoverFile(previewUrl:string,request:typeof fetch=fetch):Promise<File>{
 const url=safeMediaUrl(previewUrl);if(!url)throw new Error('이미지 주소가 올바르지 않습니다.');
 const response=await request(url,{credentials:'omit'});
 if(!response.ok)throw new Error('이미지를 불러오지 못했습니다.');
 const blob=await response.blob();
 const file=new File([blob],'cover',{type:blob.type});
 const error=mediaFileError(file);if(error)throw new Error(error);
 return file;
}
