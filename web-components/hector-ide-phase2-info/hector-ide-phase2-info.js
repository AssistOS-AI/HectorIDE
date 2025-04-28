// import sdkModule from "../../../../../../../assistos-sdk/modules/application";

const assistOSSDK = require("assistos")
const llmModule = require("assistos").loadModule("llm", {});
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;

export class HectorIdePhase2Info {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();
        this.documentId = this.element.getAttribute("data-documentId")
    }

    async beforeRender() {

    }

    async afterRender() {
    }



    async closeModal(_target, taskId) {
        await assistOS.UI.closeModal(_target, taskId);
    }


}
