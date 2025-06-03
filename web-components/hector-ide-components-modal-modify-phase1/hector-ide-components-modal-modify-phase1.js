const applicationModule = require('assistos').loadModule('application', {});
const documentModule = require('assistos').loadModule('document', {});

export class HectorIdeComponentsModalModifyPhase1 {
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
        const modificationDetailsTextarea = this.element.querySelector('#modificationDetails');

        if (!submitButton || !documentSelect || !modificationDetailsTextarea) {
            console.warn("Submit button, document select, or modification textarea not found during setupEventListeners.");
            return;
        }

        const updateButtonState = () => {
            const isDocumentSelected = documentSelect.value !== "";
            const hasModificationDetails = modificationDetailsTextarea.value.trim() !== "";
            const canSubmit = isDocumentSelected && hasModificationDetails;

            submitButton.disabled = !canSubmit;
            submitButton.style.opacity = canSubmit ? '1' : '0.6';
            submitButton.style.cursor = canSubmit ? 'pointer' : 'not-allowed';
        };

        updateButtonState();

        documentSelect.addEventListener('change', updateButtonState);
        modificationDetailsTextarea.addEventListener('input', updateButtonState);

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (submitButton.disabled) {
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
        const originalButtonHTML = submitButton.innerHTML;

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = `<span class="button-icon">⏳</span> Processing...`;
        }

        try {
            const formData = await assistOS.UI.extractFormInformation(form);

            const selectedDocumentId = formData.data.document;
            const focusAreasPrompt = formData.data.modificationDetails ? formData.data.modificationDetails.trim() : "";

            let selectedDocumentFullTitle = '';
            const documentSelectElement = form.querySelector('#document');
            if (documentSelectElement && documentSelectElement.selectedIndex > 0) {
                selectedDocumentFullTitle = documentSelectElement.options[documentSelectElement.selectedIndex].text;
            } else if (documentSelectElement && documentSelectElement.value) {
                const foundDoc = this.documents.find(doc => doc.id === documentSelectElement.value);
                if (foundDoc) selectedDocumentFullTitle = foundDoc.title || foundDoc.name || foundDoc.id;
            }

            if (!selectedDocumentId) {
                assistOS.UI.showApplicationError("Invalid form data", "Please select a source document.", "error");
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonHTML;
                }
                return;
            }

            if (!focusAreasPrompt) {
                assistOS.UI.showApplicationError("Missing information", "Please specify the focus areas for Phase 2.", "error");
                if (submitButton) {
                    const docSelect = this.element.querySelector('#document');
                    const modDetails = this.element.querySelector('#modificationDetails');
                    submitButton.disabled = !docSelect || docSelect.value === "" || !modDetails || modDetails.value.trim() === "";
                    submitButton.innerHTML = originalButtonHTML;
                }
                return;
            }

            let baseTitle = selectedDocumentFullTitle;
            const phase1Suffix = "_Phase 1";
            if (baseTitle.endsWith(phase1Suffix)) {
                baseTitle = baseTitle.substring(0, baseTitle.length - phase1Suffix.length);
            }
            if (!baseTitle.trim()) {
                baseTitle = `Detailed_Document_Base_${new Date().getTime()}`;
            }
            baseTitle = baseTitle.trim(); // Titlul de bază curățat

            // Logică pentru versionare
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            const phase2Suffix = "_Phase 2";

            // Filtrăm documentele care conțin titlul de bază ȘI sunt de Faza 2
            // și care au un model de versionare _v1.x pentru a număra corect versiunile existente.
            const existingPhase2DocsForBaseTitle = allDocumentsMetadata.filter(doc => {
                return doc.title &&
                    doc.title.startsWith(baseTitle) && // Începe cu titlul de bază
                    doc.title.includes(phase2Suffix) && // Este un document de Faza 2
                    doc.title.match(/_v1\.\d+/);       // Are un sufix de versiune _v1.x
            });

            const newVersionIndex = existingPhase2DocsForBaseTitle.length; // 0 pt v1.0, 1 pt v1.1 etc.
            const versionString = `1.${newVersionIndex}`;
            const versionedTargetDocumentTitle = `${baseTitle}_v${versionString}${phase2Suffix}`;

            const taskData = {
                sourceDocumentId: selectedDocumentId,
                modificationPrompt: focusAreasPrompt,
                targetDocumentTitle: versionedTargetDocumentTitle,
            };

            console.log('Running application task "GeneratePhase2" with data:', taskData);
            const taskId = await applicationModule.runApplicationTask(
                assistOS.space.id,
                "HectorIDE",
                "GeneratePhase1Modified",
                taskData
            );

            await assistOS.UI.closeModal(this.element, taskId);

        } catch (error) {
            console.error('Error in handleFormSubmission:', error);
            // assistOS.UI.showApplicationError("Error", error.message || "Failed to start the document generation task.", "error");
        } finally {
            if (submitButton) {
                const docSelect = this.element.querySelector('#document');
                const modDetails = this.element.querySelector('#modificationDetails');
                if(docSelect && modDetails){
                    submitButton.disabled = !docSelect.value || !modDetails.value.trim();
                } else {
                    submitButton.disabled = true;
                }
                submitButton.innerHTML = originalButtonHTML;
            }
        }
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        this.invalidate();
    }

    setDocumentId(documentId) {
        if (this.documentId !== documentId) {
            this.documentId = documentId;
        }
    }
}