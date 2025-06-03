module.exports = {
    runTask: async function () {
        this.logInfo(`Task started. Parameters received: ${JSON.stringify(this.parameters)}`);
        const llmModule = await this.loadModule("llm");
        const documentModule = await this.loadModule("document");
        const mermaidImport = await import('../../../../../../apihub-root/wallet/lib/mermaid/mermaid.esm.min.mjs');
        const mermaid = mermaidImport.default;
        mermaid.initialize({ startOnLoad: false });

        const ensureValidJson = async (jsonString, maxLlmCorrections = 1, jsonSchema = null, correctExample = null, attemptContext = "") => {
            let currentJsonString = jsonString;

            const attemptParse = (strToParse) => {
                try {
                    JSON.parse(strToParse);
                    return strToParse;
                } catch (e) {
                    return { error: e.message, original: strToParse };
                }
            };

            let cleanedStr = currentJsonString.replace(/\n/g, " ").trim();
            let parsedResult = attemptParse(cleanedStr);
            if (typeof parsedResult === 'string') return parsedResult;

            let fenceMatch = cleanedStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (fenceMatch && fenceMatch[1]) {
                cleanedStr = fenceMatch[1].trim();
                parsedResult = attemptParse(cleanedStr);
                if (typeof parsedResult === 'string') return parsedResult;
            }

            let firstOpenChar = -1;
            const firstBraceIndex = cleanedStr.indexOf('{');
            const firstBracketIndex = cleanedStr.indexOf('[');

            if (firstBraceIndex !== -1 && (firstBracketIndex === -1 || firstBraceIndex < firstBracketIndex)) {
                firstOpenChar = firstBraceIndex;
            } else if (firstBracketIndex !== -1) {
                firstOpenChar = firstBracketIndex;
            }

            if (firstOpenChar !== -1) {
                let openBracketsCount = 0;
                let lastMatchingCloseChar = -1;
                const openingCharType = cleanedStr[firstOpenChar];
                const closingCharType = openingCharType === '{' ? '}' : ']';
                for (let i = firstOpenChar; i < cleanedStr.length; i++) {
                    if (cleanedStr[i] === openingCharType) {
                        openBracketsCount++;
                    } else if (cleanedStr[i] === closingCharType) {
                        openBracketsCount--;
                        if (openBracketsCount === 0) {
                            lastMatchingCloseChar = i;
                            break;
                        }
                    }
                }
                if (lastMatchingCloseChar !== -1) {
                    const potentialJsonSubstring = cleanedStr.substring(firstOpenChar, lastMatchingCloseChar + 1);
                    parsedResult = attemptParse(potentialJsonSubstring);
                    if (typeof parsedResult === 'string') return parsedResult;
                }
            }

            let errorForLlmHelper = parsedResult.error;
            currentJsonString = parsedResult.original;

            for (let i = 0; i < maxLlmCorrections; i++) {
                this.logWarning(`JSON for ${attemptContext} is invalid. Attempting LLM correction ${i + 1}/${maxLlmCorrections}. Error: ${errorForLlmHelper}`);
                const llmCorrectionPrompt = `You are an expert in correcting invalid JSON strings.
Instructions: Correct the provided invalid JSON string. You will also receive the parser error and optionally a schema and a correct example.
Output ONLY the corrected, valid, parsable JSON string. Do NOT include code fences (\`\`\`json) or any other commentary.
Invalid JSON: "${currentJsonString}"
Parser Error: "${errorForLlmHelper}"
${jsonSchema ? `JSON Schema:\n${jsonSchema}\n` : ""}
${correctExample ? `Correct Example:\n${correctExample}\n` : ""}
Corrected JSON:`;

                const llmResponse = await llmModule.generateText(this.spaceId, llmCorrectionPrompt);
                currentJsonString = llmResponse.message.trim();

                parsedResult = attemptParse(currentJsonString);
                if (typeof parsedResult === 'string') {
                    this.logInfo(`JSON for ${attemptContext} corrected by LLM on attempt ${i + 1}.`);
                    return parsedResult;
                }
                errorForLlmHelper = parsedResult.error;
                currentJsonString = parsedResult.original;
            }

            this.logError(`Unable to ensure valid JSON for ${attemptContext} after ${maxLlmCorrections} LLM corrections. Final error: ${errorForLlmHelper}. String: ${currentJsonString}`);
            throw new Error(`Unable to ensure valid JSON for ${attemptContext}. Error: ${errorForLlmHelper}`);
        };

        const getLLMResponseWithTimeout = async (prompt, timeout = 60000, attemptContext = "") => {
            this.logInfo(`Requesting LLM for ${attemptContext} with timeout ${timeout / 1000}s.`);
            return Promise.race([
                llmModule.generateText(this.spaceId, prompt),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`LLM request for ${attemptContext} timed out after ${timeout / 1000}s`)), timeout)
                )
            ]);
        };

        let resultJsonChapters;
        let finalDocumentTitle;
        let mainContextForDiagram;
        let isModificationScenario = false;
        let existingDiagramContent = null; //MODIFICATION: For storing existing diagram
        let shouldRegenerateDiagram = true; //MODIFICATION: Flag to control diagram regeneration
        let sourceDocument = null; //MODIFICATION: Define sourceDocument here

        try {
            if (this.parameters.sourceDocumentId && this.parameters.modificationPrompt && this.parameters.targetDocumentTitle) {
                isModificationScenario = true;
                this.logInfo("Initiating Phase 1 document MODIFICATION/VERSIONING task...");

                // MODIFICATION: Normalize finalDocumentTitle to ensure it ends with _Phase 1 (or similar)
                let rawTargetTitle = this.parameters.targetDocumentTitle;
                const phase1Suffix = "_Phase 1";
                const genericPhasePattern = /_Phase\s*\d*$/i; // Matches _Phase, _Phase1, _Phase 2, etc.
                const versionPattern = /(_v\d+\.\d+)/i;       // Matches _v1.0, _v2.3 etc.

                let basePart = rawTargetTitle;
                let versionPart = "";

                const versionMatch = basePart.match(versionPattern);
                if (versionMatch) {
                    versionPart = versionMatch[0];
                    basePart = basePart.replace(versionPart, "");
                }
                basePart = basePart.replace(genericPhasePattern, "");
                basePart = basePart.replace(/[_\s]+$/, "").trim(); // Clean trailing underscores/spaces

                finalDocumentTitle = `${basePart}${versionPart}${phase1Suffix}`;
                this.logInfo(`Normalized target document title to: ${finalDocumentTitle}`);


                this.logProgress("Loading source Phase 1 document...");
                sourceDocument = await documentModule.getDocument(this.spaceId, this.parameters.sourceDocumentId); //MODIFICATION: Assign to outer scope variable
                if (!sourceDocument) {
                    throw new Error(`Source document with ID ${this.parameters.sourceDocumentId} not found.`);
                }

                // MODIFICATION: Extract existing diagram content
                if (sourceDocument) {
                    let chaptersArray = [];
                    if (sourceDocument.content && typeof sourceDocument.content === 'string') {
                        try {
                            const parsedContent = JSON.parse(sourceDocument.content);
                            if (parsedContent.chapters && Array.isArray(parsedContent.chapters)) {
                                chaptersArray = parsedContent.chapters;
                            }
                        } catch (e) {
                            this.logWarning(`Could not parse sourceDocument.content to find existing diagram: ${e.message}`);
                        }
                    } else if (sourceDocument.chapters && Array.isArray(sourceDocument.chapters)) {
                        chaptersArray = sourceDocument.chapters;
                    }

                    const diagramChapter = chaptersArray.find(ch => ch.title === "ProjectFlowDiagram_Mermaid");
                    if (diagramChapter) {
                        if (diagramChapter.paragraphs && Array.isArray(diagramChapter.paragraphs) && diagramChapter.paragraphs.length > 0 && typeof diagramChapter.paragraphs[0].text === 'string') {
                            existingDiagramContent = diagramChapter.paragraphs[0].text.trim();
                        } else if (typeof diagramChapter.idea === 'string' && (diagramChapter.idea.toLowerCase().includes("graph td") || diagramChapter.idea.toLowerCase().includes("flowchart td"))) {
                            existingDiagramContent = diagramChapter.idea.trim();
                        } else if (typeof diagramChapter.summary === 'string' && (diagramChapter.summary.toLowerCase().includes("graph td") || diagramChapter.summary.toLowerCase().includes("flowchart td"))) {
                            existingDiagramContent = diagramChapter.summary.trim();
                        }

                        if (existingDiagramContent) {
                            this.logInfo("Found existing Mermaid diagram in source document.");
                            // Validate existing diagram. If invalid, plan to regenerate.
                            try {
                                if (await mermaid.parse(existingDiagramContent, { suppressErrors: true }) === false) {
                                    this.logWarning("Existing diagram is invalid. Will attempt to regenerate.");
                                    existingDiagramContent = null; // Mark as unusable
                                }
                            } catch (e) {
                                this.logWarning(`Error validating existing diagram: ${e.message}. Will attempt to regenerate.`);
                                existingDiagramContent = null; // Mark as unusable
                            }
                        } else {
                            this.logInfo("ProjectFlowDiagram_Mermaid chapter found, but no diagram content extracted.");
                        }
                    } else {
                        this.logInfo("No 'ProjectFlowDiagram_Mermaid' chapter found in source document.");
                    }
                }

                // MODIFICATION: Decide whether to regenerate the diagram
                const modPromptLower = this.parameters.modificationPrompt.toLowerCase();
                const keywordsForDiagramUpdate = ["diagram", "flow", "schema", "visual", "graph", "chart", "update diagram", "modify flow", "change schema"];
                if (existingDiagramContent && !keywordsForDiagramUpdate.some(keyword => modPromptLower.includes(keyword))) {
                    shouldRegenerateDiagram = false;
                    this.logInfo("Modification prompt does not explicitly request a diagram update and a valid existing diagram was found. Reusing existing diagram.");
                } else {
                    shouldRegenerateDiagram = true;
                    if (!existingDiagramContent) {
                        this.logInfo("No usable existing diagram found. Generating new diagram.");
                    } else {
                        this.logInfo("Modification prompt implies diagram update or existing diagram was unusable. Generating new diagram.");
                    }
                }


                let sourceDocChaptersString = "";
                let sourceChaptersForLLM = [];
                try {
                    let chaptersToProcess = [];
                    if (sourceDocument.content && typeof sourceDocument.content === 'string') {
                        const parsedContent = JSON.parse(sourceDocument.content);
                        if (parsedContent.chapters && Array.isArray(parsedContent.chapters)) {
                            chaptersToProcess = parsedContent.chapters;
                        }
                    } else if (sourceDocument.chapters && Array.isArray(sourceDocument.chapters)) {
                        // Ensure summaries are more substantial if possible
                        chaptersToProcess = sourceDocument.chapters.map(ch => ({
                            title: ch.title,
                            summary: ch.idea || (ch.paragraphs && ch.paragraphs[0] ? ch.paragraphs[0].text : '') || ch.summary || 'N/A'
                        }));
                    }

                    for (const chapter of chaptersToProcess) {
                        if (chapter.title !== "ProjectFlowDiagram_Mermaid" && chapter.title !== "UserPromptInstructions" && chapter.title !== "ModificationFocusInstructions") {
                            sourceDocChaptersString += `Chapter Title: ${chapter.title}\nChapter Summary:\n${chapter.summary || 'N/A'}\n\n---\n\n`;
                            sourceChaptersForLLM.push({ title: chapter.title, summary: chapter.summary || 'N/A' });
                        }
                    }
                    if (sourceChaptersForLLM.length === 0) {
                        this.logWarning("No substantive chapters found in source document to feed to LLM for modification. Modification prompt will be treated as new requirements.");
                        sourceDocChaptersString = "The source document has no textual chapters to modify. Please generate content based on the user's modification prompt as if it's a new set of requirements for this project phase.";
                    }
                } catch (e) {
                    this.logError(`Error processing source document content: ${e.message}. Will proceed by treating modification prompt as primary input.`);
                    sourceDocChaptersString = "Error processing source document. Please generate content based on the user's modification prompt as primary input for this project phase.";
                }

                let baseTitleForDiagramDerivation = finalDocumentTitle;
                const versionedPhase1SuffixRegex = /_v\d+\.\d+_Phase 1$/;
                const simplePhase1SuffixForDiagram = "_Phase 1";
                if (versionedPhase1SuffixRegex.test(baseTitleForDiagramDerivation)) {
                    baseTitleForDiagramDerivation = baseTitleForDiagramDerivation.replace(versionedPhase1SuffixRegex, "");
                } else if (baseTitleForDiagramDerivation.endsWith(simplePhase1SuffixForDiagram)) {
                    baseTitleForDiagramDerivation = baseTitleForDiagramDerivation.substring(0, baseTitleForDiagramDerivation.length - simplePhase1SuffixForDiagram.length);
                }

                mainContextForDiagram = {
                    title: baseTitleForDiagramDerivation.trim(),
                    informativeText: `This is a revised Phase 1 document. User focus for this version: ${this.parameters.modificationPrompt.substring(0, 250)}${this.parameters.modificationPrompt.length > 250 ? '...' : ''}`,
                    promptText: this.parameters.modificationPrompt
                };

                let modificationLLMPrompt = `
You are an IT architect. Your task is to revise an existing Phase 1 project outline based on user instructions.

**Existing Phase 1 Document Chapters (Titles and Summaries):**
${sourceDocChaptersString}

**User's Instructions for Focus/Modification for this new version of Phase 1:**
"${this.parameters.modificationPrompt}"

**Your Task:**
1.  Review the "User's Instructions" to understand the desired focus or changes.
2.  Based on these instructions, revise, add, or maintain the chapters from the "Existing Phase 1 Document Chapters".
    a. If a chapter from the existing document is relevant to the user's instructions, update its title and/or summary to reflect the new focus. Summaries for such revised chapters, and for any NEWLY ADDED chapters, MUST be detailed, aiming for 300-400 characters, focusing on Phase 1 implementation aspects and deliverables.
    b. If a chapter from the existing document is NOT directly impacted by the user's instructions, you MUST reproduce its original title and summary EXACTLY as provided in the "Existing Phase 1 Document Chapters" section. Do not alter these chapters.
    c. If the user's instructions clearly imply a NEW chapter, add it with a suitable title and a detailed Phase 1 summary (300-400 characters).
    d. If the user's instructions imply a chapter should be DELETED, omit it from your output.
3.  The output must be a complete list of ALL chapters for the new, revised Phase 1 document.

**Output Requirements (CRITICAL):**
- START YOUR RESPONSE DIRECTLY with the JSON object.
- DO NOT include any introductory text or commentary.
- Provide a valid JSON structure: {"chapters": [{"title": "string", "summary": "string"}]}
- Each "summary" for a revised or new chapter is a detailed Phase 1 level overview of 300-400 characters. Summaries for UNCHANGED chapters must be EXACTLY as provided to you.
- Use ONLY English and standard ASCII. No special characters or emojis. Basic punctuation.
- End your response with } and nothing else.
`;
                let retries = 3;
                let llmResponse;
                while (retries > 0) {
                    try {
                        this.logProgress(`Generating modified Phase 1 outline (attempt ${4 - retries}/3)...`);
                        llmResponse = await getLLMResponseWithTimeout(modificationLLMPrompt, 180000, "Phase 1 Modification"); // Increased timeout
                        const validJsonString = await ensureValidJson(
                            llmResponse.message,
                            1,
                            `{"chapters": [{"title": "string", "summary": "string"}]}`,
                            `{"chapters": [{"title": "Revised Chapter", "summary": "Detailed summary (300-400 chars)..."}, {"title": "Unchanged Chapter", "summary": "Original summary..."}]}`,
                            "Phase 1 Modification"
                        );
                        resultJsonChapters = JSON.parse(validJsonString);
                        if (!resultJsonChapters.chapters || !Array.isArray(resultJsonChapters.chapters)) {
                            this.logWarning(`LLM response for modification resulted in no chapters or invalid structure. Chapters array will be empty.`);
                            resultJsonChapters.chapters = [];
                        }
                        this.logInfo(`Parsed modified Phase 1 result. Chapter count: ${resultJsonChapters.chapters.length}`);
                        break;
                    } catch (error) {
                        retries--;
                        const errorMessage = error.message || 'Unknown error';
                        this.logWarning(`Modified Phase 1 generation failed: ${errorMessage}`);
                        if (retries === 0) {
                            this.logError(`Failed to generate valid modified Phase 1 outline after all retries: ${errorMessage}`);
                            throw error;
                        }
                        modificationLLMPrompt += `\n\nPrevious attempt failed with error: ${errorMessage}\nPlease ensure your response strictly adheres to the JSON schema and instructions. Ensure all relevant chapters are present and summaries for modified/new chapters are 300-400 characters. Unchanged chapters must be reproduced exactly.`;
                        this.logWarning(`Retrying modified Phase 1 outline generation (${retries} attempts remaining)`);
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay
                    }
                }
            } else if (this.parameters.projectTitle && this.parameters.informativeText && this.parameters.promptText) {
                isModificationScenario = false;
                this.logInfo("Initializing project generation task (NEW Phase 1)...");
                finalDocumentTitle = `${this.parameters.projectTitle.trim()}_Phase 1`;
                mainContextForDiagram = {
                    title: this.parameters.projectTitle,
                    informativeText: this.parameters.informativeText,
                    promptText: this.parameters.promptText
                };
                shouldRegenerateDiagram = true; // Always generate diagram for new projects

                let projectPrompt = `
You are an IT manager responsible to implement a project with the following context:
User's Project Focus: **Project Title:** "${this.parameters.projectTitle}"
- **Informative Text on Goal and Production:** "${this.parameters.informativeText}"
- **Prompt: Generate Project Specifications, APIs, etc.:** "${this.parameters.promptText}"

IMPORTANT - READ CAREFULLY:
- DO NOT include any introductory text or commentary.
- START YOUR RESPONSE DIRECTLY with the JSON object.
- DO NOT include any text after the JSON object.
- Provide a valid JSON structure following the schema:
{
  "chapters": [
    {
      "title": "string",
      "summary": "string"
    }
  ]
}
- Each "summary" MUST be detailed, aiming for 300-400 characters, focusing on the implementation and deliverables for that chapter in a Phase 1 context.
- Use ONLY English language and standard ASCII characters.
- DO NOT use special characters, emojis, or non-English text.
- Use only basic punctuation (periods, commas, spaces, parentheses).
REMEMBER:
- Start your response with { and end with } (no other text allowed)
`;
                let retries = 3;
                let response;
                while (retries > 0) {
                    try {
                        this.logProgress(`Generating project outline (attempt ${4 - retries}/3)...`);
                        response = await getLLMResponseWithTimeout(projectPrompt, 120000, "New Phase 1 Outline"); // Increased timeout
                        const validJsonString = await ensureValidJson(
                            response.message,
                            1,
                            `{"chapters": [{"title": "string", "summary": "string"}]}`,
                            `{"chapters": [{"title": "Introduction", "summary": "Detailed practical implementation of the chapter (300-400 chars)..."}]}`,
                            "New Phase 1 Outline"
                        );
                        resultJsonChapters = JSON.parse(validJsonString);
                        if (!resultJsonChapters.chapters || !Array.isArray(resultJsonChapters.chapters) || resultJsonChapters.chapters.length === 0) {
                            throw new Error(`Invalid response format: "chapters" array is missing, not an array, or empty.`);
                        }
                        this.logInfo(`Parsed result for new Phase 1. Chapter count: ${resultJsonChapters.chapters.length}`);
                        break;
                    } catch (error) {
                        retries--;
                        const errorMessage = error.message || 'Unknown error';
                        this.logWarning(`New Phase 1 generation failed: ${errorMessage}`);
                        if (retries === 0) {
                            this.logError(`Failed to generate valid new Phase 1 outline after all retries: ${errorMessage}`);
                            throw error;
                        }
                        projectPrompt += `\n\nPrevious attempt failed with error: ${errorMessage}\nPlease ensure your response is valid JSON, matches the structure, and chapter summaries are detailed (300-400 characters).`;
                        this.logWarning(`Retrying new Phase 1 outline generation (${retries} attempts remaining)`);
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Increased delay
                    }
                }
            } else {
                throw new Error("Invalid parameters: Required fields for new project creation or for modification are missing.");
            }

            this.logSuccess("Successfully generated project chapter structure via LLM.");
            this.logProgress("Processing Mermaid diagram...");

            let responseDiagramText;
            let diagramIsValid = false;

            if (!shouldRegenerateDiagram && existingDiagramContent) {
                this.logInfo("Attempting to reuse existing Mermaid diagram.");
                responseDiagramText = existingDiagramContent;
                diagramIsValid = true; // Assumed valid from earlier check, or we trust it
            }

            if (shouldRegenerateDiagram) {
                this.logInfo("Proceeding with new Mermaid diagram generation.");
                const promptDiagram = `
Generate a valid Mermaid diagram using "graph TD" for a vertical diagram.
- Output ONLY plain text-based Mermaid code (no numeric encoding, no code fences like \`\`\`mermaid or \`\`\`).
- Use standard ASCII characters for arrows and relationships (e.g. A-->B).
- Node names/IDs should be alphanumeric, using underscores (_) or camelCase instead of spaces or special characters (except for valid Mermaid labels in quotes if necessary, but prefer simple IDs). Example: Node_One["Label for Node One"] --> NodeTwo.
- Ensure the code is well-formed and error-free.
- Base the diagram on the following project context. The diagram should reflect the main components or phases derived from this context.
  * Project Idea: "${mainContextForDiagram.title}"
  * Elaboration/Focus: "${mainContextForDiagram.promptText}"
  * Additional Context: "${mainContextForDiagram.informativeText}"
Return ONLY the Mermaid code.
`;
                let diagramRetries = 3;
                while (diagramRetries > 0 && !diagramIsValid) {
                    try {
                        this.logProgress(`Generating Mermaid diagram (attempt ${4 - diagramRetries}/3)...`);
                        const llmDiagramResponse = await getLLMResponseWithTimeout(promptDiagram, 90000, "Mermaid Diagram");
                        let tempDiagramText = llmDiagramResponse.message.trim();
                        tempDiagramText = tempDiagramText.replace(/^```(?:mermaid)?\s*([\s\S]*?)\s*```$/, '$1').trim();

                        if (!tempDiagramText.toLowerCase().startsWith("graph td") &&
                            !tempDiagramText.toLowerCase().startsWith("graph lr") &&
                            !tempDiagramText.toLowerCase().startsWith("flowchart td") &&
                            !tempDiagramText.toLowerCase().startsWith("flowchart lr")) {
                            tempDiagramText = "graph TD\n" + tempDiagramText;
                        }

                        if (tempDiagramText.trim() === "" || tempDiagramText.trim().toLowerCase() === "graph td") {
                            this.logWarning("LLM returned an empty or minimal Mermaid diagram. Using placeholder.");
                            responseDiagramText = "graph TD\n  A[No Diagram Generated] --> B(Review LLM prompt or input context)";
                            diagramIsValid = true;
                        } else if (await mermaid.parse(tempDiagramText, { suppressErrors: true }) !== false) {
                            this.logInfo("Mermaid diagram syntax appears valid based on initial parse.");
                            responseDiagramText = tempDiagramText;
                            diagramIsValid = true;
                        } else {
                            throw new Error("Generated Mermaid diagram has syntax errors according to mermaid.parse.");
                        }
                    } catch (e) {
                        diagramRetries--;
                        this.logWarning(`Mermaid diagram generation failed: ${e.message}. Retries left: ${diagramRetries}`);
                        if (diagramRetries === 0) {
                            this.logError("Failed to generate a valid Mermaid diagram after all retries. Using a placeholder.");
                            responseDiagramText = "graph TD\n  A[Diagram Generation Failed] --> B(Check Logs for details)";
                            diagramIsValid = true; // Set to true to proceed with placeholder
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 7000)); // Increased delay
                        }
                    }
                }
            }


            this.logInfo('Final Mermaid diagram code:', responseDiagramText.substring(0,200) + "..."); // Log only a part for brevity
            this.logProgress("Saving new document with chapters and diagram...");

            const documentObj = {
                title: finalDocumentTitle,
                type: 'project_phase1',
                // content: JSON.stringify(resultJsonChapters, null, 2), // Storing full chapters list in content
                abstract: JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    sourceParameters: this.parameters,
                    isModification: isModificationScenario,
                    diagramReused: isModificationScenario && !shouldRegenerateDiagram
                }, null, 2),
                // metadata: { id: null, title: finalDocumentTitle } // metadata might be set by addDocument
            };
            // Storing chapters directly if documentModule supports it, or stringify if content expects string
            if (typeof documentModule.addDocumentMightSupportDirectChapters === 'boolean') { // Hypothetical check
                documentObj.chapters = resultJsonChapters.chapters; // If direct chapter array is supported
                documentObj.content = null; // Or some other indicator
            } else {
                documentObj.content = JSON.stringify(resultJsonChapters, null, 2); // Fallback to stringified content
            }


            const documentId = await documentModule.addDocument(this.spaceId, documentObj);
            this.logInfo(`Created/Updated document shell with ID: ${documentId} and title: ${finalDocumentTitle}`);

            const chapterDataDiagram = {
                title: "ProjectFlowDiagram_Mermaid",
                idea: "Auto-generated or reused Mermaid diagram representing the project flow or structure."
            };
            const chapterIdDiagram = await documentModule.addChapter(this.spaceId, documentId, chapterDataDiagram);
            await documentModule.addParagraph(this.spaceId, documentId, chapterIdDiagram, { text: responseDiagramText, commands: {} });
            this.logInfo(`Added ProjectFlowDiagram_Mermaid with diagram to document ${documentId}`);

            if (resultJsonChapters.chapters && resultJsonChapters.chapters.length > 0) {
                for (let chapter of resultJsonChapters.chapters) {
                    // Basic validation for chapter object
                    if (!chapter || typeof chapter.title !== 'string' || typeof chapter.summary !== 'string') {
                        this.logWarning(`Skipping invalid chapter object: ${JSON.stringify(chapter)}`);
                        continue;
                    }
                    const chapterData = {
                        title: chapter.title,
                        idea: chapter.summary.substring(0, 200) + (chapter.summary.length > 200 ? "..." : "") // Idea field often has length limits
                    };
                    const newChapterId = await documentModule.addChapter(this.spaceId, documentId, chapterData);
                    // Add the full summary as the first paragraph
                    await documentModule.addParagraph(this.spaceId, documentId, newChapterId, { text: chapter.summary || '', commands: {} });
                    this.logInfo(`Added chapter: "${chapter.title}" and its summary paragraph to document ${documentId}`);
                }
            } else {
                this.logWarning(`No chapters were found in the result from LLM to add to document ${documentId}. The document will contain only the diagram and instruction chapters.`);
            }

            // Add user prompt/modification instructions chapter
            if (!isModificationScenario) {
                const chapterDataPromptFiller = {
                    title: "UserPromptInstructions",
                    idea: "Initial user instructions for this project outline."
                }
                const chapterIdPromptFiller = await documentModule.addChapter(this.spaceId, documentId, chapterDataPromptFiller);
                const paragraphObjPromptFiller = {
                    text: `Project Title: ${this.parameters.projectTitle || 'N/A'}\nInformative Text: ${this.parameters.informativeText || 'N/A'}\nPrompt: ${this.parameters.promptText || 'N/A'}`,
                    commands: {}
                }
                await documentModule.addParagraph(this.spaceId, documentId, chapterIdPromptFiller, paragraphObjPromptFiller);
                this.logInfo(`Added UserPromptInstructions chapter for new Phase 1 document ${documentId}`);
            } else { // Modification scenario
                const chapterDataModificationPrompt = {
                    title: "ModificationFocusInstructions",
                    idea: "User instructions for this version of the Phase 1 document."
                }
                const chapterIdModPrompt = await documentModule.addChapter(this.spaceId, documentId, chapterDataModificationPrompt);
                const paragraphObjModPrompt = {
                    text: `Source Document ID for this version: ${this.parameters.sourceDocumentId}\nUser Focus/Modification Instructions:\n${this.parameters.modificationPrompt}`,
                    commands: {}
                }
                await documentModule.addParagraph(this.spaceId, documentId, chapterIdModPrompt, paragraphObjModPrompt);
                this.logInfo(`Added ModificationFocusInstructions chapter for modified Phase 1 document ${documentId}`);
            }


            this.logSuccess(`Successfully created/updated document ${finalDocumentTitle} (ID: ${documentId}) with chapters and diagram.`);
            return {
                status: 'completed',
                result: {
                    chapters: resultJsonChapters.chapters,
                    mermaidDiagram: responseDiagramText
                },
                documentId: documentId,
                documentTitle: finalDocumentTitle
            };

        } catch (error) {
            this.logError(`Error in runTask: ${error.message}\nStack: ${error.stack}`);
            // Ensure a result is returned even in case of error, if possible, or rethrow
            // For now, rethrowing to indicate failure clearly
            throw error;
        }
    },
    cancelTask: async function () {
        this.logWarning("Task cancelled by user");
        // Implement any specific cancellation logic if needed
    },
    serialize: async function () {
        return {
            taskType: 'ProjectCreator', // Or a more specific name for this task
            parameters: this.parameters
            // Add any other state variables you might need to resume the task
        };
    },
    getRelevantInfo: async function () {
        return {
            taskType: 'ProjectCreator',
            parameters: this.parameters,
            // Provide a summary of what the task is about or its current state
            statusSummary: `Generates or modifies a Phase 1 project document. Current parameters: ${JSON.stringify(this.parameters)}`
        };
    }
};