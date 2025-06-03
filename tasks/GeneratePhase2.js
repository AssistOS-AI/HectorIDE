module.exports = {
    runTask: async function () {
        try {
            this.logInfo("Initializing document modification task with full context...");
            const llmModule = await this.loadModule("llm");
            const documentModule = await this.loadModule("document");

            const { sourceDocumentId, modificationDetails: modificationPrompt, targetDocumentTitle } = this.parameters;

            if (!sourceDocumentId) {
                this.logError("Validation failed: Missing sourceDocumentId parameter.");
                throw new Error("Missing required parameter: sourceDocumentId");
            }

            if (!targetDocumentTitle) {
                this.logError("Validation failed: Missing targetDocumentTitle parameter.");
                throw new Error("Missing required parameter: targetDocumentTitle for the new document");
            }


            const modificationRequest = modificationPrompt?.trim() || "";

            this.logInfo(`Parameters check passed. sourceDocId=${sourceDocumentId}, modificationRequest provided=${!!modificationRequest}`);
            this.logProgress(`Attempting to load source document: ${sourceDocumentId}...`);

            let sourceDoc;
            try {
                sourceDoc = await documentModule.getDocument(this.spaceId, sourceDocumentId);
                this.logInfo(`getDocument call completed for ID: ${sourceDocumentId}.`);
            } catch (docError) {
                this.logError(`Error loading source document ${sourceDocumentId}: ${docError.message}`);
                console.error("Stack trace for getDocument error:", docError.stack);
                throw new Error(`Failed to load source document: ${docError.message}`);
            }

            if (!sourceDoc) {
                this.logError(`Validation failed: Source document with ID ${sourceDocumentId} not found after getDocument call.`);
                throw new Error(`Source document with ID ${sourceDocumentId} not found.`);
            }
            this.logInfo(`Source document ${sourceDocumentId} loaded successfully. Checking structure...`);

            if (!sourceDoc.chapters || !Array.isArray(sourceDoc.chapters) || sourceDoc.chapters.length === 0) {
                this.logError(`Validation failed: Source document ${sourceDocumentId} has invalid chapter structure.`);
                throw new Error(`Source document ${sourceDocumentId} does not contain a valid chapter structure.`);
            }
            this.logInfo(`Source document structure validated (${sourceDoc.chapters.length} chapters found).`);

            this.logInfo("Attempting to extract full document context...");
            const fullDocumentContext = await this.extractDocumentContent(sourceDoc);
            if (!fullDocumentContext) {
                this.logWarning(`Could not extract full text context from source document ${sourceDocumentId}. LLM calls might lack context.`);
            } else {
                this.logInfo(`Full document context extracted (${fullDocumentContext.length} chars).`);
            }

            this.logInfo(`Processing ${sourceDoc.chapters.length} chapters...`);
            const processedChapters = [];
            let chapterIndex = 0;

            this.logInfo("Starting chapter processing loop...");
            for (const chapter of sourceDoc.chapters) {
                chapterIndex++;
                const chapterTitle = chapter.title || `Chapter ${chapterIndex}`;
                this.logProgress(`[LOOP START] Processing chapter ${chapterIndex}/${sourceDoc.chapters.length}: ${chapterTitle}...`);

                let originalSummary = "";
                if (chapter.paragraphs && Array.isArray(chapter.paragraphs) && chapter.paragraphs.length > 0 && chapter.paragraphs[0].text) {
                    originalSummary = chapter.paragraphs[0].text;
                    this.logInfo(`Found original summary/text for chapter "${chapterTitle}" (${originalSummary.length} chars).`);
                } else {
                    this.logWarning(`Chapter "${chapterTitle}" has no initial paragraph text. Will result in empty text.`);
                    processedChapters.push({ title: chapterTitle, text: "" });
                    this.logProgress(`[LOOP SKIP] Skipped chapter ${chapterIndex} due to missing paragraph text.`);
                    continue;
                }

                if (chapterTitle === "MermaidDiagramChapter") {
                    this.logInfo(`Skipping LLM processing for chapter: ${chapterTitle}. Preserving original content.`);
                    processedChapters.push({ title: chapterTitle, text: originalSummary });
                    this.logProgress(`[LOOP SKIP] Skipped Mermaid chapter ${chapterIndex}.`);
                    continue;
                }

                let chapterPrompt;
                const basePromptInfo = `
**Full Document Context:**
${fullDocumentContext || "Context could not be extracted."}

**Current Chapter Focus:**
- Title: "${chapterTitle}"
- Original Summary: "${originalSummary}"
`;

                if (modificationRequest) {
                    this.logInfo(`Building MODIFICATION prompt for chapter "${chapterTitle}"...`);
                    chapterPrompt = `
You are an expert technical writer focusing on practical implementation details. Your task is to rewrite a specific chapter summary based *primarily* on a user's modification request, using the provided context.

${basePromptInfo}
**User Modification Request:**
"${modificationRequest}"

**Instructions:**
1.  **Prioritize the User Request:** Rewrite the "Original Summary" focusing heavily on incorporating and explaining the practical implementation details related to the "**User Modification Request**". If the user requested a specific technology (e.g., MySQL), detail its use in this chapter's context.
2.  **Contextual Relevance:** Ensure the rewritten text remains relevant to the chapter title ("**${chapterTitle}**") and the overall document context.
3.  **Conciseness:** Be concise and to the point regarding the modification. Avoid unnecessary introductions or filler text unrelated to the request.
4.  **Output Format:** Output ONLY the final rewritten text for this chapter summary. Do not include explanations or formatting markers. Use clear, coherent English and standard ASCII characters.
`;
                } else {
                    this.logInfo(`Building EXPANSION prompt for chapter "${chapterTitle}"...`);
                    chapterPrompt = `
You are an expert technical writer focusing on practical implementation details. Your task is to expand a specific chapter summary into a **detailed and comprehensive** practical implementation description, using the provided context.

${basePromptInfo}
**Instructions:**
1.  **Expand Thoroughly:** Expand the "Original Summary" for the chapter "**${chapterTitle}**" into a **detailed and comprehensive** practical implementation description relevant to its title and the overall document context.
2.  **Focus:** Include concrete actions, relevant technologies, potential challenges, configuration details, and best practices related to the chapter's topic.
3.  **Length:** Ensure the expanded text is substantial, aiming for **at least 300-400 characters** to provide sufficient technical detail.
4.  **Output Format:** Output ONLY the final expanded text for this chapter summary. Do not include introductions, explanations, or formatting markers. Use clear, coherent English and standard ASCII characters.
`;
                }
                this.logInfo(`Prompt built for chapter "${chapterTitle}". Length: ${chapterPrompt.length}`);

                let processedText = originalSummary;
                let retries = 2;

                this.logInfo(`Starting LLM call attempts for chapter "${chapterTitle}"...`);
                while(retries > 0) {
                    try {
                        this.logInfo(`Attempting LLM call for chapter: ${chapterTitle} (Attempt ${3-retries}/2)`);
                        const response = await llmModule.generateText(this.spaceId, chapterPrompt, { max_tokens: 1024 });
                        this.logInfo(`LLM response received for chapter "${chapterTitle}". Validating...`);
                        if (response && response.message) {
                            processedText = response.message.trim();
                            this.logInfo(`LLM response message trimmed (${processedText.length} chars).`);
                            if (!modificationRequest && processedText.length < 250) {
                                this.logWarning(`LLM response for chapter "${chapterTitle}" expansion is short (${processedText.length} chars). Retrying.`);
                                throw new Error("Response too short");
                            }
                            this.logInfo(`Successfully processed chapter: ${chapterTitle}`);
                            break;
                        } else {
                            this.logWarning(`LLM response for chapter "${chapterTitle}" was empty or invalid.`);
                            throw new Error("LLM returned an empty or invalid response.");
                        }
                    } catch (llmError) {
                        retries--;
                        this.logWarning(`LLM call failed for chapter "${chapterTitle}": ${llmError.message} (Retries left: ${retries})`);
                        if (retries === 0) {
                            this.logError(`Failed to process chapter "${chapterTitle}" after all retries. Using original summary.`);
                            processedText = originalSummary;
                        } else {
                            this.logInfo(`Waiting 3 seconds before retrying chapter "${chapterTitle}"...`);
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }
                    }
                }
                processedChapters.push({ title: chapterTitle, text: processedText });
                this.logProgress(`[LOOP END] Finished processing chapter ${chapterIndex}. Stored result.`);
            }
            this.logInfo("Finished chapter processing loop.");

            this.logProgress("Saving generated document...");
            const newDocumentObj = {
                title: `${targetDocumentTitle}_Phase 2`,
                type: sourceDoc.type || 'project',
                abstract: JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    sourceDocumentId: sourceDocumentId,
                    modificationRequestProvided: !!modificationRequest
                }, null, 2),
                metadata: {}
            };
            this.logInfo(`Built new document object: ${JSON.stringify(newDocumentObj)}`);

            this.logInfo("Attempting to add new document...");
            const newDocumentId = await documentModule.addDocument(this.spaceId, newDocumentObj);
            this.logInfo(`Created new document with ID: ${newDocumentId} and title: ${targetDocumentTitle}`);

            this.logProgress(`Adding ${processedChapters.length} chapters to the new document...`);
            let savedChapterIndex = 0;
            this.logInfo("Starting loop to save chapters and paragraphs...");
            for (const procChapter of processedChapters) {
                savedChapterIndex++;
                this.logProgress(`[SAVE LOOP START] Saving chapter ${savedChapterIndex}/${processedChapters.length}: ${procChapter.title}`);
                const chapterData = {
                    title: procChapter.title
                };
                this.logInfo(`Attempting to add chapter "${procChapter.title}" to doc ${newDocumentId}...`);
                const newChapterId = await documentModule.addChapter(this.spaceId, newDocumentId, chapterData);
                this.logInfo(`Chapter "${procChapter.title}" added with ID ${newChapterId}. Attempting to add paragraph...`);

                const paragraphData = {
                    text: procChapter.text || "",
                    commands: {}
                };
                await documentModule.addParagraph(this.spaceId, newDocumentId, newChapterId, paragraphData);
                this.logInfo(`[SAVE LOOP END] Added paragraph for chapter "${procChapter.title}".`);
            }
            this.logInfo("Finished saving chapters and paragraphs loop.");

            this.logSuccess("Successfully processed all chapters and saved the new document.");
            return {
                status: 'completed',
                newDocumentId: newDocumentId,
                newDocumentTitle: targetDocumentTitle
            };

        } catch (error) {
            this.logError(`[FINAL CATCH] Error in document modification/expansion task: ${error.message}`);
            console.error("Stack trace:", error.stack);
            throw error;
        }
    },

    extractDocumentContent: async function(document) {
        if (!document) return '';
        if (document.content) return document.content;
        if (document.chapters && Array.isArray(document.chapters)) {
            return document.chapters
                .map(chapter => {
                    const texts = [];
                    if (chapter && chapter.title) {
                        texts.push(`Chapter: ${chapter.title}`);
                    }
                    if (chapter && Array.isArray(chapter.paragraphs)) {
                        texts.push(chapter.paragraphs
                            .filter(p => p && p.text)
                            .map(p => p.text)
                            .join('\n\n'));
                    }
                    return texts.filter(t => t && t.trim()).join('\n\n');
                })
                .filter(t => t && t.trim())
                .join('\n\n');
        }
        return '';
    },

    cancelTask: async function () {
        this.logWarning("Task cancelled by user");
    },

    serialize: async function () {
        return {
            taskType: 'DocumentProcessor',
            parameters: this.parameters
        };
    },

    getRelevantInfo: async function () {
        return {
            taskType: 'DocumentProcessor',
            parameters: this.parameters,
            status: this.status || 'pending'
        };
    }
};