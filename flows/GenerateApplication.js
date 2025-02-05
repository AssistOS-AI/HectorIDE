const {getDefaultSpaceId} = require("../../../../../../apihub-components/users-storage/user");
const IFlow = require('assistos').loadModule('flow', {}).IFlow;

class GenerateApplication extends IFlow {
    static flowMetadata = {
        action: "Generate a Book Template",
        intent: "Generates a Book Template"
    };
    // project-title
// informative-text
    // project-details
    static flowParametersSchema = {
        title: {
            type: "string",
            required: false
        },
        edition: {
            type: "string",
            required: false
        },
    };

    constructor() {
        super();
    }

    async userCode(apis, parameters) {
        try {
            let sum = 0;
            const llmModule = apis.loadModule("llm");
            const spaceModule = apis.loadModule('space')
            const documentModule = apis.loadModule("document");

            const ensureValidJson = async (jsonString, maxIterations = 1, jsonSchema = null) => {
                const phases = {
                    "RemoveOutsideJson": async (jsonString) => {
                        if (jsonString.includes("```json")) {
                            jsonString = jsonString.split("```json")[1];
                            jsonString = jsonString.split("```")[0];
                        }
                        return jsonString;
                    },
                    "RemoveJsonMark": async (jsonString) => {
                        if (jsonString.startsWith("```json")) {
                            jsonString = jsonString.slice(7);
                            jsonString = jsonString.slice(0, -3);
                        }
                        return jsonString;
                    },
                    "RemoveNewLine": async (jsonString) => {
                        return jsonString.replace(/\n/g, "");
                    },
                    "TrimSpaces": async (jsonString) => {
                        return jsonString.trim();
                    },
                    "LlmHelper": async (jsonString) => {
                        if (jsonSchema !== null) {
                            const prompt = `Please correct the following JSON to match the schema ${JSON.stringify(jsonSchema)}:
                             ${jsonString}. Only respond with a valid Json that doesn't contain any code blocks or the \`\`\`json syntax.`;
                            const response = await llmModule.sendLLMRequest({
                                prompt,
                                modelName: "GPT-4o"
                            }, parameters.spaceId);
                            return response.messages[0];
                        }
                        return jsonString;
                    }
                };

                const phaseFunctions = Object.values(phases);

                while (maxIterations > 0) {
                    for (const phase of phaseFunctions) {
                        try {
                            JSON.parse(jsonString);
                            return jsonString;
                        } catch (error) {
                            jsonString = await phase(jsonString);
                        }
                    }
                    maxIterations--;
                }
                throw new Error("Unable to ensure valid JSON after all phases.");
            };

            const createChaptersPrompt = (generationTemplateStructure, bookData, bookGenerationInfo, generalLlmInfo) => {
                const base = `You are an IT Manager tasked with creating a clear, professional schema plan for a software application based on specific requirements.` +
                    ` The goal is to produce a structured plan that is both logical and concise.` +
                    ` Additionally, if the chapter information would benefit a technical diagram, set "requiresDiagrams" to "Yes" regardless of its original value.` +
                    ` Ensure this convention is strictly followed for all technical chapters.` +
                    ` Your response must match the following JSON schema exactly: ${JSON.stringify(generationTemplateStructure)}.` +
                    ` Under no circumstances should your response include additional information, explanations, or code blocks.`;

                const specialInstructions = `Special Configuration: ${generalLlmInfo}. Ensure the response includes no fewer than 10 chapters, structured and concise.`;
                const bookDataInstructions = `Book Generation Specifications: ${bookGenerationInfo}`;
                const bookInfo = `Book data: ${JSON.stringify(bookData)}`;

                return [base, specialInstructions, bookDataInstructions, bookInfo].join("\n");
            };



            const createParagraphsPrompt = (generationTemplateStructure, bookData, chapterData, bookGenerationInfo, generalLlmInfo) => {
                const base = `You are an IT Manager responsible for developing a well-organized outline for software documentation.` +
                    ` This outline will be part of a structured plan for a software application.` +
                    ` Ensure this convention is strictly followed for all technical paragraphs.` +
                    ` Your response must match the following JSON schema exactly: ${JSON.stringify(generationTemplateStructure)}.` +
                    ` Under no circumstances should your response include additional information, explanations, or code blocks.`;

                const specialInstructions = `Special Configuration: ${generalLlmInfo}`;
                const bookDataInstructions = `Book Generation Specifications: ${bookGenerationInfo}`;
                const bookInfo = `Book data: ${JSON.stringify(bookData)}`;
                const chapterInfo = `Chapter data: ${JSON.stringify(chapterData)}`;
                const overrideParagraphCountBias = `Generate the appropriate number of paragraphs, ensuring each chapter is fully developed.` +
                    ` There is no maximum limit, so include as many paragraphs as the chapter needs.`;

                return [base, specialInstructions, bookDataInstructions, bookInfo, chapterInfo, overrideParagraphCountBias].join("\n");
            };


            const generationTemplateChapters = {
                chapters: [
                    {
                        title: "String",
                        idea: "String",
                        requiresDiagrams: "Yes/No"
                    }
                ]
            };

            const generationTemplateParagraphs = {
                paragraphs: [
                    {
                        "idea": "String"
                    }
                ]
            };

            const bookGenerationInfo = parameters.configs.informativeText;
            const generalLlmInfo = parameters.configs.prompt;
            const technicalDiagram = parameters.config.technicalDiagram;
            const bookData = parameters.configs;

            const documentObj = {
                title: `template_${bookData["project-title"]}`,
                abstract: JSON.stringify({
                    ...bookData,
                    generationInfo: bookGenerationInfo,
                    llmInfo: generalLlmInfo
                }),
            };
            const documentId = await documentModule.addDocument(parameters.spaceId, documentObj);

            apis.success(documentId);

            const chaptersPrompt = createChaptersPrompt(generationTemplateChapters, bookData, bookGenerationInfo, generalLlmInfo);

            const llmResponse = await llmModule.sendLLMRequest({
                prompt: chaptersPrompt,
                modelName: "GPT-4o"
            }, parameters.spaceId);

            const chaptersJsonString = await ensureValidJson(llmResponse.messages[0], 5, generationTemplateChapters);

            const chapters = JSON.parse(chaptersJsonString);
            for (const chapter of chapters.chapters) {
                let isTechnicalChapter = 0;

                if (chapter.requiresDiagrams === "Yes") {
                    isTechnicalChapter = 1;
                }

                const chapterObj = {
                    title: chapter.title,
                    idea: chapter.idea,
                };
                const chapterId = await documentModule.addChapter(parameters.spaceId, documentId, chapterObj);

                const paragraphsPrompt = createParagraphsPrompt(generationTemplateParagraphs, bookData, chapter, bookGenerationInfo, generalLlmInfo);

                const llmResponse = await llmModule.sendLLMRequest({
                    prompt: paragraphsPrompt,
                    modelName: "GPT-4o"
                }, parameters.spaceId);

                const paragraphsJsonString = await ensureValidJson(llmResponse.messages[0], 5, generationTemplateParagraphs);
                const paragraphsData = JSON.parse(paragraphsJsonString);

                for (const paragraph of paragraphsData.paragraphs) {
                    const paragraphObj = {
                        text: paragraph.idea,
                    };
                    const paragraphId = await documentModule.addParagraph(parameters.spaceId, documentId, chapterId, paragraphObj);

                }
                if (isTechnicalChapter === 1) {
                    const chapterName = "Technical Diagram";
                    const imageObject = {
                        "spaceId": parameters.spaceId,
                        "prompt": `Generate a detailed technical diagram focusing on the core concept: "${chapterName}". Ensure the diagram provides clear technical details specific to this topic, with the wider context illustrating ${parameters.configs["informative-text"]}.`,
                        "modelName": "DALL-E-3",
                        "size": "1792x1024",
                        "style": "natural",
                        "quality": "standard",
                        "variants": "1"
                    }
                    const response = await llmModule.generateImage(parameters.spaceId, imageObject)
                    const imageId = response[0].id;
                    const commandObj = {"image": {id: imageId, width: 1792, height: 1024}};
                    await documentModule.updateParagraphCommands(parameters.spaceId, documentId, paragraphId, commandObj);
                }
            }
            // Add conclusion Diagram
            const imageObject = {
                "spaceId": parameters.spaceId,
                "prompt": `Generate a high-level, "eagle's view" technical diagram that provides an overview of the entire application. Ensure the diagram presents a comprehensive architecture overview, including essential components and their relationships, while maintaining technical clarity. Illustrate the wider context with details on ${parameters.configs["informative-text"]}.`,
                "modelName": "DALL-E-3",
                "size": "1792x1024",
                "style": "natural",
                "quality": "standard",
                "variants": "1"
            }
            const response = await llmModule.generateImage(parameters.spaceId, imageObject)
            const imageId = response[0].id;
            const commandObj = {"image": {id: imageId, width: 1792, height: 1024}};
            await documentModule.updateParagraphCommands(parameters.spaceId, documentId, paragraphId, commandObj);


        } catch (e) {
            apis.fail(e);
        }
    }
}

module.exports = GenerateApplication;