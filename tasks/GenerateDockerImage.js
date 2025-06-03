const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const FOLDER_MARKER_VALUE = "__ASSISTOS_FOLDER_MARKER__";

const DOCKER_HUB_ORG_OR_USER = "assistoshectoride";
const GIT_REPO_URL = "git@github.com:DancaGabriel/HectorIDE-Projects.git";
const GIT_BRANCH = "main";
const GIT_BOT_USER_NAME = "DancaGabriel (AssistOS Bot)";
const GIT_BOT_USER_EMAIL = "danca.gabriel@outlook.com";

module.exports = {
    runTask: async function () {
        this.logInfo("Initializing task: Prepare project, generate Docker/CI, and push to Git...");
        const documentModule = await this.loadModule("document");
        const llmModule = await this.loadModule("llm");

        const runCommand = (command, args, cwd, envVars = {}) => {
            return new Promise((resolve, reject) => {
                this.logInfo(`>>> Running: ${command} ${args.join(' ')} in ${cwd}`);
                const proc = spawn(command, args, { cwd, shell: true, env: { ...process.env, ...envVars } });
                let stdout = '';
                let stderr = '';
                proc.stdout.on('data', (data) => {
                    this.logProgress(data.toString().trim());
                    stdout += data.toString();
                });
                proc.stderr.on('data', (data) => {
                    this.logWarning(data.toString().trim());
                    stderr += data.toString();
                });
                proc.on('close', (code) => {
                    if (code === 0) {
                        resolve(stdout);
                    } else {
                        reject(new Error(`Command failed with code ${code}:\n${stderr || stdout}`));
                    }
                });
                proc.on('error', (err) => {
                    this.logError(`Command execution error: ${err.message}`);
                    reject(err);
                });
            });
        };

        let tempDir;
        try {
            this.logInfo(`Parameters received: ${JSON.stringify(this.parameters, null, 2)}`);
            const { projectCodeMap, targetDocumentTitle } = this.parameters;

            if (!projectCodeMap || typeof projectCodeMap !== 'object' || Object.keys(projectCodeMap).length === 0) {
                throw new Error("Invalid or empty projectCodeMap received.");
            }
            if (!targetDocumentTitle) {
                throw new Error("targetDocumentTitle is required.");
            }

            const sanitizedProjectName = targetDocumentTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
            const imageNameBase = sanitizedProjectName || `project-${new Date().getTime()}`;
            const finalDockerImageName = `${DOCKER_HUB_ORG_OR_USER}/${imageNameBase}`;
            const gitCommitMessage = `Automated commit for project: ${targetDocumentTitle}`;

            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `assistos-git-${imageNameBase}-`));
            this.logInfo(`Created temporary base directory: ${tempDir}`);

            const projectRootInTemp = path.join(tempDir, imageNameBase);
            await fs.mkdir(projectRootInTemp, { recursive: true });
            this.logInfo(`Project files will be placed in subdirectory: ${projectRootInTemp}`);

            let hasDockerfile = false;
            this.logProgress("Recreating project file structure in subdirectory...");
            for (const [filePath, fileContent] of Object.entries(projectCodeMap)) {
                const fullPath = path.join(projectRootInTemp, filePath);
                if (fileContent === FOLDER_MARKER_VALUE) {
                    await fs.mkdir(fullPath, { recursive: true });
                } else {
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, fileContent || '');
                    if (path.basename(filePath).toLowerCase() === 'dockerfile') hasDockerfile = true;
                }
            }
            this.logInfo(`Wrote ${Object.keys(projectCodeMap).length} files to ${projectRootInTemp}`);

            let generatedDockerfileContent = null;
            const dockerfilePath = path.join(projectRootInTemp, 'Dockerfile');
            if (!hasDockerfile) {
                this.logInfo("Dockerfile not found. Generating one...");
                const projectFileNames = Object.keys(projectCodeMap)
                    .filter(p => projectCodeMap[p] !== FOLDER_MARKER_VALUE)
                    .map(p => path.basename(p))
                    .slice(0, 15)
                    .join(', ');

                const dockerfilePrompt = `
Generate a functional Dockerfile for a project titled "${targetDocumentTitle}".
The project primarily consists of files like: [${projectFileNames}].

Based on these file names (e.g., package.json suggests Node.js, requirements.txt suggests Python, go.mod suggests Go, etc.), please:
1.  Choose an appropriate official base image (e.g., python:3.9-slim, node:18-alpine).
2.  Set a WORKDIR, typically /app.
3.  **IMPORTANT for COPY:**
    a. If a common dependency file is present (like package.json, requirements.txt, go.mod, pom.xml), COPY it (and its lock file like go.sum or package-lock.json if applicable) first.
    b. RUN commands to install dependencies (e.g., npm install, pip install -r requirements.txt, go mod download).
    c. Then, use a single 'COPY . .' command to copy the rest of the application source code into the WORKDIR. **Do NOT attempt to COPY individual specific files (like config.go, main.go, etc.) unless they are the *only* files in the project.** Rely on 'COPY . .' for source code.
4.  If it's a web application, EXPOSE the typical port it might run on (e.g., 3000, 8000, 8080, 5000). If not obvious, you can omit EXPOSE or use a common default.
5.  Define a CMD or ENTRYPOINT to run the application. If the main command is not obvious from files like package.json or go.mod, use a generic CMD like: CMD ["echo", "Application for ${imageNameBase}. Update CMD to run."].

CRITICAL OUTPUT INSTRUCTIONS:
- Return ONLY the raw Dockerfile content.
- Do NOT include any explanations, surrounding text, or markdown formatting (NO \`\`\`dockerfile, NO \`\`\`).
- The response MUST start directly with the first Dockerfile instruction (e.g., "FROM ...").
`;
                const response = await llmModule.generateText(this.spaceId, dockerfilePrompt, { max_tokens: 1024 });

                let rawDockerfileResponse = (response && response.message && response.message.trim() !== "") ? response.message.trim() : "";
                if (rawDockerfileResponse) {
                    generatedDockerfileContent = rawDockerfileResponse
                        .replace(/^```[a-zA-Z]*\s*\n?/, '')
                        .replace(/\n?```$/, '')
                        .trim();
                    if (generatedDockerfileContent === "") {
                        this.logWarning("LLM returned empty or only markdown for Dockerfile. Using robust placeholder.");
                        generatedDockerfileContent = `FROM alpine\nLABEL maintainer="${GIT_BOT_USER_EMAIL}"\nWORKDIR /app\nCOPY . /app/\nCMD ["echo", "Dockerfile (LLM empty) for ${imageNameBase}. Please review."]`;
                    }
                } else {
                    this.logWarning("LLM failed to generate Dockerfile. Using robust placeholder.");
                    generatedDockerfileContent = `FROM alpine\nLABEL maintainer="${GIT_BOT_USER_EMAIL}"\nWORKDIR /app\nCOPY . /app/\nCMD ["echo", "Dockerfile (LLM failed) for ${imageNameBase}. Please review."]`;
                }
                await fs.writeFile(dockerfilePath, generatedDockerfileContent);
                this.logInfo(`Generated and wrote Dockerfile to ${dockerfilePath}`);
            } else {
                this.logInfo(`Using existing Dockerfile from project map at ${dockerfilePath}`);
                generatedDockerfileContent = await fs.readFile(dockerfilePath, 'utf-8');
            }

            this.logInfo("Generating GitHub Actions workflow...");
            const workflowsDir = path.join(tempDir, '.github', 'workflows');
            await fs.mkdir(workflowsDir, { recursive: true });
            const workflowFilePath = path.join(workflowsDir, `${imageNameBase}-docker-publish.yml`);

            const workflowPrompt = `
Generate a GitHub Actions workflow YAML file named '${imageNameBase}-docker-publish.yml'.
The workflow must perform the following actions:
1.  Trigger on push to the '${GIT_BRANCH}' branch, ONLY if there are changes within the '${imageNameBase}/' directory path.
2.  Define environment variables within the 'build_and_push' job:
    -   DOCKER_HUB_USERNAME: ${DOCKER_HUB_ORG_OR_USER}
    -   IMAGE_NAME: ${imageNameBase}
    -   PROJECT_SUBDIRECTORY: ${imageNameBase}
3.  Checkout the code using actions/checkout@v4.
4.  Set up Docker Buildx using docker/setup-buildx-action@v3.
5.  Log in to Docker Hub using docker/login-action@v3, with username from repository secret DOCKER_USERNAME and password from repository secret DOCKER_PASSWORD.
6.  Build the Docker image using docker/build-push-action@v5.
    -   The build 'context' MUST be './\${{ env.PROJECT_SUBDIRECTORY }}'.
    -   The 'file' (Dockerfile path) MUST be './\${{ env.PROJECT_SUBDIRECTORY }}/Dockerfile'.
    -   'push' MUST be true.
    -   'tags' should be a multi-line string, correctly formatted for YAML:
        \${{ env.DOCKER_HUB_USERNAME }}/\${{ env.IMAGE_NAME }}:latest
        \${{ env.DOCKER_HUB_USERNAME }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}

Return ONLY the raw, valid YAML content.
IMPORTANT FOR YAML SYNTAX:
- Each main YAML key (like 'name', 'on', 'jobs', 'env', 'steps') MUST start on a NEW LINE.
- Sub-keys and list items MUST also start on new lines and be indented correctly with spaces (usually 2).
- For example, the output MUST start similar to this structure:
name: Your Workflow Name Here
on:
  push:
    branches:
      - ${GIT_BRANCH}
    paths:
      - '${imageNameBase}/**'
jobs:
  build_and_push:
    runs-on: ubuntu-latest
    env:
      DOCKER_HUB_USERNAME: ${DOCKER_HUB_ORG_OR_USER}
      IMAGE_NAME: ${imageNameBase}
      PROJECT_SUBDIRECTORY: ${imageNameBase}
    steps:
      - name: Step 1 Name
        uses: actions/checkout@v4
      - name: Step 2 Name
        uses: docker/setup-buildx-action@v3

Do NOT include any explanations, comments, or markdown formatting (like \`\`\`yaml ... \`\`\`).
Start your response directly with 'name: ...'.
`;

            const workflowResponse = await llmModule.generateText(this.spaceId, workflowPrompt, { max_tokens: 2048 });

            let generatedWorkflowContent;
            const placeholderWorkflow = `name: Build and Push Docker Image for ${imageNameBase}
on:
  push:
    branches:
      - "${GIT_BRANCH}"
    paths:
      - '${imageNameBase}/**'

jobs:
  build_and_push:
    runs-on: ubuntu-latest
    env:
      DOCKER_HUB_USERNAME: ${DOCKER_HUB_ORG_OR_USER}
      IMAGE_NAME: ${imageNameBase}
      PROJECT_SUBDIRECTORY: ${imageNameBase}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./\${{ env.PROJECT_SUBDIRECTORY }}
          file: ./\${{ env.PROJECT_SUBDIRECTORY }}/Dockerfile
          push: true
          tags: |
            \${{ env.DOCKER_HUB_USERNAME }}/\${{ env.IMAGE_NAME }}:latest
            \${{ env.DOCKER_HUB_USERNAME }}/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
`;

            const llmOutput = workflowResponse && workflowResponse.message && workflowResponse.message.trim() !== "" ? workflowResponse.message.trim() : null;

            if (llmOutput && llmOutput.startsWith("name:") && llmOutput.includes("\non:") && llmOutput.includes("\njobs:") && llmOutput.includes("\n  build_and_push:") && llmOutput.includes("\n    steps:")) {
                generatedWorkflowContent = llmOutput;
                this.logInfo("Using LLM generated workflow content.");
            } else {
                if (llmOutput) {
                    this.logWarning("LLM generated workflow content seems malformed or incomplete. Falling back to placeholder.");
                    this.logInfo(`Malformed LLM Output for workflow (first 200 chars):\n${llmOutput.substring(0,200)}`);
                } else {
                    this.logWarning("LLM failed to generate GitHub Actions workflow or returned empty content. Using placeholder.");
                }
                generatedWorkflowContent = placeholderWorkflow;
            }
            await fs.writeFile(workflowFilePath, generatedWorkflowContent);
            this.logInfo(`Wrote GitHub Actions workflow to ${workflowFilePath}`);

            this.logProgress("Initializing Git repository and pushing...");
            await runCommand('git', ['init'], tempDir);
            await runCommand('git', ['config', 'user.name', `"${GIT_BOT_USER_NAME}"`], tempDir);
            await runCommand('git', ['config', 'user.email', `"${GIT_BOT_USER_EMAIL}"`], tempDir);
            await runCommand('git', ['branch', '-M', GIT_BRANCH], tempDir);
            await runCommand('git', ['add', '.'], tempDir);
            await runCommand('git', ['commit', '-m', `"${gitCommitMessage}"`], tempDir);

            let remoteExists = false;
            try {
                await runCommand('git', ['remote', 'get-url', 'origin'], tempDir);
                remoteExists = true;
            } catch (e) { /* origin nu există */ }

            if (remoteExists) {
                await runCommand('git', ['remote', 'set-url', 'origin', GIT_REPO_URL], tempDir);
            } else {
                await runCommand('git', ['remote', 'add', 'origin', GIT_REPO_URL], tempDir);
            }

            const gitSshCommand = "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null";
            this.logProgress(`Pushing to Git repository: ${GIT_REPO_URL} on branch ${GIT_BRANCH}...`);
            await runCommand('git', ['push', '--force', '--set-upstream', 'origin', GIT_BRANCH], tempDir, { GIT_SSH_COMMAND: gitSshCommand });
            this.logSuccess(`Successfully pushed to Git repository: ${GIT_REPO_URL} on branch ${GIT_BRANCH}`);

            let summaryDocumentId = null;
            try {
                const summaryDocTitle = `${targetDocumentTitle} - Deployment Kit`;
                let summaryContent = `Project files for '${imageNameBase}' prepared. Pushed to: ${GIT_REPO_URL} (branch: ${GIT_BRANCH})\n\n`;
                summaryContent += `Image to be built on Docker Hub: ${finalDockerImageName}:latest\n\n`;
                let dockerfileToDisplay = "";
                if(generatedDockerfileContent && !hasDockerfile){
                    dockerfileToDisplay = generatedDockerfileContent;
                    summaryContent += `Generated Dockerfile:\n\`\`\`dockerfile\n${dockerfileToDisplay}\n\`\`\`\n\n`;
                } else if (hasDockerfile) {
                    dockerfileToDisplay = await fs.readFile(dockerfilePath, 'utf-8');
                    summaryContent += `Used existing Dockerfile from project:\n\`\`\`dockerfile\n${dockerfileToDisplay}\n\`\`\`\n\n`;
                } else if (generatedDockerfileContent) {
                    dockerfileToDisplay = generatedDockerfileContent;
                    summaryContent += `Generated (Placeholder) Dockerfile:\n\`\`\`dockerfile\n${dockerfileToDisplay}\n\`\`\`\n\n`;
                }

                summaryContent += `Generated GitHub Actions Workflow (${path.basename(workflowFilePath)}):\n\`\`\`yaml\n${generatedWorkflowContent}\n\`\`\`\n`;

                summaryDocumentId = await documentModule.addDocument(this.spaceId, {
                    title: summaryDocTitle, type: 'deployment_kit_summary', content: summaryContent,
                    abstract: JSON.stringify({ preparedAt: new Date().toISOString(), imageName: finalDockerImageName, gitRepo: GIT_REPO_URL, gitBranch: GIT_BRANCH }, null, 2)
                });
                this.logInfo(`Created summary document for deployment kit: ${summaryDocumentId}`);
            } catch (docError) { this.logWarning(`Could not create summary document: ${docError.message}`); }

            this.logSuccess(`Project files prepared and pushed. Temp path: ${tempDir}`);
            return {
                status: 'completed', preparedProjectPath: tempDir,
                suggestedImageName: finalDockerImageName,
                gitPushStatus: `Pushed to ${GIT_REPO_URL} (branch ${GIT_BRANCH})`,
                summaryDocumentId: summaryDocumentId
            };
        } catch (error) {
            this.logError(`Error in task: ${error.message}`);
            console.error("Task Error Details:", error);
            if (tempDir) { try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { this.logError(`Cleanup failed: ${e.message}`);}}
            throw error;
        }
    },
    cancelTask: async function () { this.logWarning("Task cancelled by user"); },
    serialize: async function () {
        return { taskType: 'ProjectGitDeployerV2', parameters: { projectCodeMap: this.parameters.projectCodeMap, targetDocumentTitle: this.parameters.targetDocumentTitle } };
    },
    getRelevantInfo: async function () {
        return { taskType: 'ProjectGitDeployerV2', parameters: { targetDocumentTitle: this.parameters?.targetDocumentTitle, projectFileCount: this.parameters?.projectCodeMap ? Object.keys(this.parameters.projectCodeMap).length : 0 } };
    }
};