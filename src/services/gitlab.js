const axios = require('axios');

const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';

function createGitLabClient() {
  return axios.create({
    baseURL: GITLAB_API_URL,
    headers: {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN,
    },
  });
}

async function getMRDiff(projectId, mrIid) {
  const client = createGitLabClient();
  const response = await client.get(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/changes`);
  return response.data.changes.map(change => change.diff).join('\n');
}

async function postMRComment(projectId, mrIid, body) {
  const client = createGitLabClient();
  await client.post(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`, {
    body,
  });
  console.log(`[GITLAB] Comment posted to MR !${mrIid}`);
}

module.exports = {
  getMRDiff,
  postMRComment,
};
