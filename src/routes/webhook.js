const express = require('express');
const { runClaudeReview } = require('../services/claude');

const router = express.Router();

// Validate TARGET_BRANCHES is set at startup
if (!process.env.TARGET_BRANCHES) {
  throw new Error('TARGET_BRANCHES environment variable is required');
}

function isTargetBranch(targetBranch) {
  const allowedBranches = process.env.TARGET_BRANCHES.split(',').map(b => b.trim());
  return allowedBranches.includes(targetBranch);
}

router.post('/webhook', async (req, res) => {
  // Validate request body structure
  if (!req.body || typeof req.body.object_kind !== 'string') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { object_kind, project, object_attributes } = req.body;

  // Only handle merge request events
  if (object_kind !== 'merge_request') {
    return res.status(200).json({ message: 'Ignored: not a merge request' });
  }

  // Validate object_attributes structure
  if (!object_attributes || typeof object_attributes.state !== 'string') {
    return res.status(400).json({ error: 'Invalid merge request data' });
  }

  const { source_branch, target_branch, iid, state } = object_attributes;

  // Only review when MR is opened or updated
  if (!['opened', 'updated'].includes(state)) {
    return res.status(200).json({ message: 'Ignored: MR not opened or updated' });
  }

  // Check if target branch is in allowed list
  if (!isTargetBranch(target_branch)) {
    console.log(`[WEBHOOK] Ignored: ${target_branch} not in target branches`);
    return res.status(200).json({ message: 'Ignored: target branch not in list' });
  }

  // Validate project structure
  if (!project || typeof project.path_with_namespace !== 'string') {
    return res.status(400).json({ error: 'Invalid project data' });
  }

  const projectId = project.path_with_namespace;

  try {
    console.log(`[WEBHOOK] Processing MR !${iid} (${source_branch} → ${target_branch})`);

    // Run Claude review with MCP tools
    await runClaudeReview(projectId, iid);

    res.status(200).json({ message: 'Review triggered successfully' });
  } catch (error) {
    console.error(`[WEBHOOK] Error processing MR !${iid}:`, error.message);
    res.status(500).json({ error: 'Review failed' });
  }
});

module.exports = router;
