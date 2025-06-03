const documentModule = assistOS.loadModule('document', {});
const assistOSSDK = require("assistos")
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;

export class HectorIdeComponentsModalPhase3Preview {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.qaDocuments = [];
        this.documentOptions = [];
        this.selectedDocumentId = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.boundHandleThemeChange = this.handleThemeChange.bind(this);
        this.boundHandleDocumentSelectChange = this._handleDocumentSelectChange.bind(this);
        this.invalidate();
    }

    async beforeRender() {
        try {
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            this.qaDocuments = allDocumentsMetadata.filter(
                (doc) => doc.title?.endsWith("Code")
            ) || [];

            if (this.qaDocuments.length > 0) {
                this.documentOptions = this.qaDocuments.map(doc => {
                    let title = doc.title || doc.name || `Document ${doc.id || 'UnknownID'}`;
                    const displayTitle = title;
                    return `<option value="${doc.id}">${displayTitle}</option>`;
                }).join('');
            } else {
                this.documentOptions = '<option value="" disabled>No QA documents available for preview</option>';
            }
        } catch (error) {
            console.error("Error loading documents for preview modal:", error);
            this.documentOptions = '<option value="" disabled>Error loading documents</option>';
            this.qaDocuments = [];
        }
    }

    async afterRender() {
        document.removeEventListener('themechange', this.boundHandleThemeChange);
        document.addEventListener('themechange', this.boundHandleThemeChange);

        const qaSelect = this.element.querySelector('#qaDocumentSelect');
        if (qaSelect) {
            qaSelect.removeEventListener('change', this.boundHandleDocumentSelectChange);
            qaSelect.addEventListener('change', this.boundHandleDocumentSelectChange);
            this._updatePreviewButtonState();
        }
    }

    disconnectedCallback() {
        if (this.boundHandleThemeChange) {
            document.removeEventListener('themechange', this.boundHandleThemeChange);
        }
        const qaSelect = this.element.querySelector('#qaDocumentSelect');
        if (qaSelect) {
            qaSelect.removeEventListener('change', this.boundHandleDocumentSelectChange);
        }
    }

    _handleDocumentSelectChange(event) {
        this.selectedDocumentId = event.target.value;
        this._updatePreviewButtonState();
    }

    _updatePreviewButtonState() {
        const previewButton = this.element.querySelector('#previewQaButton');
        if (previewButton) {
            if (this.selectedDocumentId && this.selectedDocumentId !== "") {
                previewButton.removeAttribute('disabled');
            } else {
                previewButton.setAttribute('disabled', 'true');
            }
        }
    }

    async closeModal(buttonElement) {
        await assistOS.UI.closeModal(buttonElement.closest('.modal-overlay'), null);
    }

    async selectForPreviewAction(buttonElement) {
        if (this.selectedDocumentId) {
            await assistOS.UI.closeModal(buttonElement.closest('.modal-overlay'), this.selectedDocumentId);
        } else {
            console.warn("No document selected for preview.");
        }
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        if (typeof this.invalidate === 'function') {
            this.invalidate();
        }
    }
}