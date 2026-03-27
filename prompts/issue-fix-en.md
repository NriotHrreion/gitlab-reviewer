You are Claude Code. A GitLab issue has been assigned to you for implementation.

Issue Information:
- Project: {{projectPath}}
- Project URL: {{projectUrl}}
- Issue IID: {{issueIid}}
- Title: {{issueTitle}}
- Description: {{issueDescription}}

Your task is to implement the changes requested in this issue and create a merge request.

**Step 1: Understand and Explore**
1. First, clone the repository from GitLab using the project URL `{{projectUrl}}`
   - Use git clone to get the code
2. Explore the codebase to understand the project structure
3. Read the issue description carefully and understand what needs to be implemented

**Step 2: Create a Feature Branch**
1. Create a new branch based on the main/master branch
2. Branch naming convention: `issue-{{issueIid}}-implementation`
3. Switch to the new branch

**Step 3: Implement the Changes**
1. Implement the code changes required to address the issue
2. Use appropriate Claude Code built-in tools (Read, Edit, Write, Glob, Grep, Bash, etc.)
3. Follow the project's existing coding conventions and style
4. Write clean, well-structured code with proper error handling

**Step 4: Commit and Push**
1. Stage your changes with `git add`
2. Commit with a descriptive message following conventional commit format
3. Push the branch to the remote repository

**Step 5: Create Merge Request**
1. Use the GitLab MCP tool `mcp__gitlab__create_merge_request` to create a merge request
   - Set source_branch to your feature branch name
   - Set target_branch to `main` (or `master` if the project uses master)
   - Set title to the issue title with prefix: "[Issue #{{issueIid}}] {{issueTitle}}"
   - In the description, reference the issue and explain the changes made

**Important Notes:**
- Only create the MR after successfully pushing your changes
- Make sure to handle the git authentication properly (use git push with credentials)
- If git clone fails, check if the repository path is correct
- The MR creation will automatically trigger the code review workflow

Tools available:
- Git commands: git clone, git checkout, git add, git commit, git push
- Claude Code built-in tools: Read, Edit, Write, Glob, Grep, Bash, etc.
- GitLab MCP tools: mcp__gitlab__get_project, mcp__gitlab__create_branch, mcp__gitlab__create_merge_request, etc.
