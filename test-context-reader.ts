/**
 * Test script to verify the repository context reader
 * Run with: npx ts-node test-context-reader.ts
 */

import { scanRepositoryContext, formatRepoContextForPrompt } from './src/common/utils/repo-context-reader'

async function testContextReader() {
    console.log('Testing Repository Context Reader...\n')

    // Test on this repo itself
    const repoPath = process.cwd()
    console.log(`Scanning: ${repoPath}\n`)

    try {
        const context = scanRepositoryContext(repoPath, {
            maxFiles: 20,
            maxCharsPerFile: 5000,
            maxDepth: 3,
        })

        console.log('=== SCAN RESULTS ===')
        console.log(`Repository: ${context.repoFolderName}`)
        console.log(`Files scanned: ${context.totalFilesScanned}`)
        console.log(`Total characters: ${context.totalCharacters.toLocaleString()}`)
        console.log(`Summary: ${context.summary}`)
        console.log(`\nTop-level entries: ${context.topLevelEntries.join(', ')}`)

        console.log('\n=== FILES READ ===')
        context.keyFiles.forEach((file, idx) => {
            console.log(`${idx + 1}. ${file.relativePath} (${file.size} bytes, ${file.content.length} chars)`)
        })

        console.log('\n=== FILE TREE PREVIEW (first 500 chars) ===')
        console.log(context.fileTree.substring(0, 500))

        console.log('\n=== FORMATTED CONTEXT PREVIEW (first 1000 chars) ===')
        const formatted = formatRepoContextForPrompt(context)
        console.log(formatted.substring(0, 1000))
        console.log(`\n... (total ${formatted.length} characters)`)

        console.log('\n✅ Context reader test completed successfully!')
        console.log('\nNext steps:')
        console.log('1. Create a feature linked to a project')
        console.log('2. Generate QA test cases - check logs for "[QA] Scanned X files"')
        console.log('3. Verify test cases reference actual code from your repo')

    } catch (error) {
        console.error('❌ Error testing context reader:', error)
        process.exit(1)
    }
}

testContextReader()
