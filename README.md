# Release Notes Action

A GitHub Action to generate release notes from a Nunjucks template and a list of commits/tickets.

## Implementation Notes

This action includes the `node_modules` directory in the repository, which is generally not a recommended practice for regular Node.js projects. However, for GitHub Actions, this approach offers several benefits:

- **Reliability**: Ensures the action runs with exactly the same dependencies every time
- **Performance**: Eliminates the need to run `npm install` during action execution
- **Simplicity**: Reduces potential issues with npm registry availability or network connectivity
- **Consistency**: Guarantees the same behavior across all environments

GitHub Actions best practices recommend this approach for JavaScript/Node.js actions to ensure they work reliably in all environments.

## Features

- Generate release notes from a Nunjucks template
- Extract ticket IDs from git commit history between branches
- Support for database change indicators
- Automatically commit and push the generated release notes
- Customizable git user information for commits

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `template-file` | Path to the Nunjucks template file | Yes | |
| `output-file` | Path to output the generated release notes | Yes | |
| `release-version` | Release version number | Yes | |
| `template-data` | Additional data to pass to the template as JSON | No | `{}` |
| `base-branch` | Base branch to compare against (e.g., master or main) | No | `master` |
| `release-branch` | Release branch containing the changes | Yes | |
| `ticket-pattern` | Regex pattern to extract ticket IDs from commit messages. Use a wider pattern like `[A-Z]+-[0-9]+.*` to include the commit message text. | No | `[A-Z]+-[0-9]+` |
| `git-user-name` | Git user name for the commit | No | `GitHub Action` |
| `git-user-email` | Git user email for the commit | No | `action@github.com` |

## Example Usage

```yaml
name: Generate Release Notes

on:
  workflow_dispatch:
    inputs:
      release-version:
        description: 'Release version (e.g., 8.16.0)'
        required: true
      proposed_release_date:
        description: 'Release date (e.g., 2025-05-01)'
        required: true
      jira_release_id:
        description: 'Jira Release ID'
        required: true
      db-changes:
        description: 'Database changes included'
        type: 'boolean'
        default: false

jobs:
  generate-notes:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
        
      - name: Generate Release Notes
        uses: defra/release-notes-action@v2
        with:
          template-file: './release-docs/template.njk'
          output-file: './release-docs/CFF-${{ github.event.inputs.release-version }}.md'
          release-version: ${{ github.event.inputs.release-version }}
          template-data: |
            {
              "date": "${{ github.event.inputs.proposed_release_date }}",
              "id": "${{ github.event.inputs.jira_release_id }}",
              "dbChanges": ${{ github.event.inputs.db-changes }}
            }
          base-branch: 'master'
          release-branch: 'release/${{ github.event.inputs.release-version }}'
          ticket-pattern: 'FSR-[0-9]+.*'  # Include ticket ID and commit message
          git-user-name: 'GitHub Action'
          git-user-email: 'action@github.com'
```

## Template Format

The action expects a Nunjucks template file. Here's an example template:

```
# Check For Flooding Release

- Version: {{ releaseVersion }}
- Proposed Release Date: {{ date }}
- Jira Release Overview: https://eaflood.atlassian.net/projects/FSR/versions/{{ id }}/tab/release-report-all-issues

## Tickets

{% if tickets.length == 0 %}
No feature tickets included in this release
{% else %}
  {% for ticket in tickets %}
- {{ ticket }}
  {% endfor %}
{% endif %}

## Instructions

{% if dbChanges %}
1. Execute LFW_{STAGE}_02_UPDATE_DATABASE
1. Execute LFW_{STAGE}_04_UPDATE_FLOOD_APP_AND_SERVICE_PIPELINE
{% else %}
1. Execute LFW_{STAGE}_04_UPDATE_FLOOD_APP_AND_SERVICE_PIPELINE
{% endif %}

Execute smoke tests and forward results

## Related Infrastructure Changes Required

- None
```

Note that the template context contains `releaseVersion` and `tickets` as well
as the values passed in `template-data`

## Commit List Format

The action expects a file containing a list of commits/tickets, with one ticket per line. For example:

```
FSR-123
FSR-456
FSR-789
```

## Publishing the Action

1. Push this repository to GitHub
2. Create a specific version tag (e.g., `v1.7.2`):
   ```bash
   git tag -a v1.7.2 -m "Description of this release"
   git push origin v1.7.2
   ```
3. Update the major version tag to point to the latest release:
   ```bash
   git tag -f v1 v1.7.2
   git push -f origin v1
   ```
4. Reference the action in your workflows using either:
   - Specific version: `defra/release-notes-action@v1.7.2`
   - Major version: `defra/release-notes-action@v1` (always points to latest v1.x.x)
