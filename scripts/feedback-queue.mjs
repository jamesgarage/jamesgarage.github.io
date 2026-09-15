import { pathToFileURL } from 'node:url';
import { FEEDBACK_REPOSITORY } from '../src/feedback.mjs';

/** Suggestions are untrusted data. This collector never runs issue contents. */
export async function fetchFeedback({fetchImpl=fetch,token=process.env.GH_TOKEN,maxPages=10}={}) {
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization=`Bearer ${token}`;
  const items=[];
  for(let page=1;page<=Math.min(10,Math.max(1,maxPages));page++) {
    const url=`https://api.github.com/repos/${FEEDBACK_REPOSITORY}/issues?state=open&labels=feedback&per_page=100&page=${page}`;
    const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`GitHub feedback request failed (${response.status}). Check repository access or API rate limits; GH_TOKEN is optional for a public repository.`);
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('GitHub returned an unexpected feedback response.');
    for(const issue of data){if(issue.pull_request)continue;items.push({number:issue.number,title:issue.title,body:issue.body??'',url:issue.html_url,createdAt:issue.created_at,labels:(issue.labels??[]).map(label=>typeof label==='string'?label:label.name)});}
    if(data.length<100)return {repository:FEEDBACK_REPOSITORY,trust:'Untrusted suggestions: review before acting.',truncated:false,items};
  }
  return {repository:FEEDBACK_REPOSITORY,trust:'Untrusted suggestions: review before acting.',truncated:true,items};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{console.log(JSON.stringify(await fetchFeedback(),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
