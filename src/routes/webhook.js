const express = require('express');
const { getMRDiff, postMRComment } = require('../services/gitlab');
const { runClaudeReview } = require('../services/claude');

const router = express.Router();

function isTargetBranch(targetBranch) {
  const allowedBranches = process.env.TARGET_BRANCHES.split(',').map(b => b.trim());
  return allowedBranches.includes(targetBranch);
}

router.post('/webhook', async (req, res) => {
  const { object_kind, project, object_attributes } = req.body;

  // Only handle merge request events
  if (object_kind !== 'merge_request') {
    return res.status(200).json({ message: 'Ignored: not a merge request' });
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

  const projectId = project.path_with_namespace;

  try {
    console.log(`[WEBHOOK] Processing MR !${iid} (${source_branch} → ${target_branch})`);

    // Fetch diff
    const diff = await getMRDiff(projectId, iid);

    if (!diff) {
      console.log(`[WEBHOOK] No diff fetched for MR !${iid}`);
      return res.status(200).json({ message: 'No changes in MR' });
    }

    // Run Claude review
    const review = await runClaudeReview(diff);

    // Post comment
    const commentBody = `## Claude Code Review\n\n${review}`;
    await postMRComment(projectId, iid, commentBody);

    res.status(200).json({ message: 'Review posted successfully' });
  } catch (error) {
    console.error(`[WEBHOOK] Error processing MR !${iid}:`, error.message);
    res.status(500).json({ error: 'Review failed' });
  }
});

module.exports = router;
