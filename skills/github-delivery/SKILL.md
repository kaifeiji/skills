---
name: github-delivery
description: 'GitHub read and delivery workflows with gh CLI. Use when the user asks to inspect repositories, issues, pull requests, commits, releases, or Actions runs, or to create or switch a branch, commit changes, push a branch, or open a pull request.'
argument-hint: 'repository, issue or PR number, change to deliver, optional branch name, PR base, title, or body'
---

# GitHub Delivery

Use `git` for local repository operations and `gh` for GitHub operations. Complete only the stages the user requested. For read-only requests, skip local delivery steps and make no changes. A pull request requires a committed, pushed branch.

## Repository identity

The Experience Builder framework and extensions are separate repositories:

| Repository | Canonical remote | Expected location |
| --- | --- | --- |
| Framework | `git@devtopia.esri.com:Beijing-R-D-Center/ExperienceBuilder.git` | Repository root |
| Extensions | `git@devtopia.esri.com:Beijing-R-D-Center/ExperienceBuilder-Web-Extensions.git` | `<framework-root>\client\extensions` |

Treat the remote URL as authoritative; the extensions folder's location inside the framework tree does not make it part of the framework repository.

- Before any Git operation, identify the target path, then run `git -C <target-path> rev-parse --show-toplevel` and `git -C <target-path> remote get-url origin`. Match the result to the intended repository above; do not infer repository identity from the current directory or folder name.
- For GitHub operations, use the matching `owner/repo` explicitly when the command supports `--repo`. For `gh api`, scope the endpoint to the matching repository.
- If the target path resolves to the framework root when an extension-repository operation was requested, or the remote does not match the intended repository, stop and clarify rather than operating on the other repository.
- If a task touches both repositories, inspect, stage, commit, push, and report each repository separately. If the requested repository is unclear, ask before making changes.

## Workflow

1. **Resolve the repository, host, and authentication.**
   - Use an explicit repository from the request when provided. Otherwise identify the local repository using the Repository identity rules above, or use the current `gh` repository context for GitHub-only reads. If the target is ambiguous, ask before proceeding.
   - Infer the host from the target. For `devtopia.esri.com`, use that hostname for `gh auth status` and authentication; otherwise use the remote's GitHub host or the current `gh` host.
   - Check authentication with `gh auth status --hostname <host>`. If authentication is missing, ask the user to complete `gh auth login --hostname <host> --web`, then verify status again.
   - Keep credentials out of command arguments, chat, logs, and repository files.
   - Completion criterion: the target repository and host are unambiguous, and `gh` is authenticated to that host.

2. **Read GitHub data when requested.**
   - Prefer purpose-built `gh` commands: `gh repo view`, `gh issue view/list`, `gh pr view/list/diff/checks`, `gh run list/view`, and `gh release view/list`.
   - Use `gh api` for read-only data not exposed by those commands, such as commits or repository file contents. Scope API requests to the resolved repository and requested resource.
   - For list requests, apply the user's filters and a bounded result limit. For a specific issue, PR, run, or file, query that item directly.
   - Report findings from the returned data, link to the relevant GitHub page when available, and distinguish missing or inaccessible data from an empty result.
   - Completion criterion: the requested information is retrieved from the intended repository and the response identifies its source and relevant state.

3. **Inspect the delivery scope when changes are requested.**
   - Run `git status --short --branch`, inspect staged and unstaged diffs, and identify untracked files.
   - Inspect the `origin` remote and recent commit-message conventions.
   - Separate the requested changes from unrelated or pre-existing work. If the intended changes cannot be isolated safely, ask which files to include.
   - If there are no changes to deliver, stop before creating a branch, empty commit, push, or PR; report that the worktree is clean.
   - Completion criterion: the exact files and changes intended for delivery are known, and no unrelated work will be included.

4. **Create or select the requested branch.**
   - Honor an explicit branch name from the user. Otherwise, for either Experience Builder repository, use `f-he-{module}-{issue_number}`.
   - Resolve `{module}` from the changed code's owning directory: in the extensions repository use the widget directory under `client/extensions/widgets/<widget-name>`; in `client/jimu-ui/lib/components/<component-name>`, `client/jimu-ui/basic/lib/<component-name>`, or `client/jimu-ui/advanced/lib/<component-name>` use the component directory; elsewhere use the owning module directory name (for example, `client/jimu-core` maps to `jimu-core`).
   - If the changes span multiple widgets/modules or target shared extension or `jimu-ui/lib` code without one clear widget/component name, ask which module name to use. Use the issue number explicitly provided by the user or the issue being handled; ask for it if unavailable rather than inventing one.
   - Check local and remote branch names before creating one. Reuse an existing branch only when it clearly belongs to this task; otherwise ask before switching or overwriting work.
   - Create a new branch with `git switch -c <branch>` when requested and safe.
   - Completion criterion: the current branch is the requested branch or follows `f-he-{module}-{issue_number}`, with the original work preserved.

5. **Stage and commit the intended changes.**
   - Stage only the reviewed files; do not stage the entire worktree when it contains unrelated changes.
   - Review `git diff --cached`, run `git diff --cached --check`, and run relevant project checks when practical.
   - Format the commit subject as `type({module}): <subject>`, placing `({module})` immediately after the type. Use the same module resolved for the branch name and the repository's established type convention; keep the subject brief and limited to the essential change. Create a new commit; amend only when explicitly requested.
   - If staged changes contain unrelated work, or checks fail, stop and resolve the issue before committing.
   - Completion criterion: the commit contains only the intended changes, has a clear message, and its hash is recorded.

6. **Push and open the pull request when requested.**
   - Push with `git push -u origin <branch>`. Do not force-push; if a non-fast-forward or permission error occurs, stop and report it.
   - Before creating a PR, check whether one already exists for the branch. Use the requested base, title, and body; otherwise infer the base from the repository default branch and draft a brief title and body that state only the essential change and relevant checks.
   - Create the PR with `gh pr create`, relying on the checked-out repository context. For non-default hosts, verify that `gh` is targeting the host identified from `origin`.
   - Completion criterion: the branch is pushed and, when requested, `gh pr view` confirms the PR's URL, base, head, and state.

## Handoff

For read-only requests, summarize the findings and link the relevant GitHub pages. For delivery, report the branch, commit hash, push result, and PR URL when created. Distinguish completed steps from blocked or unrequested steps, and state any checks that were not run.
