export function preparePostPatch(text,images) {
  const content=String(text||'').trim();
  if(!content)throw new Error('اكتب نص المنشور أولًا');
  if(content.length>10000)throw new Error('نص المنشور أطول من الحد المسموح');
  if(!Array.isArray(images)||images.length>4||images.some(url=>typeof url!=='string'||!url))throw new Error('يمكن إرفاق أربع صور بحد أقصى');
  return {content,images:[...images]};
}
export function canEditPost(post,user) {return !!user?.uid && post?.authorId===user.uid;}
