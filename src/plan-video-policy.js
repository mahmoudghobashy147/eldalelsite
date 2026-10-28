'use strict';
function countPlanVideos(allPosts,monthPosts,plan){return (plan==='basic'?monthPosts:allPosts).filter(p=>!!p.video).length;}
module.exports={countPlanVideos};
