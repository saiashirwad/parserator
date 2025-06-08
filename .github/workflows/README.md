# GitHub Actions Workflows

This directory contains automated workflows for the Parserator project.

## Workflows

### 1. CI/CD (`ci-cd.yml`)

The main continuous integration and deployment workflow that runs on:
- Push to main/master branches
- Pull requests
- Version tags (v*)
- Manual dispatch

**Jobs:**
- **test**: Runs tests across multiple Node.js versions (18.x, 20.x)
  - Type checking
  - Building
  - Testing
  - Format checking
- **publish-npm**: Automatically publishes to npm when a version tag is pushed
  - Requires `NPM_TOKEN` secret
- **build-docs**: Builds documentation (ready for VitePress integration)

### 2. Release (`release.yml`)

Manual release workflow for creating new versions with proper versioning and tagging.

**Features:**
- Interactive version selection (patch/minor/major)
- Dry-run mode for testing
- Automatic git tagging
- NPM publishing
- GitHub release creation
- Comprehensive summary

**Usage:**
1. Go to Actions → Release
2. Click "Run workflow"
3. Select version type and optionally enable dry-run
4. Review and confirm

### 3. PR Validation (`pr-validation.yml`)

Comprehensive validation for pull requests.

**Features:**
- Full test suite execution
- Cross-platform compatibility testing (Ubuntu, Windows, macOS)
- Multiple Node.js version testing
- Package size reporting
- Format validation

## Setup Instructions

### 1. NPM Token

To enable automated npm publishing:

1. Create an npm access token:
   - Log in to [npmjs.com](https://www.npmjs.com/)
   - Go to Account Settings → Access Tokens
   - Generate a new token (Automation type recommended)

2. Add to GitHub secrets:
   - Go to Settings → Secrets and variables → Actions
   - Create new secret named `NPM_TOKEN`
   - Paste your npm token

### 2. GitHub Pages (Future)

For future documentation deployment:

1. Enable GitHub Pages:
   - Go to Settings → Pages
   - Source: GitHub Actions

2. The workflow already includes commented sections for VitePress deployment

## Usage Examples

### Automated Release via Tags

```bash
# Create and push a version tag
git tag v0.1.34
git push origin v0.1.34
```

This will trigger the CI/CD workflow to automatically publish to npm.

### Manual Release

1. Go to Actions → Release
2. Run workflow with desired version bump
3. Optionally use dry-run to preview changes

### Local Version Bumping

The existing npm scripts still work:

```bash
# Patch release (0.1.33 → 0.1.34)
bun run release:patch

# Minor release (0.1.33 → 0.2.0)
bun run release:minor

# Major release (0.1.33 → 1.0.0)
bun run release:major
```

## Future Enhancements

### VitePress Documentation

The workflows are pre-configured for VitePress documentation. To enable:

1. Set up VitePress:
   ```bash
   bun add -D vitepress
   ```

2. Create docs structure:
   ```
   docs/
   ├── .vitepress/
   │   └── config.ts
   ├── index.md
   └── guide/
       └── getting-started.md
   ```

3. Add scripts to package.json:
   ```json
   {
     "scripts": {
       "docs:dev": "vitepress dev docs",
       "docs:build": "vitepress build docs",
       "docs:preview": "vitepress preview docs"
     }
   }
   ```

4. Uncomment the docs deployment sections in `ci-cd.yml`

### Changelog Generation

Consider adding automatic changelog generation:

1. Install conventional-changelog:
   ```bash
   bun add -D conventional-changelog-cli
   ```

2. Add to release workflow for automatic changelog updates

### Coverage Reports

Add test coverage reporting:

1. Configure your test runner for coverage
2. Add coverage upload to workflows
3. Integrate with services like Codecov

## Troubleshooting

### NPM Publishing Fails

- Ensure `NPM_TOKEN` is correctly set in GitHub secrets
- Verify the token has publish permissions
- Check if the version already exists on npm

### Workflow Not Triggering

- Check branch protection rules
- Verify workflow file syntax
- Ensure proper permissions in repository settings

### Test Failures

- Review the workflow logs for specific errors
- Test locally with the same Node.js version
- Check for platform-specific issues