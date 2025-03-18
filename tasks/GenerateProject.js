module.exports = {
    runTask: async function () {
        try {
            this.logInfo("Initializing project generation task...");
            const llmModule = await this.loadModule("llm");
            const utilModule = await this.loadModule("util");
            const personalityModule = await this.loadModule("personality");
            const documentModule = await this.loadModule("document");
            // const mermaid = require ("mermaid");
            const mermaidImport = await import('../../../../../../apihub-root/wallet/lib/mermaid/mermaid.esm.min.mjs');
            const mermaid = mermaidImport.default;
            mermaid.initialize({startOnLoad: false});

            // const { JSDOM } = require('jsdom');

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
            this.logProgress("Constructing project generation prompt...");
            let projectPrompt = `
You are an IT manager responsible to implement a project with the following  context:
User's Project Focus: **Project Title:** "Online Bookstore Application"
- **Informative Text on Goal and Production:** "Develop a scalable and secure online bookstore that supports user registration, book browsing, search functionality, payment processing, and order tracking. The system should integrate inventory management and customer review functionalities."
- **Prompt: Generate Project Specifications, APIs, etc.:** "Generate detailed project specifications including API design, database schema, microservices architecture, Docker containerization, CI/CD pipelines, and cloud deployment strategies."
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
- The summary section must be focused on the implementation from the chapter's name
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
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            this.logSuccess("Successfully generated project outline");

            // Diagram section

            const promptDiagram = `
                    Generate a valid Mermaid diagram using "graph TD" for a vertical diagram.
                    - Output ONLY plain text-based Mermaid code (no numeric encoding, no code fences).
                    - Use standard ASCII characters for arrows and relationships (e.g. A-->B).
                    - Avoid special characters like :, >, or | in node labels, except for valid Mermaid arrow syntax.
                    - Replace spaces in node names with underscores (_) or camelCase to ensure compatibility.
                    - Ensure the code is well-formed and error-free.
                    - Do NOT wrap the code in backticks or any code fences.
                    - Here's the context (but do NOT include it in the output):
                      * Project Title: "Online Bookstore Application"
                      * Goal: "Develop a scalable and secure online bookstore..."
                      * Prompt: "Generate detailed project specs: APIs, DB schema, microservices..."
                    Remember, return ONLY the Mermaid code.

                    This is the project schema, use it:
                    - **Project Title:** "Online Bookstore Application"
                    - **Informative Text on Goal and Production:** "Develop a scalable and secure online bookstore that supports user registration, book browsing, search functionality, payment processing, and order tracking. The system should integrate inventory management and customer review functionalities."
                    - **Prompt: Generate Project Specifications, APIs, etc.:** "Generate detailed project specifications including API design, database schema, microservices architecture, Docker containerization, CI/CD pipelines, and cloud deployment strategies."
                    `;


            let responseDiagram;
            const getLLMResponseWithTimeoutDiagram = async (promptDiagram, timeout = 90000) => {
                return Promise.race([
                    llmModule.generateText(this.spaceId, promptDiagram),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('LLM request timed out')), timeout)
                    )
                ]);
            };

            responseDiagram = await getLLMResponseWithTimeoutDiagram(promptDiagram);
            this.logInfo('Raw response DIAGRAM:', responseDiagram);

            responseDiagram = responseDiagram.message;

            this.logInfo('Diagram text (before cleaning):', responseDiagram);
            let cleanedCode = responseDiagram
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (cleanedCode.length <= 2) {
                this.logInfo('Textul are mai puțin de trei linii, nu pot elimina prima și ultima linie.');
            } else {
                cleanedCode.shift();
                cleanedCode.pop();
            }

            let finalCode = cleanedCode.join('\n');
            this.logInfo('Deleted first and last line diagram:', finalCode);

            const parseOptions = {suppressErrors: true};
            let cnt = 0;
            let ok = false;
            while(!ok) {

                if (await mermaid.parse(finalCode, parseOptions) !== false) {
                    this.logInfo("The mermaid code is correct!");
                    ok = true;

                } else {
                    this.logInfo("Mermaid syntax error! Attempting to correct or handle it...");
                    cnt += 1;
                    this.logInfo(cnt);
                    if (cnt > 20) {
                        this.logInfo("We reached a final, the mermaid code is too wrong to be corrected.");

                        break;
                    } else {
                        this.logInfo("Attempting to correct the Mermaid code.");
                        const prompt_2 = `Fix and validate the given Mermaid "graph TD" code:
                          - Correct syntax errors and relationships.
                          - Do not include any code block markers (e.g., \`\`\`mermaid).
                          - Replace spaces in node names with underscores or camelCase.
                          - Exclude "classDef" or style definitions.
                          - Return only the corrected Mermaid code, no text or explanations. Input: ${finalCode}`;

                        responseDiagram = await getLLMResponseWithTimeoutDiagram(prompt_2);
                        finalCode = responseDiagram.message;
                        this.logInfo("Corrected Mermaid code:", finalCode);
                    }
                }
            }

            if(cnt<20){
                // try {
                //     const {svg} = await mermaid.render('graphDiv', finalCode);
                // }catch (e) {
                //     console.error(e.message);
                // } // TODO resolv mermaid render on server side
            }

            this.logProgress("Saving project outline...");
            const documentObj = {
                title: `Test7`,
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

            //User prompt information

            const chapterDataPrompt = {
                title: "Modify the document",
                idea: "Chapter containing the prompt for the user I guess"
            }

            const chapterIdPrompt = await documentModule.addChapter(this.spaceId, documentId, chapterDataPrompt);

            const paragraphObjPrompt = {
                text: "Here you can change the content of the document using your imagination ( considering the LLMs limitation ) :)",
                commands: {}
            }

            const paragraphIdPrompt = await documentModule.addParagraph(
                this.spaceId,
                documentId,
                chapterIdPrompt,
                paragraphObjPrompt
            );

            const chapterData = {
                title: "MermaidDiagramChapter",
                idea: "Chapter containing the final valid Mermaid diagram"
            };

            const chapterId = await documentModule.addChapter(this.spaceId, documentId, chapterData);
            this.logInfo(`Added chapter: MermaidDiagramChapter`, {
                documentId,
                chapterId
            });
            let paragraphObj = {};



            if (cnt <= 20) {
                paragraphObj = {
                    text: finalCode,
                    comment: finalCode,
                    commands: {}
                };
            }
            else{
                paragraphObj = {
                    text: "The diagram operation failed",
                    commands: {}
                };
            }

            const paragraphId = await documentModule.addParagraph(
                this.spaceId,
                documentId,
                chapterId,
                paragraphObj
            );
            this.logInfo(`Added paragraph with Mermaid code`, {
                documentId,
                chapterId,
                paragraphId
            });

            this.logSuccess("Successfully added document, chapter, and paragraph with the Mermaid diagram.");

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
                //


                // const promptParagraph =
                //     `Using the information from the text: ${chapter.summary}, generate a detailed description of the practical implementation of the "Online Bookstore Application" project.
                // - Maintain an overview of the system architecture but focus primarily on the information from chapter.summary.
                // - Ensure that the response contains a maximum of 400 characters and is clear, coherent, and well-structured.
                // - Use the project schema as a high-level reference but prioritize practical implementation details based on chapter.summary.
                //
                //   This is the project schema, use it as an eagle view of the project:
                //     - **Project Title:** "Online Bookstore Application"
                //     - **Informative Text on Goal and Production:** "Develop a scalable and secure online bookstore that supports user registration, book browsing, search functionality, payment processing, and order tracking. The system should integrate inventory management and customer review functionalities."
                //     \`;
                // `;
                //
                //
                // let responseParagraph;
                // const getLLMResponseWithTimeoutDiagram = async (promptParagraph, timeout = 90000) => {
                //     return Promise.race([
                //         llmModule.generateText(this.spaceId, promptParagraph),
                //         new Promise((_, reject) =>
                //             setTimeout(() => reject(new Error('LLM request timed out')), timeout)
                //         )
                //     ]);
                // };
                //
                // responseParagraph = await getLLMResponseWithTimeoutDiagram(promptParagraph);
                // this.logInfo('Raw response DIAGRAM:', responseParagraph);
                //
                // responseParagraph = responseParagraph.message;
                //
                // const paragraphObj = {
                //     text: responseParagraph || '',
                //     commands: {}
                // };



                //


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