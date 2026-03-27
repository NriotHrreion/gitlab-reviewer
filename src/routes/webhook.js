const express = require('express');
const { runClaudeReview, runClaudeMentionReply, runClaudeIssueFix } = require('../services/claude');

const router = express.Router();

// Validate TARGET_BRANCHES is set at startup
if (!process.env.TARGET_BRANCHES) {
  throw new Error('TARGET_BRANCHES environment variable is required');
}

// Validate CLAUDE_MENTION_USERNAME is set at startup
if (!process.env.CLAUDE_MENTION_USERNAME) {
  throw new Error('CLAUDE_MENTION_USERNAME environment variable is required');
}

// Validate CLAUDE_LANGUAGE is set at startup
if (!process.env.CLAUDE_LANGUAGE) {
  throw new Error('CLAUDE_LANGUAGE environment variable is required');
}


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  console.log("[WEBHOOK] Received MR event:", object_attributes);

  // Only handle merge request, note, and issue events
  if (object_kind === 'note') {
    // Handle mention-triggered reply
    const { noteable_type, noteable_iid, note, id: noteId, discussion_id: discussionId } = object_attributes;

    // Validate object_attributes structure
    if (!object_attributes || typeof noteable_type !== 'string') {
      console.log(`[WEBHOOK] Invalid note data`);
      return res.status(400).json({ error: 'Invalid note data' });
    }

    // Only handle comments on MRs
    if (noteable_type !== 'MergeRequest') {
      console.log(`[WEBHOOK] Ignored: not a merge request comment`);
      return res.status(200).json({ message: 'Ignored: not a merge request comment' });
    }

    // Validate project structure
    if (!project || typeof project.path_with_namespace !== 'string') {
      console.log(`[WEBHOOK] Invalid project data`);
      return res.status(400).json({ error: 'Invalid project data' });
    }

    const projectId = project.path_with_namespace;
    const mentionPattern = new RegExp(`@${escapeRegExp(process.env.CLAUDE_MENTION_USERNAME)}`);

    // Check if comment mentions claude
    if (!mentionPattern.test(note)) {
      console.log(`[WEBHOOK] Ignored: no mention of @${process.env.CLAUDE_MENTION_USERNAME}`);
      return res.status(200).json({ message: 'Ignored: no mention' });
    }

    console.log(`[WEBHOOK] Mention detected in MR !${noteable_iid}, triggering reply`);

    try {
      await runClaudeMentionReply(projectId, noteable_iid, discussionId, noteId, note);
      res.status(200).json({ message: 'Reply triggered successfully' });
    } catch (error) {
      console.error(`[WEBHOOK] Error processing mention in MR !${noteable_iid}:`, error.message);
      res.status(500).json({ error: 'Reply failed' });
    }
    return;
  }

  if (object_kind === 'issue') {
    // Handle issue-triggered sandbox review
    const { state, action, iid, title, description } = object_attributes;
    const assignees = req.body.assignees || [];

    // Only process opened issues with action "open" or "update"
    if (!['open', 'reopen'].includes(action)) {
      console.log(`[WEBHOOK] Ignored: issue action is "${action}", expected "open" or "update"`);
      return res.status(200).json({ message: 'Ignored: issue action not open or update' });
    }

    // Validate object_attributes structure
    if (!object_attributes || typeof state !== 'string') {
      console.log(`[WEBHOOK] Invalid issue data`);
      return res.status(400).json({ error: 'Invalid issue data' });
    }

    // Only process opened issues
    if (state !== 'opened') {
      console.log(`[WEBHOOK] Ignored: issue not opened`);
      return res.status(200).json({ message: 'Ignored: issue not opened' });
    }

    // Check if issue is assigned to claude
    const isAssignedToClaude = (assignees || []).some(a => a.username === process.env.CLAUDE_MENTION_USERNAME);
    if (!isAssignedToClaude) {
      console.log(`[WEBHOOK] Ignored: issue not assigned to @${process.env.CLAUDE_MENTION_USERNAME}`);
      return res.status(200).json({ message: 'Ignored: issue not assigned to claude' });
    }

    // Validate project structure
    if (!project || typeof project.path_with_namespace !== 'string' || typeof project.web_url !== 'string') {
      console.log(`[WEBHOOK] Invalid project data`);
      return res.status(400).json({ error: 'Invalid project data' });
    }

    const projectPath = project.path_with_namespace;
    const projectUrl = project.web_url;

    try {
      console.log(`[WEBHOOK] Processing issue #${iid} (${title})`);
      await runClaudeIssueFix(projectPath, projectUrl, iid, title, description || '');
      res.status(200).json({ message: 'Issue fix triggered successfully' });
    } catch (error) {
      console.error(`[WEBHOOK] Error processing issue #${iid}:`, error.message);
      res.status(500).json({ error: 'Issue fix failed' });
    }
    return;
  }

  if (object_kind !== 'merge_request') {
    console.log(`[WEBHOOK] Ignored: not a merge request or note event`);
    return res.status(200).json({ message: 'Ignored: not a merge request or note event' });
  }

  // Validate object_attributes structure
  if (!object_attributes || typeof object_attributes.state !== 'string') {
    console.log(`[WEBHOOK] Invalid merge request data`);
    return res.status(400).json({ error: 'Invalid merge request data' });
  }

  const { source_branch, target_branch, iid, state } = object_attributes;

  // Only review when MR is opened or updated
  if (!['opened', 'updated'].includes(state)) {
    console.log(`[WEBHOOK] Ignored: MR not opened or updated`);
    return res.status(200).json({ message: 'Ignored: MR not opened or updated' });
  }

  // Check if target branch is in allowed list
  if (!isTargetBranch(target_branch)) {
    console.log(`[WEBHOOK] Ignored: ${target_branch} not in target branches`);
    return res.status(200).json({ message: 'Ignored: target branch not in list' });
  }

  // Validate project structure
  if (!project || typeof project.path_with_namespace !== 'string') {
    console.log(`[WEBHOOK] Invalid project data`);
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
