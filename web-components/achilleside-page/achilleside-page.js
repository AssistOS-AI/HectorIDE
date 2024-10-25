const assistOSSDK = require("assistos")

export class AchillesIDEPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();

    }
    saveProject() {
        const llmmodule = assistOSSDK.loadModule("llm")
        alert("Project Saved Successfully!");
    }


    async beforeRender() {

    }

    async afterRender() {

    }


}
