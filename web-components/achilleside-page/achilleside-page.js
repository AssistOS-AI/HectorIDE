// import sdkModule from "../../../../../../../assistos-sdk/modules/application";

const assistOSSDK = require("assistos")
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});

export class AchillesIDEPage {
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


                // TODO ce este extractFormInformation si un exemplu de formular invalid
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
                    "AchillesIDE",
                    "GenerateProject",
                    projectData
                );
                console.log('Task created with ID:', taskId);
                assistOS.watchTask(taskId);
                await assistOS.UI.closeModal(this.element, taskId);
            });

        } catch (error) {
            console.error('Error in handleAnalysis:', error);
            assistOS.UI.showApplicationError("Analysis Error", error.message, "error");
        }
    }


    // async saveProject1 (_target){
    //
    //     try {
    //         await assistOS.loadifyFunction(async () => {
    //             const formElement = this.element.querySelector("form");
    //             const formData = await assistOS.UI.extractFormInformation(formElement);
    //             if (!formData.isValid) {
    //                 return assistOS.UI.showApplicationError("Invalid form data", "Please fill all the required fields", "error");
    //             }
    //             const planData = formData.data;
    //
    //             const response = await applicationModule.runApplicationFlow(
    //                 assistOS.space.id,
    //                 "AchillesIDE",
    //                 "GenerateApplication",
    //                 planData
    //             );
    //
    //             const documentId = response.data;
    //             await assistOS.UI.changeToDynamicPage(
    //                 `space-application-page`,
    //                 `${assistOS.space.id}/Space/document-view-page/${documentId}`
    //             );
    //         });
    //     } catch (error) {
    //         console.error("Error while saving the project:", error);
    //         alert(`Error: ${error.message || "Unknown error occurred"}`);
    //     }
    // }
}
