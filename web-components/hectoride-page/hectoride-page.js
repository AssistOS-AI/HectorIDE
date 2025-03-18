// import sdkModule from "../../../../../../../assistos-sdk/modules/application";

const assistOSSDK = require("assistos")
const llmModule = require("assistos").loadModule("llm", {});
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;

export class HectorIDEPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();
        this.documentId = this.element.getAttribute("data-documentId")
    }

    async beforeRender() {

    }

    async afterRender() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const form = this.element.querySelector('#projectForm');
        form.addEventListener('submit', async (e) => {
            // console.log(112);
            e.preventDefault();
            await this.handleAnalysis(form);
        });
    }

    async handleAnalysis(form) {
        try {
            await assistOS.loadifyFunction(async () => {
                console.log('Extracting form data...');
                const formData = await assistOS.UI.extractFormInformation(form);
                console.log('Form data:', formData);

                if (!formData.isValid) {
                    console.error('Invalid form data');
                    return assistOS.UI.showApplicationError("Invalid form data", "Please fill all the required fields", "error");
                }

                const { projectTitle, informativeText, promptText } = formData.data;
                console.log('Extracted data:', { projectTitle, informativeText, promptText });
                let projectData = {
                    projectTitle,
                    informativeText,
                    promptText,
                };

                console.log('Running application task with data:', projectData);
                const taskId = await applicationModule.runApplicationTask(
                    assistOS.space.id,
                    "HectorIDE",
                    "GenerateProject",
                    projectData
                );
                console.log('Task created with ID:', taskId);
                assistOS.watchTask(taskId);
                // await assistOS.UI.closeModal(this.element, taskId);
            });

        } catch (error) {
            console.error('Error in handleAnalysis:', error);
            assistOS.UI.showApplicationError("Analysis Error", error.message, "error");
        }
    }

    async ideasChat(){
        const input = document.querySelector(".message-input");
        input.classList.toggle("expanded");
    }

    async ideasButtonPress(){
        const promptIdea = "Hello";
        let personality = personalityModule.getPersonalityByName(assistOS.space.id,constants.DEFAULT_PERSONALITY_NAME);
        const getLLMResponseWithTimeout = async (promptIdea, timeout = 90000) => {
                return Promise.race([
                    llmModule.generateText(assistOS.space.id, promptIdea, personality.id),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('LLM request timed out')), timeout)
                    )
                ]);
            };

            const response= await getLLMResponseWithTimeout(promptIdea);
            console.log(response.message);
    }
}
