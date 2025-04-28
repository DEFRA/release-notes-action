'use strict'

const fs = require('fs')
const path = require('path')
const core = require('@actions/core')
const nunjucks = require('nunjucks')
const { execSync } = require('child_process')

/**
 * Extract ticket IDs from git commit history between branches
 *
 * @param {string} baseBranch - Base branch (e.g., 'master' or 'main')
 * @param {string} releaseBranch - Release branch
 * @param {string} ticketPattern - Regex pattern to extract ticket IDs
 * @returns {string[]} - Array of unique ticket IDs
 */
function extractTicketsFromGit (baseBranch, releaseBranch, ticketPattern) {
  core.info(`Extracting tickets from commits in ${releaseBranch} that are not in ${baseBranch}...`)

  // Command to get commits that are in releaseBranch but not in baseBranch
  const gitLogCommand = `git log ${baseBranch}..${releaseBranch} --pretty=format:"%s"`

  core.info(`Executing: ${gitLogCommand}`)
  const commitMessages = execSync(gitLogCommand).toString()

  // Extract ticket IDs using regex
  const regex = new RegExp(ticketPattern, 'g')
  const matches = commitMessages.match(regex) || []

  // Remove duplicates
  const uniqueTickets = [...new Set(matches)]
  core.info(`Extracted ${uniqueTickets.length} unique ticket IDs`)

  return uniqueTickets
}

/**
 * Main function to generate release notes
 */
async function run () {
  try {
    // Get inputs
    const templateFile = core.getInput('template-file', { required: true })
    const outputFile = core.getInput('output-file', { required: true })
    const releaseVersion = core.getInput('release-version', { required: true })
    const templateDataInput = core.getInput('template-data') || '{}'
    const baseBranch = core.getInput('base-branch') || 'master'
    const releaseBranch = core.getInput('release-branch', { required: true })
    const ticketPattern = core.getInput('ticket-pattern') || '[A-Z]+-[0-9]+'
    const gitUserName = core.getInput('git-user-name') || 'GitHub Action'
    const gitUserEmail = core.getInput('git-user-email') || 'action@github.com'

    // Parse template data
    let additionalTemplateData = {}
    try {
      additionalTemplateData = JSON.parse(templateDataInput)
      core.info('Successfully parsed template data JSON')
    } catch (parseError) {
      throw new Error(`Invalid JSON in template-data input: ${parseError.message}`)
    }

    // Check if template file exists
    if (!fs.existsSync(templateFile)) {
      core.info(`Template file not found: ${templateFile}`)
      return
    }

    // Extract tickets from git history
    const tickets = extractTicketsFromGit(baseBranch, releaseBranch, ticketPattern)

    // Configure Nunjucks
    nunjucks.configure({ autoescape: false })

    // Read template
    const templateStr = fs.readFileSync(templateFile, 'utf8')

    // Create context for template rendering
    // First set the required version field, then add any additional template data,
    // ensuring that additional data doesn't override the version
    const context = {
      releaseVersion,
      tickets,
      ...additionalTemplateData
    }

    // Render template
    const outputStr = nunjucks.renderString(templateStr, context)

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write output
    fs.writeFileSync(outputFile, outputStr)

    core.info(`Release notes generated successfully: ${outputFile}`)

    // Commit and push the changes
    try {
      // Add the generated file
      execSync(`git add "${outputFile}"`)

      // Commit with a standard message using command-line options for user details
      const commitMessage = `Add release notes for ${releaseVersion}`
      execSync(`git -c user.name="${gitUserName}" -c user.email="${gitUserEmail}" commit -m "${commitMessage}"`)

      // Push to the release branch
      execSync(`git push origin ${releaseBranch}`)

      core.info(`Successfully committed and pushed release notes to ${releaseBranch}`)
    } catch (gitError) {
      core.warning(`Failed to commit/push changes: ${gitError.message}`)
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`)
  }
}

run()
