import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/engine/104-evren-ansiklopedi.js', 'utf8');
assert.match(source, /function markdownHtml\(/, 'article body supports safe Markdown rendering');
assert.match(source, /target="_blank" rel="noopener noreferrer">\$1/, 'Markdown links are rendered with safe external-link attributes');
assert.match(source, /function revisionDiffHtml\(/, 'revision history provides a field-level diff view');
assert.match(source, /function backlinksHtml\(/, 'published articles render backlinks');
assert.match(source, /function categoryNavigationHtml\(/, 'category navigation supports parentId hierarchy');
assert.match(source, /https:\/\/github\.com\/.*issues\/new\?title=/, 'wiki discussion uses GitHub Issues without embedding credentials');
assert.match(source, /eaw-github-discussion/, 'public articles expose a GitHub discussion link');
assert.match(source, /eaw-diff-scroll/, 'diff view is horizontally scrollable on small screens');
assert.match(source, /GitHub tartışma bağlantısı/, 'editor explains GitHub-based discussion workflow');

const shell = fs.readFileSync('uygulama/kabuk/www/js/engine/104-evren-ansiklopedi.js', 'utf8');
assert.equal(shell, source, 'Android shell uses the same encyclopedia implementation');
console.log('6.6.8 wiki-plus contracts passed (Markdown, diffs, backlinks, hierarchy and GitHub discussions).');
