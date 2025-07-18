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
            const phase1DocumentsMetadata = allDocumentsMetadata.filter((doc) => doc.title?.endsWith("Phase 1")) || [];
            console.log('Number of Phase1 documents for source selection:', phase1DocumentsMetadata.length);
            this.documents = phase1DocumentsMetadata;
            this.documentOptions = phase1DocumentsMetadata.map(doc => {
                const title = doc.title || doc.name || doc.id;
                return `<option value="${doc.id}">${title}</option>`;
            }).join('');

        } catch (error) {
            console.error('Error loading source document data:', error);
            this.documentOptions = '<option value="">Error loading documents</option>';
        }
    }

    async afterRender() {
        this.setupEventListeners();
        document.removeEventListener('themechange', this.handleThemeChangeBound);
        this.handleThemeChangeBound = this.handleThemeChange.bind(this);
        document.addEventListener('themechange', this.handleThemeChangeBound);
    }

    disconnectedCallback() {
        if (this.handleThemeChangeBound) {
            document.removeEventListener('themechange', this.handleThemeChangeBound);
        }
    }

    async closeModal(_target, taskId) {
        await assistOS.UI.closeModal(_target, taskId);
    }

    setupEventListeners() {
        const form = this.element.querySelector('#explainForm');
        const submitButton = this.element.querySelector('#explainButton');
        const documentSelect = this.element.querySelector('#document');

        if (!submitButton || !documentSelect) {
            console.warn("Submit button or source document select not found during setupEventListeners.");
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
                await this.handleFormSubmission(form);
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

    async handleFormSubmission(form) {
        const submitButton = this.element.querySelector('#explainButton');
        const originalButtonHTML = submitButton.innerHTML; // Save original HTML content

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<span class="button-icon">⏳</span> Processing...`;
        }

        try {
            const formData = await assistOS.UI.extractFormInformation(form);
            console.log('Form data:', formData.data);

            const selectedDocumentId = formData.data.document;
            const focusAreasPrompt = formData.data.modificationDetails || "";

            let selectedDocumentTitle = '';
            const documentSelectElement = form.querySelector('#document');
            if (documentSelectElement && documentSelectElement.selectedIndex > 0) {
                selectedDocumentTitle = documentSelectElement.options[documentSelectElement.selectedIndex].text;
            } else if (documentSelectElement && documentSelectElement.value) {
                const foundDoc = this.documents.find(doc => doc.id === documentSelectElement.value);
                if (foundDoc) selectedDocumentTitle = foundDoc.title || foundDoc.name || foundDoc.id;
            }

            if (!selectedDocumentId) {
                assistOS.UI.showApplicationError("Invalid form data", "Please select a source document.", "error");
                // Button state will be re-evaluated by updateButtonState if modal doesn't close
                // or handled in finally block if it should be re-enabled immediately.
                // For now, let the finally block handle re-enabling if an error occurs before task run.
                if (submitButton) {
                    submitButton.disabled = false; // Re-enable immediately
                    submitButton.innerHTML = originalButtonHTML;
                }
                return;
            }

            console.log('Source Document ID (selected):', selectedDocumentId);
            console.log('Source Document Title (for deriving target):', selectedDocumentTitle);
            console.log('Focus Areas Prompt:', focusAreasPrompt);

            let targetDocumentBaseTitle = selectedDocumentTitle;
            const phaseSuffix = "_Phase 1";
            if (targetDocumentBaseTitle.endsWith(phaseSuffix)) {
                targetDocumentBaseTitle = targetDocumentBaseTitle.substring(0, targetDocumentBaseTitle.length - phaseSuffix.length);
            }
            if (!targetDocumentBaseTitle.trim()) {
                targetDocumentBaseTitle = `Detailed_Document_${new Date().getTime()}`; // Fallback title
            }

            const taskData = {
                sourceDocumentId: selectedDocumentId,
                modificationPrompt: focusAreasPrompt,
                targetDocumentTitle: targetDocumentBaseTitle.trim(),
            };

            console.log('Running application task "GeneratePhase2" with data:', taskData);
            const taskId = await applicationModule.runApplicationTask(
                assistOS.space.id,
                "HectorIDE",
                "GeneratePhase2",
                taskData
            );

            await assistOS.UI.closeModal(this.element, taskId);

        } catch (error) {
            console.error('Error in handleFormSubmission:', error);
            assistOS.UI.showApplicationError("Error", error.message || "Failed to start the document generation task.", "error");
        } finally {
            if (submitButton) {
                // Re-enable based on selection, not just blanket enable
                const docSelect = this.element.querySelector('#document');
                submitButton.disabled = !docSelect || docSelect.value === "";
                submitButton.innerHTML = originalButtonHTML; // Restore original button text/icon
            }
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