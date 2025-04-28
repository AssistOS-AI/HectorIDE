const applicationModule = require('assistos').loadModule('application', {});
const documentModule = require('assistos').loadModule('document', {});

export class HectorIdeComponentsModal {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.documentOptions = [];
        this.documentId = this.element.getAttribute("data-documentId");
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.invalidate();
    }

    async beforeRender() {
        try {
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            const phase1DocumentsMetadata = allDocumentsMetadata.filter((doc) => doc.title?.startsWith("Phase1")) || [];
            console.log('Number of Phase1 documents:', phase1DocumentsMetadata.length);
            this.documents = phase1DocumentsMetadata;
            this.documentOptions = phase1DocumentsMetadata.map(doc => {
                const title = doc.title || doc.name || doc.id;
                return `<option value="${doc.id}">${title}</option>`;
            }).join('');

        } catch (error) {
            console.error('Error loading document data:', error);
            this.documentOptions = '<option value="">Error loading documents</option>';
        }
    }

    async afterRender() {
        this.setupEventListeners();
        document.addEventListener('themechange', this.handleThemeChange.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('themechange', this.handleThemeChange.bind(this));
    }

    async closeModal(_target, taskId) {
        await assistOS.UI.closeModal(_target, taskId);
    }

    setupEventListeners() {
        const form = this.element.querySelector('#explainForm');
        const submitButton = this.element.querySelector('#explainButton');
        const documentSelect = this.element.querySelector('#document');

        if (!submitButton || !documentSelect) {
            console.warn("Submit button or document select not found during setupEventListeners.");
            return;
        }

        const updateButtonState = () => {
            const isDocumentSelected = documentSelect.value !== "";
            submitButton.disabled = !isDocumentSelected;
            submitButton.style.opacity = isDocumentSelected ? '1' : '0.6';
            submitButton.style.cursor = isDocumentSelected ? 'pointer' : 'not-allowed';
        };

        updateButtonState();

        documentSelect.addEventListener('change', updateButtonState);

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (submitButton.disabled) {
                    console.log("Submit attempted while button is disabled.");
                    return;
                }
                await this.handleExplanation(form);
            });
        } else {
            console.warn("Form #explainForm not found during setupEventListeners.");
        }
    }

    async extractDocumentContent(document) {
        if (!document) return '';
        if (document.chapters && Array.isArray(document.chapters)) {
            return document.chapters
                .map(chapter => {
                    const texts = [];
                    if (chapter && typeof chapter.title === 'string') {
                        texts.push(`Chapter: ${chapter.title}`);
                    }
                    if (chapter && Array.isArray(chapter.paragraphs)) {
                        texts.push(chapter.paragraphs
                            .filter(p => p && typeof p.text === 'string')
                            .map(p => p.text)
                            .join('\n\n'));
                    }
                    return texts.filter(t => t && t.trim()).join('\n\n');
                })
                .filter(t => t && t.trim())
                .join('\n\n');
        }
        if (typeof document.content === 'string') {
            return document.content;
        }
        console.warn("Could not extract meaningful content from document:", document.id);
        return '';
    }

    async handleExplanation(form) {
        const submitButton = this.element.querySelector('#explainButton');
        if (submitButton) submitButton.disabled = true;

        try {
            await assistOS.loadifyFunction(async () => {
                const formData = await assistOS.UI.extractFormInformation(form);
                console.log('Form data:', formData);

                const documentSelect = form.querySelector('#document');
                const selectedDocumentId = documentSelect ? documentSelect.value : null;

                const modificationDetailsElement = form.querySelector('#modificationDetails');
                const modificationDetails = modificationDetailsElement ? modificationDetailsElement.value : "";

                if (!selectedDocumentId) {
                    if (submitButton) submitButton.disabled = false;
                    return assistOS.UI.showApplicationError("Invalid form data", "Please select a document", "error");
                }

                console.log('Target Document ID (attribute):', this.documentId);
                console.log('Source Document ID (selected):', selectedDocumentId);

                const taskData = {
                    sourceDocumentId: selectedDocumentId,
                    modificationPrompt: modificationDetails
                };

                console.log('Running application task with data:', taskData);
                const taskId = await applicationModule.runApplicationTask(
                    assistOS.space.id,
                    "HectorIDE",
                    "GeneratePhase2",
                    taskData
                );

                await assistOS.UI.closeModal(this.element, taskId);

            });

        } catch (error) {
            console.error('Error in handleExplanation:', error);
            if (submitButton) {
                const docSelect = this.element.querySelector('#document');
                submitButton.disabled = !docSelect || docSelect.value === "";
            }
            assistOS.UI.showApplicationError("Error", error.message || "Failed to start generation task", "error");
        }
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        this.invalidate();
    }

    setDocumentId(documentId) {
        console.log('HectorIdeComponentsModal: setDocumentId called with:', documentId);
        if (this.documentId !== documentId) {
            this.documentId = documentId;
        }
    }
}