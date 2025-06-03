const path = require('path');

module.exports = {
    extractCodeAndStructureFromAppDoc: async function(documentModule, spaceId, appDocId) {
        this.logInfo(`Loading source application document for QA: ${appDocId}`);
        const appDoc = await documentModule.getDocument(spaceId, appDocId);

        if (!appDoc || !appDoc.chapters || !Array.isArray(appDoc.chapters)) {
            throw new Error(`Source application document ${appDocId} is invalid or has no chapters.`);
        }

        let originalStructureText = "";
        const appFiles = [];
        let structureChapterFound = false;
        let sourceAppAbstract = {};

        if (typeof appDoc.abstract === 'string') {
            try {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = appDoc.abstract;
                let decodedAbstract = textarea.value;
                decodedAbstract = decodedAbstract.replace(/\n|\r|\s+/g, ' ').trim();
                if(decodedAbstract){ sourceAppAbstract = JSON.parse(decodedAbstract); }
            } catch (e) { this.logWarning(`Could not parse abstract from source app document ${appDocId}: ${e.message}`); }
        } else if (appDoc.abstract && typeof appDoc.abstract === 'object') {
            sourceAppAbstract = appDoc.abstract;
        }

        for (const chapter of appDoc.chapters) {
            const chapterTitle = chapter.title || "";
            if (chapterTitle === "Project Structure" || chapterTitle === "Project Structure (with Tests)" || chapterTitle === "Updated Project Structure (with Tests)") {
                if (chapter.paragraphs && chapter.paragraphs[0] && chapter.paragraphs[0].text) {
                    originalStructureText = chapter.paragraphs[0].text;
                    structureChapterFound = true;
                }
            } else if (chapterTitle && chapter.paragraphs && chapter.paragraphs[0] && chapter.paragraphs[0].text &&
                !chapterTitle.includes("Summary") && !chapterTitle.includes("Fallback") &&
                !chapterTitle.toLowerCase().startsWith("tests/") && !chapterTitle.toLowerCase().includes("/test") &&
                (chapterTitle.includes("/") || chapterTitle.includes("\\") || /\.\w+$/.test(chapterTitle) || ['Makefile','Dockerfile','README','LICENSE'].includes(chapterTitle)) ) {
                appFiles.push({
                    path: chapterTitle,
                    code: chapter.paragraphs[0].text
                });
            }
        }

        if (!structureChapterFound) {
            this.logWarning(`'Project Structure' chapter not found in document ${appDocId}. Structure context will be missing.`);
        }
        if (appFiles.length === 0) {
            this.logWarning(`No application code file chapters found in document ${appDocId}. Application code context will be missing.`);
        }

        this.logInfo(`Extracted structure and ${appFiles.length} code files from ${appDocId}.`);
        return { originalStructureText, appFiles, sourceAppAbstract };
    },

    constructTestStructureUpdatePrompt: function(originalStructureText, appFilePaths, testParams) {
        const { testType, programmingLanguage, testFramework, specificFocus } = testParams;
        const appFilesList = appFilePaths.map(p => `- ${p}`).join('\n');

        return `
You are an expert Software Architect specializing in testing practices.
You are given an existing project structure for an application written primarily in **${testParams.appProgrammingLanguage || programmingLanguage}**.
Your task is to *update* this structure to include necessary directories and files for writing **${testType}** tests in **${programmingLanguage}**.

**Existing Application Project Structure:**
\`\`\`
${originalStructureText || "No original structure provided."}
\`\`\`

**List of Existing Application Files (for context):**
${appFilesList || "No file list provided."}

**Testing Requirements:**
- Test Type: **${testType}**
- Test Programming Language: **${programmingLanguage}**
- Test Framework (if specified): ${testFramework || "None specified (use language defaults)"}
- Specific Focus (if specified): ${specificFocus || "General application coverage"}

**Instructions:**

1.  Analyze the existing structure and testing requirements.
2.  Determine the conventional location and naming for **${testType}** test files in **${programmingLanguage}** (e.g., a \`tests/\` directory at the root, potentially with subdirectories like \`unit/\`, \`integration/\`, \`api/\`).
3.  Propose appropriate names for the test files (e.g., \`test_*.py\`, \`*.test.js\`, \`*Test.java\`, \`*_spec.rb\`). The test files should ideally correspond to the application files/modules they are testing. Use forward slashes ('/') for paths.
4.  Integrate these new test directories and files seamlessly into the existing structure tree.
5.  **Output ONLY the complete, updated project structure tree**, including both the original application files and the new test files/directories. Use standard ASCII characters for the tree. Ensure all file paths are complete starting from the root. Do not include any explanations or introductory text.

**Example Output Format (Illustrative):**
\`\`\`
my_application/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   └── user.py
│   └── services/
│       └── user_service.py
├── tests/
│   ├── __init__.py
│   ├── unit/
│   │   ├── __init__.py
│   │   └── test_user_service.py
│   └── api/
│       ├── __init__.py
│       └── test_auth_api.py
├── config.py
└── run.py
\`\`\`

Now, generate the updated project structure tree including the new test files based on the requirements.
`;
    },

    constructFullPathListPrompt: function(generatedTreeStructure, programmingLanguage) {
        return `
You are a text processing utility. You are given an ASCII representation of a project directory structure that includes application and test files.
Your task is to extract all and only the **full file paths** (for both application and test files) from this structure.

**Input Directory Structure Tree:**
\`\`\`
${generatedTreeStructure}
\`\`\`

**Instructions:**

1.  Parse the input tree structure.
2.  Identify all lines that represent files (not directories). Files usually have extensions (like .py, .js, .cs, .java) or are known filenames without extensions (like Makefile, README, Dockerfile). Ignore directory lines.
3.  For each identified file, reconstruct its full path starting from the root directory shown in the tree.
4.  Use forward slashes ('/') as directory separators.
5.  **Output ONLY a flat list of these full file paths, one path per line.**
6.  Do not include any introductory text, comments, explanations, or directory paths in the output.

Now, process the provided "Input Directory Structure Tree" and output the flat list of full file paths.
`;
    },

    constructTestFileCodeGenPrompt: function(appCodeContext, updatedStructureText, targetTestFilePath, testParams) {
        const { testType, programmingLanguage, testFramework, specificFocus } = testParams;
        const MAX_APP_CONTEXT_LENGTH = 8000;
        let contextToSend = appCodeContext;
        if (contextToSend.length > MAX_APP_CONTEXT_LENGTH) {
            contextToSend = contextToSend.substring(0, MAX_APP_CONTEXT_LENGTH) + "\n... (Application code truncated)";
        }

        return `
You are a world-class Software Test Engineer and Senior **${programmingLanguage}** Developer.
Your task is to write the specific code for the test file located at the path "**${targetTestFilePath}**".
This file should contain **${testType}** tests.

**Application Code Context (Concatenated or Summarized):**
\`\`\`${testParams.appProgrammingLanguage || programmingLanguage}
${contextToSend || "No application code context provided."}
\`\`\`

**Full Project Structure (Including Tests):**
\`\`\`
${updatedStructureText || "Project structure not available."}
\`\`\`

**Test Generation Details:**
- Target Test File Path: **${targetTestFilePath}**
- Test Type: **${testType}**
- Test Programming Language: **${programmingLanguage}**
- Test Framework: ${testFramework || "Standard library or language default testing tools"}
- Specific Focus: ${specificFocus || "Test functionality relevant to the file path"}

**Your Task & Detailed Instructions:**

1.  **Implement Test File Content:**
    * Write complete, operational code in **${programmingLanguage}** for the test file "**${targetTestFilePath}**".
    * Focus on writing **${testType}** tests relevant to the application modules suggested by the file path (e.g., if path is \`tests/unit/test_user_service.py\`, test the \`user_service.py\` module).
    * Use the specified **${testFramework}** conventions if provided, otherwise use standard **${programmingLanguage}** testing practices.
    * Ensure all necessary imports/includes are present at the beginning of the code. Crucially, import the application modules being tested using correct relative paths based on the provided **Full Project Structure**. For example, from \`tests/unit/test_user_service.py\` you might need \`from app.services.user_service import UserService\` or similar, depending on the structure and language.
    * Implement relevant test cases (functions or methods) based on the **Test Type** and **Specific Focus**.
    * Use assertions appropriate for the language/framework.
    * Include setup/teardown logic if necessary (e.g., mocking dependencies, initializing resources).

2.  **Code Quality & Best Practices:**
    * Adhere strictly to idiomatic **${programmingLanguage}** testing best practices.
    * Write clean, efficient, readable, and maintainable test code.
    * Include meaningful comments only where necessary to explain complex test logic or setup.

3.  **Contextual Awareness:**
    * Use the **Application Code Context** and **Full Project Structure** to understand what needs to be tested and how to import/reference it correctly.
    * Assume the application code in other files exists as implied by the structure.

4.  **Mocking & Dependencies:**
    * For Unit Tests, mock external dependencies (database, network calls, other services) appropriately using standard libraries for **${programmingLanguage}** (e.g., \`unittest.mock\` in Python, Mockito in Java, NSubstitute in C#).
    * For Integration/API/E2E tests, write tests that interact with components as needed, potentially requiring environment setup (assume basic setup or use placeholders if complex).

5.  **Output Format - CRITICAL:**
    * **CODE ONLY:** Your entire response MUST consist *only* of the generated **${programmingLanguage}** test code for the file "**${targetTestFilePath}**".
    * Absolutely NO introductory phrases, explanations, or concluding remarks outside of code comments.
    * Do NOT use Markdown code fences. Output raw, clean code.

Now, generate the **${programmingLanguage}** code exclusively for the test file: "${targetTestFilePath}".
`;
    },

    parseFlatFileList: function(flatListText) {
        this.logInfo("Parsing flat file list...");
        const files = flatListText.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('//') && line.includes('/'));
        this.logInfo(`Found ${files.length} file paths from flat list.`);
        return files;
    },

    runTask: async function () {
        let newCombinedDocumentId = null;
        let newCombinedDocumentObject = null;

        const stripFirstAndLastLines = (text) => {
            if (!text) return "";
            const lines = text.split('\n');
            if (lines.length <= 2) {
                return "";
            }
            return lines.slice(1, lines.length - 1).join('\n');
        };

        try {
            this.logInfo("Initializing QA Test Generation task (3-Prompt, Base Filename Titles)...");
            const llmModule = await this.loadModule("llm");
            const documentModule = await this.loadModule("document");

            const {
                sourceApplicationDocumentId,
                testType,
                programmingLanguage,
                testFramework,
                specificFocus,
                targetDocumentTitle: initialTargetTitle
            } = this.parameters;

            if (!sourceApplicationDocumentId) throw new Error("Missing required parameter: sourceApplicationDocumentId");
            if (!testType) throw new Error("Missing required parameter: testType");
            if (!programmingLanguage) throw new Error("Missing required parameter: programmingLanguage (for tests)");
            if (!initialTargetTitle) throw new Error("Missing required parameter: targetDocumentTitle (base for QA document)");

            this.logInfo(`Parameters: sourceAppDocId=${sourceApplicationDocumentId}, testType=${testType}, lang=${programmingLanguage}, framework=${testFramework || 'N/A'}, focus=${specificFocus || 'N/A'}`);

            let originalStructureText = "";
            let appFiles = [];
            let sourceAppAbstract = {};
            let sourceAppTitle = "";
            try {
                const appDoc = await documentModule.getDocument(this.spaceId, sourceApplicationDocumentId);
                sourceAppTitle = appDoc.title || sourceApplicationDocumentId;
                const extractedData = await this.extractCodeAndStructureFromAppDoc(documentModule, this.spaceId, sourceApplicationDocumentId);
                originalStructureText = extractedData.originalStructureText;
                appFiles = extractedData.appFiles;
                sourceAppAbstract = extractedData.sourceAppAbstract;
            } catch (docError) {
                this.logError(`Error loading source application document ${sourceApplicationDocumentId}: ${docError.message}`);
                throw new Error(`Failed to load source application document: ${docError.message}`);
            }

            const appFilePaths = appFiles.map(f => f.path);
            const appCodeContext = appFiles.map(f => `/* Code for ${f.path} */\n${f.code}`).join("\n\n");
            const appProgrammingLanguage = sourceAppAbstract?.programmingLanguage || programmingLanguage;

            const testParams = {
                testType,
                programmingLanguage,
                testFramework,
                specificFocus,
                appProgrammingLanguage
            };

            this.logInfo("Generating updated project structure tree to include tests...");
            let updatedStructureTreeText = "// Failed to generate updated project structure tree for tests.";
            const structureUpdatePrompt = this.constructTestStructureUpdatePrompt(originalStructureText, appFilePaths, testParams);

            try {
                this.logInfo("LLM call 1: Generate updated project structure tree...");
                const structureResponse = await llmModule.generateText(this.spaceId, structureUpdatePrompt, { max_tokens: 1536 });
                if (structureResponse && structureResponse.message) {
                    updatedStructureTreeText = structureResponse.message.trim();
                    this.logInfo("Updated project structure tree generated successfully.");
                } else {
                    this.logWarning("LLM returned empty/invalid response for structure update. Test generation might be based on original structure or fail.");
                    updatedStructureTreeText = originalStructureText + "\n\n// [WARNING] Failed to add test structure.";
                }
            } catch (structureError) {
                this.logError(`Error generating updated project structure: ${structureError.message}`);
                updatedStructureTreeText = originalStructureText + `\n\n// [ERROR] Failed to add test structure: ${structureError.message}`;
            }
            this.logInfo("Updated structure tree generation process completed.");


            this.logInfo("Generating flat file list from the updated structure tree...");
            let projectStructureFlatListText = "// Flat file list generation failed.";
            let allFullFilePaths = [];
            if (updatedStructureTreeText && !updatedStructureTreeText.startsWith("//")) {
                const flatListPrompt = this.constructFullPathListPrompt(updatedStructureTreeText, programmingLanguage);
                try {
                    this.logInfo("LLM call 2: Generate flat file list from tree...");
                    const flatListResponse = await llmModule.generateText(this.spaceId, flatListPrompt, { max_tokens: 1024 });
                    if (flatListResponse && flatListResponse.message) {
                        projectStructureFlatListText = flatListResponse.message.trim();
                        allFullFilePaths = this.parseFlatFileList(projectStructureFlatListText);
                        this.logInfo(`Flat file list generated and parsed successfully. Found ${allFullFilePaths.length} total paths.`);
                    } else {
                        this.logWarning("LLM returned empty/invalid response for flat file list. Cannot generate tests.");
                        allFullFilePaths = [];
                    }
                } catch (flatListError) {
                    this.logError(`Error generating flat file list: ${flatListError.message}`);
                    allFullFilePaths = [];
                }
            } else {
                this.logWarning("Skipping flat file list generation because updated tree structure generation failed or was empty.");
            }

            const confirmedTestFilePaths = allFullFilePaths.filter(p => {
                const isAppPath = appFilePaths.some(appPath => appPath === p);
                const isInTestDir = p.toLowerCase().startsWith("tests/") || p.toLowerCase().includes("/tests/");
                const looksLikeTest = isInTestDir || /[._-](test|spec)\./i.test(p) || /test[s]?\./i.test(path.basename(p));
                return !isAppPath && looksLikeTest;
            });

            if (!confirmedTestFilePaths || confirmedTestFilePaths.length === 0) {
                this.logWarning("No new test file paths identified in the flat list. QA test generation will be skipped.");
            } else {
                this.logInfo(`Identified ${confirmedTestFilePaths.length} test files to generate from flat list.`);
            }

            this.logInfo("Generating code for each identified test file path...");
            const allGeneratedTestFileCodes = [];
            const MIN_TEST_FILE_CODE_LENGTH = 10;

            if (confirmedTestFilePaths && confirmedTestFilePaths.length > 0) {
                for (const testFilePath of confirmedTestFilePaths) {
                    this.logProgress(`Generating test code for file: ${testFilePath}`);
                    const testFileCodeGenPrompt = this.constructTestFileCodeGenPrompt(
                        appCodeContext,
                        updatedStructureTreeText,
                        testFilePath,
                        testParams
                    );

                    let specificTestCode = `// Test code generation failed for file: ${testFilePath}`;
                    let fileRetries = 2;
                    while (fileRetries > 0) {
                        try {
                            this.logInfo(`LLM call 3+: test file code: "${testFilePath}" (Attempt ${3 - fileRetries}/2)`);
                            const response = await llmModule.generateText(this.spaceId, testFileCodeGenPrompt, { max_tokens: 4096 });
                            this.logInfo(`LLM call for test file code "${testFilePath}" completed.`);

                            if (response && response.message) {
                                let trimmedResponse = response.message.trim();
                                if (trimmedResponse.length < MIN_TEST_FILE_CODE_LENGTH &&
                                    !trimmedResponse.toLowerCase().includes("empty test suite") &&
                                    !trimmedResponse.startsWith("// Test code generation failed")) {
                                    this.logWarning(`Response for ${testFilePath} is very short (${trimmedResponse.length} chars). Using as is without stripping.`);
                                    specificTestCode = trimmedResponse;
                                } else if (trimmedResponse.startsWith("// Test code generation failed")) {
                                    specificTestCode = trimmedResponse;
                                }
                                else {
                                    specificTestCode = stripFirstAndLastLines(trimmedResponse);
                                }
                                this.logInfo(`Test code generated successfully for file: "${testFilePath}"`);
                                break;
                            }
                            throw new Error("LLM returned an empty or invalid response for test file code.");
                        } catch (llmError) {
                            fileRetries--;
                            this.logWarning(`LLM call failed for test file "${testFilePath}" code: ${llmError.message} (Retries left: ${fileRetries})`);
                            if (fileRetries === 0) {
                                this.logError(`Failed to generate test code for file "${testFilePath}" after all retries.`);
                                specificTestCode = `// Test code generation failed for file: ${testFilePath}\n// Error: ${llmError.message}`;
                            } else {
                                await new Promise(resolve => setTimeout(resolve, 3000));
                            }
                        }
                    }
                    allGeneratedTestFileCodes.push({ path: testFilePath, code: specificTestCode });
                }
                this.logInfo("Code generation for individual test files completed.");
            } else {
                this.logInfo("Generating code for individual test files skipped as no test files were identified.");
            }

            this.logInfo("Saving new combined Project document (App Code + QA Tests)...");

            let baseTitle = initialTargetTitle.replace("+ QA", "").trim();
            if (baseTitle === initialTargetTitle) {
                baseTitle = sourceAppTitle.replace("_Phase 3 Code", "").trim();
            }
            if (!baseTitle){
                baseTitle = "GeneratedProject";
            }
            const finalDocumentTitle = `${baseTitle} + QA`;

            newCombinedDocumentObject = {
                title: finalDocumentTitle,
                type: 'generated_project_with_tests',
                abstract: JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    sourceApplicationDocumentId: sourceApplicationDocumentId,
                    testType: testType,
                    appProgrammingLanguage: appProgrammingLanguage,
                    testProgrammingLanguage: programmingLanguage,
                    testFramework: testFramework,
                    specificFocus: specificFocus,
                    generationType: "app_code_with_qa_tests"
                }, null, 2),
                metadata: {}
            };

            newCombinedDocumentId = await documentModule.addDocument(this.spaceId, newCombinedDocumentObject);
            this.logInfo(`New Combined Project document created with ID: ${newCombinedDocumentId}, Title: ${finalDocumentTitle}`);

            this.logProgress("Adding 'Updated Project Structure' chapter...");
            const structureChapterData = { title: "Project Structure (with Tests)" };
            const structureChapterId = await documentModule.addChapter(this.spaceId, newCombinedDocumentId, structureChapterData);
            await documentModule.addParagraph(this.spaceId, newCombinedDocumentId, structureChapterId, { text: updatedStructureTreeText, commands: {"language": "plaintext"} });
            this.logInfo("'Updated Project Structure' chapter added.");

            this.logProgress(`Adding ${appFiles.length} application code file chapters...`);
            for (const appFileCodeData of appFiles) {
                const chapterTitle = path.basename(appFileCodeData.path);
                this.logProgress(`Adding chapter for app file: ${chapterTitle} (from path: ${appFileCodeData.path})`);
                const appFileChapterData = { title: chapterTitle };
                const appFileChapterId = await documentModule.addChapter(this.spaceId, newCombinedDocumentId, appFileChapterData);
                await documentModule.addParagraph(this.spaceId, newCombinedDocumentId, appFileChapterId, { text: appFileCodeData.code, commands: { "language": appProgrammingLanguage.toLowerCase() } });
            }
            this.logInfo("All application code chapters added.");


            if (allGeneratedTestFileCodes.length > 0) {
                this.logProgress(`Adding ${allGeneratedTestFileCodes.length} test file chapters...`);
                for (const testFileCodeData of allGeneratedTestFileCodes) {
                    const chapterTitle = path.basename(testFileCodeData.path);
                    this.logInfo(`Adding chapter for test file: ${chapterTitle} (from path: ${testFileCodeData.path})`);
                    const testFileChapterData = { title: chapterTitle };
                    const testFileChapterId = await documentModule.addChapter(this.spaceId, newCombinedDocumentId, testFileChapterData);
                    await documentModule.addParagraph(this.spaceId, newCombinedDocumentId, testFileChapterId, { text: testFileCodeData.code, commands: { "language": programmingLanguage.toLowerCase() } });
                }
                this.logInfo("All test file chapters added.");
            } else {
                this.logWarning("No specific test files were generated to be added as chapters.");
                const fallbackChapterData = { title: "Test Generation Summary" };
                const fallbackChapterId = await documentModule.addChapter(this.spaceId, newCombinedDocumentId, fallbackChapterData);
                await documentModule.addParagraph(this.spaceId, newCombinedDocumentId, fallbackChapterId, { text: "No specific test files were generated based on the updated structure analysis.", commands: {"language": "plaintext"} });
            }
            this.logInfo("Combined project document saved successfully.");

            this.logSuccess("Combined Project Generation task completed.");
            return {
                status: 'completed',
                newDocumentId: newCombinedDocumentId,
                newDocumentTitle: newCombinedDocumentObject.title
            };

        } catch (error) {
            this.logError(`[FINAL CATCH] Error in QA Test Generation task: ${error.message}`);
            console.error("Stack trace for error in QA runTask:", error.stack);
            throw error;
        }
    },

    cancelTask: async function () {
        this.logWarning("Task cancelled by user");
    },

    serialize: async function () {
        return {
            taskType: 'QaTestGenerator',
            parameters: this.parameters
        };
    },

    getRelevantInfo: async function () {
        return {
            taskType: 'QaTestGenerator',
            parameters: this.parameters,
            status: this.status || 'pending'
        };
    }
};