const applicationModule = require('assistos').loadModule('application', {});
// Am eliminat personalityModule
const documentModule = require('assistos').loadModule('document', {});

export class HectorIdeComponentsModal {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        // Am eliminat this.personalities și this.personalityOptions
        this.documents = [];
        this.documentOptions = [];
        this.documentId = this.element.getAttribute("data-documentId"); // Presupun că acesta e documentul țintă, nu sursa
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.invalidate();
    }

    async beforeRender() {
        try {
            // Am eliminat încărcarea personalităților

            // Încarcă documentele sursă (Phase1)
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            const phase1DocumentsMetadata = allDocumentsMetadata.filter((doc) => doc.title?.startsWith("Phase1")) || [];
            console.log('Number of Phase1 documents:', phase1DocumentsMetadata.length);
            this.documents = phase1DocumentsMetadata; // Stochează metadatele filtrate
            this.documentOptions = phase1DocumentsMetadata.map(doc => {
                const title = doc.title || doc.name || doc.id;
                return `<option value="${doc.id}">${title}</option>`;
            }).join('');

        } catch (error) {
            console.error('Error loading document data:', error);
            // Am eliminat resetarea personalityOptions
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
        const documentSelect = this.element.querySelector('#document'); // Selectăm dropdown-ul documentelor

        if (!submitButton || !documentSelect) {
            console.warn("Submit button or document select not found during setupEventListeners.");
            return;
        }

        // Funcție pentru a verifica starea butonului
        const updateButtonState = () => {
            const isDocumentSelected = documentSelect.value !== "";
            submitButton.disabled = !isDocumentSelected;
            submitButton.style.opacity = isDocumentSelected ? '1' : '0.6';
            submitButton.style.cursor = isDocumentSelected ? 'pointer' : 'not-allowed';
        };

        // Starea inițială a butonului
        updateButtonState();

        // Adăugăm listener pe selectul de documente
        documentSelect.addEventListener('change', updateButtonState);

        // Listener pentru submit-ul formularului
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                // Verificăm din nou starea înainte de a trimite
                if (submitButton.disabled) {
                    console.log("Submit attempted while button is disabled.");
                    return;
                }
                await this.handleExplanation(form);
            });
        } else {
            console.warn("Form #explainForm not found during setupEventListeners.");
        }

        // Am eliminat logica legată de #personalityCheckboxes
    }

    // Funcția extractDocumentContent rămâne neschimbată
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
        if (submitButton) submitButton.disabled = true; // Dezactivăm butonul la începutul procesării

        try {
            await assistOS.loadifyFunction(async () => {
                const formData = await assistOS.UI.extractFormInformation(form);
                console.log('Form data:', formData);

                // Extragem doar datele relevante (document sursă și modificări)
                const documentSelect = form.querySelector('#document');
                const selectedDocumentId = documentSelect ? documentSelect.value : null;

                const modificationDetailsElement = form.querySelector('#modificationDetails');
                const modificationDetails = modificationDetailsElement ? modificationDetailsElement.value : "";

                // Validăm doar documentul selectat
                if (!selectedDocumentId) {
                    // Reactivăm butonul dacă există eroare înainte de task
                    if (submitButton) submitButton.disabled = false;
                    return assistOS.UI.showApplicationError("Invalid form data", "Please select a document", "error");
                }

                // Am eliminat extragerea și validarea personalităților
                // Am eliminat încărcarea detaliilor personalităților

                console.log('Target Document ID (attribute):', this.documentId); // Acesta rămâne, probabil e documentul unde se adaugă rezultatul? Sau nu mai e relevant?
                console.log('Source Document ID (selected):', selectedDocumentId);

                // Obținerea conținutului documentului sursă rămâne la fel
                // console.log('Getting source document content...'); //Deja se face în task runner?
                // const sourceDoc = await documentModule.getDocument(assistOS.space.id, selectedDocumentId);
                // const sourceDocContent = await this.extractDocumentContent(sourceDoc);
                // if (!sourceDocContent) {
                //     console.warn(`Could not extract text from source document ${selectedDocumentId}.`);
                // }

                // Construim taskData FĂRĂ personalități
                const taskData = {
                    // personalities: validPersonalityDetails, // Eliminat
                    // sourceDocumentContent: sourceDocContent, // Transmis deja? Task runner-ul îl va extrage probabil bazat pe ID
                    sourceDocumentId: selectedDocumentId, // ID-ul documentului sursă
                    // targetDocumentId: this.documentId, // Necesitatea acestuia depinde de logica task runner-ului
                    modificationPrompt: modificationDetails // Cererea de modificare
                };

                console.log('Running application task with data:', taskData);
                const taskId = await applicationModule.runApplicationTask(
                    assistOS.space.id,
                    "HectorIDE", // Numele aplicației/agentului
                    "GeneratePhase2", // Numele task-ului specific (poate trebuie redenumit)
                    taskData
                );

                await assistOS.UI.closeModal(this.element, taskId);

            });

        } catch (error) {
            console.error('Error in handleExplanation:', error);
            // Reactivăm butonul în caz de eroare
            if (submitButton) {
                const docSelect = this.element.querySelector('#document');
                submitButton.disabled = !docSelect || docSelect.value === ""; // Reactivăm doar dacă e selectat un document
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