export class AchillesIDEPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.invalidate();

    }

    async beforeRender() {

    }

    async afterRender() {

    }


}
function saveProject() {
    alert("Project Saved Successfully!");
}