const axios = require('axios');

const GITLAB_API_URL = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';

function createGitLabClient() {
  return axios.create({
    baseURL: GITLAB_API_URL,
    timeout: 10000,
    headers: {
      'PRIVATE-TOKEN': process.env.GITLAB_TOKEN,
    },
  });
}

async function getMRDiff(projectId, mrIid) {
  const client = createGitLabClient();
  try {
    const response = await client.get(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/changes`);
    if (!response.data.changes) {
      throw new Error('No changes found in MR');
    }
    return response.data.changes.map(change => change.diff).join('\n');
  } catch (error) {
    throw new Error(`Failed to fetch MR diff: ${error.message}`);
  }
}

async function postMRComment(projectId, mrIid, body) {
  const client = createGitLabClient();
  try {
    const response = await client.post(`/projects/${encodeURIComponent(projectId)}/merge_requests/${mrIid}/notes`, {
      body,
    });
    console.log(`[GITLAB] Comment posted to MR !${mrIid}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to post MR comment: ${error.message}`);
  }
}

module.exports = {
  getMRDiff,
  postMRComment,
};
