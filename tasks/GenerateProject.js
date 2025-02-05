module.exports = {
    runTask: async function () {
        try {
            this.logInfo("Initializing project generation task...");
            const llmModule = await this.loadModule("llm");
            const utilModule = await this.loadModule("util");
            const personalityModule = await this.loadModule("personality");
            const documentModule = await this.loadModule("document");

            const ensureValidJson = async (jsonString, maxIterations = 1, jsonSchema = null, correctExample = null) => {
                const phases = {
                    "RemoveJsonMark": async (jsonString, error) => {
                        if (jsonString.startsWith("```json")) {
                            jsonString = jsonString.slice(7);
                            if (jsonString.endsWith("```")) {
                                jsonString = jsonString.slice(0, -3);
                            }
                        }
                        return jsonString;
                    },
                    "RemoveOutsideJson": async (jsonString, error) => {
                        if (jsonString.includes("```json")) {
                            const parts = jsonString.split("```json");
                            if (parts.length > 1) {
                                jsonString = parts[1];
                                jsonString = jsonString.split("```")[0];
                            }
                        }
                        return jsonString;
                    },
                    "RemoveNewLine": async (jsonString, error) => {
                        return jsonString.replace(/\n/g, "");
                    },
                    "TrimSpaces": async (jsonString, error) => {
                        return jsonString.trim();
                    },
                    "LlmHelper": async (jsonString, error) => {
                        const promptText = `
                **Role:**
                   - You are a global expert in correcting an invalid JSON string so that it is parsable by a JSON parser.
                
                **Instructions:**
                   - You will be provided with an invalid JSON string that needs to be corrected.
                   - You will be provided with an error message given by the parser that will help you identify the issue in the JSON string.
                   ${jsonSchema ? `- You will be provided with a JSON schema that the corrected JSON string should adhere to.` : ""}
                   ${correctExample ? `- You will be provided with an example of a correct JSON string that adheres to the schema.` : ""}
                
                **Invalid JSON string to correct:**
                "${jsonString}"
                
                **Parser error:**
                "${error}"
                
                ${jsonSchema ? `**JSON Schema Template:**\n${jsonSchema}\n` : ""}
                ${correctExample ? `**Example of a correct JSON string:**\n${correctExample}\n` : ""}
                
                **Output Specifications:**
                   - Provide only the corrected JSON string that is valid and parsable.
                   - Do NOT include any code block fences (e.g., \`\`\`json).
                   - Do NOT add extra commentary or text.
                        `;
                        const response = await llmModule.generateText(this.spaceId, promptText);

                        return response.message;
                    }
                };

                const phaseFunctions = Object.values(phases);

                while (maxIterations > 0) {
                    for (const phase of phaseFunctions) {
                        try {
                            JSON.parse(jsonString);
                            return jsonString;
                        } catch (error) {
                            jsonString = await phase(jsonString, error.message);
                        }
                    }
                    maxIterations--;
                }
                throw new Error("Unable to ensure valid JSON after all phases.");
            };

            this.logInfo(`Parameters received: ${JSON.stringify(this.parameters)}`);

            // 2. Construct the project generation prompt
            this.logProgress("Constructing project generation prompt...");

            // This prompt instructs the LLM to generate a project outline in valid JSON format
            let projectPrompt = `
You are an IT manager responsible to implement a project with the following  context:

User's Project Focus: ${this.parameters.prompt || 'Provide a well-structured software project plan.'}

Text to reference:
${this.parameters.text}

IMPORTANT - READ CAREFULLY:
- DO NOT include any introductory text or commentary
- START YOUR RESPONSE DIRECTLY with the JSON object
- DO NOT include any text after the JSON object
- Provide a valid JSON structure following the schema:
{
  "chapters": [
    {
      "title": "string",
      "summary": "string"
    }
  ]
}
- The summary section must have at least 200 characters, and be focused on the implementation from the chapter's name
- Use ONLY English language and standard ASCII characters
- DO NOT use special characters, emojis, or non-English text
- Use only basic punctuation (periods, commas, spaces, parentheses)

REMEMBER:
- Start your response with { and end with } (no other text allowed)
`;

            let retries = 3;
            let response;
            let result;

            const getLLMResponseWithTimeout = async (prompt, timeout = 50000) => {
                return Promise.race([
                    llmModule.generateText(this.spaceId, prompt),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('LLM request timed out')), timeout)
                    )
                ]);
            };

            while (retries > 0) {
                try {
                    this.logProgress(`Generating project outline (attempt ${4 - retries}/3)...`);

                    response = await getLLMResponseWithTimeout(projectPrompt);
                    this.logInfo('Raw response:', response);

                    const validJsonString = await ensureValidJson(
                        response.message,
                        1,
                        `{
  "chapters": [
    {
      "title": "string",
      "summary": "string"
    }
  ]
}`,
                        `{
  "chapters": [
    {
      "title": "Introduction",
      "summary": "Practical implementation of the chapter"
    }
  ]
}`
                    );

                    // Parse the validated JSON
                    result = JSON.parse(validJsonString);
                    this.logInfo(`Parsed result for attempt ${4 - retries}:`, result);

                    // Basic shape check
                    if (!result.chapters || !Array.isArray(result.chapters)) {
                        throw new Error(`Invalid response format: missing or malformed "chapters" array`);
                    }

                    break;
                } catch (error) {
                    retries--;
                    const errorMessage = error.message || 'Unknown error';
                    this.logWarning(`Project generation failed: ${errorMessage}`);

                    if (retries === 0) {
                        this.logError(`Failed to generate valid project outline after all retries: ${errorMessage}`);
                        throw error;
                    }

                    projectPrompt += `
                    
Previous attempt failed with error: ${errorMessage}
Please ensure your response:
1. Is valid JSON
2. Matches the structure described above
                    `;

                    this.logWarning(`Retrying project outline generation (${retries}/3 attempts remaining)`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            this.logSuccess("Successfully generated project outline");

            // 4. Save the project outline as a document
            this.logProgress("Saving project outline...");

            const documentObj = {
                title: `technical_project_${new Date().toISOString()}`,
                type: 'project',
                content: JSON.stringify(result, null, 2),
                abstract: JSON.stringify({
                    generatedAt: new Date().toISOString()
                }, null, 2),
                metadata: {
                    id: null,
                    title: `technical_project_${new Date().toISOString()}`
                }
            };

            const documentId = await documentModule.addDocument(this.spaceId, documentObj);

            // Replace adding sections with adding the summary from each chapter
            for (let chapter of result.chapters) {
                const chapterData = {
                    title: chapter.title,
                    idea: chapter.summary || ''
                };

                const newChapterId = await documentModule.addChapter(this.spaceId, documentId, chapterData);
                this.logInfo(`Added chapter: ${chapter.title}`, {
                    documentId,
                    chapterId: newChapterId
                });

                // Now add the summary as a paragraph instead of any sections
                const paragraphObj = {
                    text: chapter.summary || '',
                    commands: {}
                };

                const paragraphId = await documentModule.addParagraph(
                    this.spaceId,
                    documentId,
                    newChapterId,
                    paragraphObj
                );
                this.logInfo(`Added paragraph for chapter summary`, {
                    documentId,
                    chapterId: newChapterId,
                    paragraphId
                });
            }

            this.logSuccess("Successfully added project chapters and paragraphs");
            this.logSuccess(`Project outline saved as document with ID: ${documentId}`);

            return {
                status: 'completed',
                result: result,
                documentId: documentId
            };

        } catch (error) {
            this.logError(`Error in project outline generation: ${error.message}`);
            throw error;
        }
    },

    cancelTask: async function () {
        this.logWarning("Task cancelled by user");
    },

    serialize: async function () {
        return {
            taskType: 'ProjectCreator',
            parameters: this.parameters
        };
    },

    getRelevantInfo: async function () {
        return {
            taskType: 'ProjectCreator',
            parameters: this.parameters
        };
    }
};
