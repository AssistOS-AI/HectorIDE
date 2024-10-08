export class AchillesIDEPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();

    }

    async beforeRender() {
        this.insertedText = "Dummy text"
    }

    async afterRender() {

    }

}
