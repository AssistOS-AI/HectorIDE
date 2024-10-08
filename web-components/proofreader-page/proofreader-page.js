export class ProofReaderPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();
        this.text = "";
    }

    beforeRender() {
        this.background = `spaces/${assistOS.space.id}/applications/ProofReader/assets/background.png`;
        if(!this.personality){
            this.selectedPersonality = `<option value="" disabled selected hidden>Select personality</option>`;
        }else {
            this.selectedPersonality = `<option value="${this.personality.id}" selected>${this.personality.name}</option>`
        }
        let stringHTML = "";
        for(let personality of assistOS.space.personalities){
            stringHTML+=`<option value=${personality.id}>${personality.name}</option>`;
        }
        this.personalitiesOptions = stringHTML;
    }

    afterRender(){
        if(this.generatedText!==undefined){
            let refreshButton=this.element.querySelector("#refresh-button");
            let copyButton=this.element.querySelector("#copy-button");
            try{
                refreshButton.style.display="block";
                copyButton.style.display="block";
            }catch(e){
                console.error("Error trying to change the display of the buttons"+e);
            }
        }
        let textElement = this.element.querySelector("#text");
        textElement.value = this.text;
        if(this.generatedText){
            let aiText = this.element.querySelector(".generated-text-container");
            aiText.style.display = "flex";
        }
        let detailsElement = this.element.querySelector("#details");
        if(this.details){
            detailsElement.value = this.details;
        }
    }

    async executeProofRead(formElement) {
        const formData= await assistOS.UI.extractFormInformation(formElement);
        if(formData.isValid){
            this.text = formData.data.text;
            this.personality = assistOS.space.getPersonality(formData.data.personality);
            this.details = formData.data.details;
            let result = await assistOS.callFlow("Proofread", {
                text: this.text,
                prompt: formData.data.prompt
            }, formData.data.personality);
            this.observations = result.observations;
            this.generatedText = result.improvedText;
            this.invalidate();
        }
    }

    async regenerate(_target){
        if(this.text!==undefined){
            await this.executeProofRead(this.element.querySelector("form"));
        }
    }
    async copyText(_target){
        let text=await assistOS.UI.reverseQuerySelector(_target,".improved-text-container");
        if(text){
            await navigator.clipboard.writeText(text.innerText);
            text.insertAdjacentHTML("afterend", `<confirmation-popup data-presenter="confirmation-popup" 
                    data-message="Copied!" data-left="${text.offsetWidth+150}"></confirmation-popup>`);
        }
    }
}
