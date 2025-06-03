import {RoutingService} from "../../services/RoutingService.js";

const documentModule = require('assistos').loadModule('document', {});
const llmModule = require('assistos').loadModule('llm', {});
const assistOSSDK = require("assistos")
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;


export class HectorIDELanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.explainedDocuments = [];
        this.phase3codeDocuments = [];
        this.phase3qaDocuments = [];
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.refreshDocuments = async () => {
            const documentsMetadata = await assistOS.space.getDocumentsMetadata(assistOS.space.id);
            const biasDocuments = documentsMetadata.filter((doc) => doc.title.endsWith("Phase 1")) || [];
            const explainedDocumentsMetadata = documentsMetadata.filter((doc) => doc.title.endsWith("Phase 2")) || [];
            const phase3codeDocumentsMetadata = documentsMetadata.filter((doc) => doc.title.endsWith("Code")) || [];
            const phase3qaDocumentsMetadata = documentsMetadata.filter((doc) => doc.title.endsWith("QA")) || [];

            this.documents = await Promise.all(
                biasDocuments.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {}
                    };
                })
            );

            this.explainedDocuments = await Promise.all(
                explainedDocumentsMetadata.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {}
                    };
                })
            );

            this.phase3codeDocuments = await Promise.all(
                phase3codeDocumentsMetadata.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    let parsedAbstract = {};
                    if (typeof fullDoc.abstract === 'string') {
                        try {
                            const textarea = document.createElement('textarea');
                            textarea.innerHTML = fullDoc.abstract;
                            let decodedAbstract = textarea.value;
                            decodedAbstract = decodedAbstract
                                .replace(/\n/g, '')
                                .replace(/\r/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            if (decodedAbstract) {
                                parsedAbstract = JSON.parse(decodedAbstract);
                            }
                        } catch (e) {
                            console.warn(`Failed to parse abstract for Phase 3 Code document ${fullDoc.id}:`, e);
                        }
                    } else if (fullDoc.abstract && typeof fullDoc.abstract === 'object') {
                        parsedAbstract = fullDoc.abstract;
                    }
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {},
                        parsedAbstract: parsedAbstract
                    };
                })
            );

            this.phase3qaDocuments = await Promise.all(
                phase3qaDocumentsMetadata.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    let parsedAbstract = {};
                    if (typeof fullDoc.abstract === 'string') {
                        try {
                            const textarea = document.createElement('textarea');
                            textarea.innerHTML = fullDoc.abstract;
                            let decodedAbstract = textarea.value;
                            decodedAbstract = decodedAbstract
                                .replace(/\n/g, '')
                                .replace(/\r/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                            if (decodedAbstract) {
                                parsedAbstract = JSON.parse(decodedAbstract);
                            }
                        } catch (e) {
                            console.warn(`Failed to parse abstract for Phase 3 QA document ${fullDoc.id}:`, e);
                        }
                    } else if (fullDoc.abstract && typeof fullDoc.abstract === 'object') {
                        parsedAbstract = fullDoc.abstract;
                    }
                    return {
                        ...doc,
                        id: doc.id,
                        title: doc.title,
                        metadata: fullDoc.metadata || {},
                        parsedAbstract: parsedAbstract,
                    };
                })
            );
        };
        this.invalidate(async () => {
            await this.refreshDocuments();
            if (typeof this.onListUpdate === 'function') {
                this.boundsOnListUpdate = this.onListUpdate.bind(this);
            }
        });
    }

    onListUpdate() {
        this.invalidate(this.refreshDocuments);
    }

    async extractDocumentContent(documentId) {
        const document = await documentModule.getDocument(assistOS.space.id, documentId);
        if (!document) {
            console.warn("Document not found for ID:", documentId);
            return 'Error: Document not found.';
        }

        if (document.chapters && Array.isArray(document.chapters) && document.chapters.length > 0) {
            const content = document.chapters
                .map(chapter => {
                    const texts = [];
                    if (chapter && typeof chapter.title === 'string' && chapter.title.trim() !== "") {
                        texts.push(`Chapter: ${chapter.title.trim()}`);
                    }
                    if (chapter && Array.isArray(chapter.paragraphs)) {
                        const paragraphTexts = chapter.paragraphs
                            .filter(p => p && typeof p.text === 'string' && p.text.trim() !== "")
                            .map(p => p.text.trim())
                            .join('\n');
                        if (paragraphTexts) {
                            texts.push(paragraphTexts);
                        }
                    }
                    return texts.filter(t => t.trim()).join('\n\n');
                })
                .filter(t => t.trim())
                .join('\n\n-----\n\n');
            return content || 'Document chapters are empty or could not be processed.';
        }
        if (typeof document.content === 'string' && document.content.trim() !== "") {
            return document.content.trim();
        }
        console.warn("Could not extract meaningful textual content from document:", document.id);
        return 'No textual content could be extracted from this document (e.g., it might be empty or an image).';
    }


    async beforeRender() {
        this.phase1 = "";
        this.phase2 = "";
        this.phase3_code = "";
        this.phase3_qa = "";

        this.documents.forEach((doc) => {
            let abstract = {};
            try {
                if (typeof doc.abstract === 'string') {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = doc.abstract;
                    let decodedAbstract = textarea.value;
                    decodedAbstract = decodedAbstract
                        .replace(/\n/g, '')
                        .replace(/\r/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (decodedAbstract) {
                        abstract = JSON.parse(decodedAbstract);
                    }
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                // console.warn(`Failed to parse abstract for Phase 1 document ${doc.id}:`, error);
            }

            const timestamp = abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : (doc.metadata.createdAt ? new Date(doc.metadata.createdAt).toLocaleString() : 'N/A');
            const personalityName = abstract.personality || 'N/A';

            this.phase1 += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="editAction">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="personality">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${personalityName}
                            </span>
                            <span class="timestamp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${timestamp}
                            </span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                       
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        this.explainedDocuments.forEach((doc) => {
            let abstract = {};
            try {
                if (typeof doc.abstract === 'string') {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = doc.abstract;
                    let decodedAbstract = textarea.value;
                    decodedAbstract = decodedAbstract
                        .replace(/\n/g, '')
                        .replace(/\r/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    if (decodedAbstract) {
                        abstract = JSON.parse(decodedAbstract);
                    }
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                // console.warn(`Failed to parse abstract for Phase 2 document ${doc.id}:`, error);
            }

            const timestamp = abstract && abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : (doc.metadata.createdAt ? new Date(doc.metadata.createdAt).toLocaleString() : 'N/A');

            this.phase2 += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="editAction">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                             <span class="timestamp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${timestamp}
                            </span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                       
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        this.phase3codeDocuments.forEach((doc) => {
            const abstract = doc.parsedAbstract || {};
            const programmingLanguage = abstract.programmingLanguage || 'N/A';
            const timestamp = abstract.generatedAt ? new Date(abstract.generatedAt).toLocaleString() : (doc.metadata.createdAt ? new Date(doc.metadata.createdAt).toLocaleString() : 'N/A');

            this.phase3_code += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="editAction">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="language">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M16.5 10.5L19.5 13.5L16.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M7.5 10.5L4.5 13.5L7.5 16.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M13.5 6.5L10.5 20.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${programmingLanguage}
                            </span>
                            <span class="timestamp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${timestamp}
                            </span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                        <button class="action-btn view-btn" data-local-action="editAction" data-id="${doc.id}" data-tooltip="View Document">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        this.phase3qaDocuments.forEach((doc) => {
            const abstract = doc.parsedAbstract || {};
            const testType = abstract.testType || 'N/A';
            const numberOfTests = abstract.numberOfTests || 'N/A';
            const timestamp = abstract.generatedAt ? new Date(abstract.generatedAt).toLocaleString() : (doc.metadata.createdAt ? new Date(doc.metadata.createdAt).toLocaleString() : 'N/A');

            this.phase3_qa += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="editAction">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="test-type">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${testType}
                            </span>
                            <span class="test-count">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                     <path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Tests: ${numberOfTests}
                            </span>
                            <span class="timestamp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${timestamp}
                            </span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                        <button class="action-btn view-btn" data-local-action="editAction" data-id="${doc.id}" data-tooltip="View Document">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}" data-tooltip="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });


        if (assistOS.space.loadingDocuments) {
            assistOS.space.loadingDocuments.forEach((taskId) => {
                this.phase1 += `
                    <div data-id="${taskId}" class="analysis-card placeholder-analysis">
                        <div class="loading-icon small"></div>
                         <span>Loading new Phase 1 document...</span>
                    </div>`;
            });
        }

        if (this.phase1.trim() === "") {
            this.phase1 = `<div class="no-analyses" id="no-analyses-phase1">No Phase 1 documents found.</div>`;
        }
        if (this.phase2.trim() === "") {
            this.phase2 = `<div class="no-analyses" id="no-analyses-phase2">No Phase 2 documents found.</div>`;
        }
        if (this.phase3_code.trim() === "") {
            this.phase3_code = `<div class="no-analyses" id="no-analyses-phase3-code">No Phase 3 (Code) documents found.</div>`;
        }
        if (this.phase3_qa.trim() === "") {
            this.phase3_qa = `<div class="no-analyses" id="no-analyses-phase3-qa">No Phase 3 (QA) documents found.</div>`;
        }
    }

    async afterRender() {
        const analysisItems = this.element.querySelectorAll('.analysis-card');
        analysisItems.forEach(item => {
            const content = item.querySelector('.analysis-content');
            if (content) {
                const listenerAttached = content.getAttribute('data-listener-added');
                if (!listenerAttached) {
                    content.addEventListener('click', async (event) => {
                        if (event.target.closest('button')) {
                            return;
                        }
                        const card = content.closest('.analysis-card');
                        await this.editAction(card);
                    });
                    content.setAttribute('data-listener-added', 'true');
                }
            }
        });
        if (typeof this.handleThemeChange === 'function') {
            document.addEventListener('themechange', this.handleThemeChange.bind(this));
        }

        const qaDocSelect = this.element.querySelector('#qa-doc-select');
        if (qaDocSelect) {
            while (qaDocSelect.options.length > 1) {
                qaDocSelect.remove(1);
            }
            if (this.phase3qaDocuments && this.phase3qaDocuments.length > 0) {
                this.phase3qaDocuments.forEach(doc => {
                    const option = document.createElement('option');
                    option.value = doc.id;
                    option.textContent = doc.title;
                    qaDocSelect.appendChild(option);
                });
            }
        }
    }

    disconnectedCallback() {
        if (typeof this.handleThemeChange === 'function') {
            document.removeEventListener('themechange', this.handleThemeChange.bind(this));
        }
        const items = this.element.querySelectorAll('[data-listener-added="true"]');
        items.forEach(item => {
            item.removeAttribute('data-listener-added');
        });
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        this.invalidate();
    }

    async editAction(_target) {
        let documentId = this.getDocumentId(_target);
        await assistOS.UI.changeToDynamicPage("space-application-page", `${assistOS.space.id}/Space/document-view-page/${documentId}`);
    }

    async deleteAction(_target) {
        let message = "Are you sure you want to delete this project item?";
        let confirmation = await assistOS.UI.showModal("confirm-action-modal", {message}, true);
        if (!confirmation) {
            return;
        }
        const docIdToDelete = this.getDocumentId(_target);
        await documentModule.deleteDocument(assistOS.space.id, docIdToDelete);

        this.documents = this.documents.filter(doc => doc.id !== docIdToDelete);
        this.explainedDocuments = this.explainedDocuments.filter(doc => doc.id !== docIdToDelete);
        this.phase3codeDocuments = this.phase3codeDocuments.filter(doc => doc.id !== docIdToDelete);
        this.phase3qaDocuments = this.phase3qaDocuments.filter(doc => doc.id !== docIdToDelete);

        this.invalidate();
    }

    getDocumentId(_target) {
        const card = _target.closest('.analysis-card') || _target;
        return card.getAttribute('data-id');
    }

    async openHectorIDEModal() {
        const taskId = await assistOS.UI.showModal("hector-ide-modal", {
            "presenter": "hector-ide-modal"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
            const modal = document.querySelector('hector-ide-modal');
            if (modal && typeof this.onListUpdate === 'function') {
                modal.addEventListener('close', () => this.onListUpdate(), {once: true});
            }
        }
    }

    async openDownloadModal() {
        const taskId = await assistOS.UI.showModal("hector-ide-components-modal-phase3-download", {
            "presenter": "hector-ide-components-modal-phase3-download",
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
            const modal = document.querySelector('hector-ide-components-modal-phase3-download');
            if (modal && typeof this.onListUpdate === 'function') {
                modal.addEventListener('close', () => this.onListUpdate(), {once: true});
            }
        }
    }

    async openDeployModal() {
        const taskId = await assistOS.UI.showModal("hector-ide-components-modal-phase3-docker", {
            "presenter": "hector-ide-components-modal-phase3-docker",
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
            const modal = document.querySelector('hector-ide-components-modal-phase3-docker');
            if (modal && typeof this.onListUpdate === 'function') {
                modal.addEventListener('close', () => this.onListUpdate(), {once: true});
            }
        }
    }

    async openPhase1Info() {
        const taskId = await assistOS.UI.showModal("hector-ide-phase1-info", {
            "presenter": "hector-ide-phase1-info"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async openModifyDocumentModalPhase1() {
        const taskId = await assistOS.UI.showModal("hector-ide-components-modal-modify-phase1", {
            "presenter": "hector-ide-components-modal-modify-phase1"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async openModifyDocumentModalPhase2() {
        const taskId = await assistOS.UI.showModal("hector-ide-components-modal-modify-phase2", {
            "presenter": "hector-ide-components-modal-modify-phase2"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async openModifyDocumentModalCode() {
        const taskId = await assistOS.UI.showModal("hector-ide-components-modal-modify-code", {
            "presenter": "hector-ide-components-modal-modify-code"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }


    async openPhase2Info() {
        await assistOS.UI.showModal("hector-ide-phase2-info", {"presenter": "hector-ide-phase2-info"}, true);
    }

    async openPhase3Info() {
        await assistOS.UI.showModal("hector-ide-phase3-info", {"presenter": "hector-ide-phase3-info"}, true);
    }

    async generateAction1(_target) {
        try {
            const documentId = this.getDocumentId(_target);
            const taskId = await assistOS.UI.showModal("hector-ide-components-modal", {
                "presenter": "hector-ide-components-modal",
                "document-id": documentId,
                "target-phase": "Phase2"
            }, true);
            if (taskId) {
                assistOS.watchTask(taskId);
                const modal = document.querySelector('hector-ide-components-modal');
                if (modal && typeof this.onListUpdate === 'function') {
                    modal.addEventListener('close', () => this.onListUpdate(), {once: true});
                }
            }
        } catch (error) {
            console.error('Error in generateAction1 (to Phase 2):', error);
        }
    }

    async generateAction2(_target) {
        try {
            const documentId = this.getDocumentId(_target);
            const taskId = await assistOS.UI.showModal("hector-ide-components-modal-phase3", {
                "presenter": "hector-ide-components-modal-phase3",
                "document-id": documentId,
                "target-phase": "Phase3Code"
            }, true);
            if (taskId) {
                assistOS.watchTask(taskId);
                const modal = document.querySelector('hector-ide-components-modal-phase3');
                if (modal && typeof this.onListUpdate === 'function') {
                    modal.addEventListener('close', () => this.onListUpdate(), {once: true});
                }
            }
        } catch (error) {
            console.error('Error in generateAction2 (to Phase 3 Code):', error);
        }
    }

    async triggerQAGeneration(_target) {
        try {
            const documentId = this.getDocumentId(_target);
            const taskId = await assistOS.UI.showModal("hector-ide-components-modal-phase3-qa", {
                "presenter": "hector-ide-components-modal-phase3-qa",
                "document-id": documentId,
                "target-phase": "Phase3Code"
            }, true);
            if (taskId) {
                assistOS.watchTask(taskId);
                const modal = document.querySelector('hector-ide-components-modal-phase3-qa');
                if (modal && typeof this.onListUpdate === 'function') {
                    modal.addEventListener('close', () => this.onListUpdate(), {once: true});
                }
            }
        } catch (error) {
            console.error('Error in generateAction2 (to Phase 3 Code):', error);
        }
    }

    async triggerNextStepDocs(_target) {
        const workflowStepCard = _target.closest('.workflow-step');
        const qaDocumentCard = workflowStepCard.querySelector('.analysis-card[data-id]');
        if (!qaDocumentCard) {
            return;
        }
        const qaDocumentId = qaDocumentCard.dataset.id;
        console.log(`Triggering Documentation Generation based on QA document: ${qaDocumentId} from step: ${workflowStepCard.id}`);
        await assistOS.UI.showNotice("Documentation generation from QA is not yet implemented.");
    }

    async finalizeProject(_target) {
        const workflowStepCard = _target.closest('.workflow-step');
        console.log(`Finalizing project from step: ${workflowStepCard.id}`);
        await assistOS.UI.showNotice("Project finalization is not yet implemented.");
    }

    // --- AI Chat Functionality Start ---
    async submitAIChatQuery() {
        const qaDocSelect = this.element.querySelector('#qa-doc-select');
        const userQueryInput = this.element.querySelector('#user-query-input');
        const responseArea = this.element.querySelector('#ai-chat-response-area');
        const responseTextElement = this.element.querySelector('#ai-chat-response-text');
        const loadingElement = this.element.querySelector('#ai-chat-loading');

        const selectedQaDocId = qaDocSelect.value;
        const userQuery = userQueryInput.value.trim();

        if (!userQuery) {
            console.warn("User query for AI Chat is empty.");
            if(responseTextElement) responseTextElement.textContent = "Please enter your question or issue.";
            if(responseArea) responseArea.style.display = 'block';
            if(loadingElement) loadingElement.style.display = 'none';
            return;
        }

        if(responseArea) responseArea.style.display = 'block';
        if(loadingElement) loadingElement.style.display = 'block';
        if(responseTextElement) responseTextElement.textContent = '';

        let prompt;
        let fullQaDocTextContent = "";
        let qaDocTitle = "";

        try {
            if (selectedQaDocId) {
                const selectedDocMetadata = this.phase3qaDocuments.find(doc => doc.id === selectedQaDocId);
                if (selectedDocMetadata) {
                    qaDocTitle = selectedDocMetadata.title;
                    fullQaDocTextContent = await this.extractDocumentContent(selectedQaDocId);

                    const MAX_CONTEXT_LENGTH = 15000;
                    if (fullQaDocTextContent.length > MAX_CONTEXT_LENGTH) {
                        console.warn(`QA document content for ${qaDocTitle} is very long (${fullQaDocTextContent.length} chars). Truncating to ${MAX_CONTEXT_LENGTH} chars.`);
                        fullQaDocTextContent = fullQaDocTextContent.substring(0, MAX_CONTEXT_LENGTH) + "\n\n[... CONTENT TRUNCATED DUE TO LENGTH ...]";
                    }

                } else {
                    qaDocTitle = "Unknown Document";
                    fullQaDocTextContent = "Could not find metadata for the selected document.";
                }
            }

            if (selectedQaDocId && qaDocTitle) {
                prompt = `You are a helpful AI. A user is asking for ideas regarding: "${userQuery}".
They are referencing the QA document titled "${qaDocTitle}". You are being provided with the FULL content of this document below for comprehensive context:
--- BEGIN FULL QA DOCUMENT CONTENT ---
${fullQaDocTextContent}
--- END FULL QA DOCUMENT CONTENT ---

Please offer 2-3 brief and concise ideas or suggestions in a natural, human-like conversational tone, based on your understanding of the user's query and the ENTIRE provided QA document.
Keep your answer short, to the point, and use plain text without markdown asterisks. Focus on a few key actionable insights that are well-supported by the document's content.
For example, if they ask about an error, refer to specific sections or tests in the document if relevant. If they ask about running tests, summarize the process as described in the document concisely.`;
            } else {
                prompt = `You are a helpful AI. A user is asking for some ideas regarding: "${userQuery}".

Please offer 2-3 brief and concise ideas or suggestions in a natural, human-like conversational tone.
Keep your answer short, to the point, and use plain text without markdown asterisks. Focus on a few key actionable insights.
For example, if they ask about an error, suggest a couple of quick things to check. If they ask about running tests, give a concise pointer.`;
            }

            let personality;
            try {
                const defaultPersonalityName = constants.DEFAULT_PERSONALITY_NAME || "GeneralAssistant";
                personality = await personalityModule.getPersonalityByName(assistOS.space.id, defaultPersonalityName);

                if (!personality) {
                    console.warn(`Default personality '${defaultPersonalityName}' not found. Attempting to use the first available personality.`);
                    const personalities = await personalityModule.getPersonalities(assistOS.space.id);
                    if (personalities && personalities.length > 0) {
                        personality = personalities[0];
                        console.log(`Using first available personality: ${personality.name}`);
                    } else {
                        throw new Error("No personalities available in the current space.");
                    }
                }
            } catch (e) {
                console.error("Error getting personality:", e);
                if(responseTextElement) responseTextElement.textContent = "Error: Could not load AI personality. Please try again later or contact support.";
                if(loadingElement) loadingElement.style.display = 'none';
                return;
            }

            const getLLMResponseWithTimeout = async (promptIdea, personalityId, timeout = 60000) => {
                return Promise.race([
                    llmModule.generateText(assistOS.space.id, promptIdea, personalityId),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('AI assistant request timed out after ' + (timeout / 1000) + ' seconds.')), timeout)
                    )
                ]);
            };

            const response = await getLLMResponseWithTimeout(prompt, personality.id);
            let message = response.message || "No response message received from AI.";
            message = message.replace(/\*/g, '').trim();
            if(responseTextElement) responseTextElement.textContent = message;

        } catch (error) {
            console.error("AI Chat Error:", error);
            if(responseTextElement) responseTextElement.textContent = `Error: ${error.message || "An unknown error occurred while trying to get a response from the AI."}`;
        } finally {
            if(loadingElement) loadingElement.style.display = 'none';
        }
    }

    async clearAIChatResponse() {
        const responseTextElement = this.element.querySelector('#ai-chat-response-text');
        const responseArea = this.element.querySelector('#ai-chat-response-area');

        if (responseTextElement) {
            responseTextElement.textContent = '';
        }
        if (responseArea) {
            responseArea.style.display = 'none';
        }
    }

    async showUiPreviewForSelectedCode() {
        const escapeHtml = (unsafe) => {
            if (typeof unsafe !== 'string') return String(unsafe);
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const iframeContainer = this.element.querySelector('#ui-preview-frame-container');
        const iframe = this.element.querySelector('#ui-preview-iframe');
        const placeholder = this.element.querySelector('#ui-preview-placeholder');

        const updatePlaceholder = (message, isError = false) => {
            if (placeholder) {
                const displayMessage = isError ? `<span style="color: red; font-weight: bold;">Eroare:</span> ${escapeHtml(message)}` : escapeHtml(message);
                placeholder.innerHTML = displayMessage;
                placeholder.style.display = 'block';
            }
            if (iframeContainer) iframeContainer.style.display = 'none';
            if (iframe) {
                // Reset iframe before loading new content, especially if sandbox is applied
                iframe.removeAttribute('srcdoc');
                iframe.src = 'about:blank'; // Further ensures a clean state
            }
        };

        const cleanLLMCodeResponse = (responseString, languageHint = "", stepNameForLog = "UnknownStep") => {
            if (typeof responseString !== 'string') {
                console.warn(`cleanLLMCodeResponse (${stepNameForLog}): Received non-string input. Returning ''.`);
                return "";
            }
            let cleanedString = responseString.trim();
            const markdownRegex = /^```(?:[a-zA-Z0-9_]+)?\s*([\s\S]*?)\s*```$/;
            const match = cleanedString.match(markdownRegex);

            if (match && match[1]) {
                cleanedString = match[1].trim();
            } else {
                if (cleanedString.startsWith("```" + languageHint) && languageHint) {
                    cleanedString = cleanedString.substring(3 + languageHint.length);
                } else if (cleanedString.startsWith("```")) {
                    cleanedString = cleanedString.substring(3);
                }
                if (cleanedString.endsWith("```")) {
                    cleanedString = cleanedString.substring(0, cleanedString.length - 3);
                }
                cleanedString = cleanedString.trim();
            }
            return cleanedString;
        };

        try {
            updatePlaceholder("Așteptare selecție document...");
            const selectedDocumentId = await assistOS.UI.showModal("hector-ide-components-modal-phase3-preview", {
                "presenter": "hector-ide-components-modal-phase3-preview",
            }, true);

            if (!selectedDocumentId) {
                updatePlaceholder('Niciun document nu a fost selectat sau operațiunea a fost anulată.');
                return;
            }

            updatePlaceholder(`Se încarcă documentul ID: ${selectedDocumentId}...`);
            const fullDocument = await documentModule.getDocument(assistOS.space.id, selectedDocumentId);

            if (!fullDocument) {
                updatePlaceholder(`Documentul cu ID ${selectedDocumentId} nu a fost găsit.`);
                return;
            }

            let documentTextContent = "";
            if (fullDocument.chapters && Array.isArray(fullDocument.chapters) && fullDocument.chapters.length > 0) {
                documentTextContent = fullDocument.chapters.map(chapter => {
                    let chapterContent = "";
                    const chapterTitleText = (chapter && typeof chapter.title === 'string' && chapter.title.trim() !== "") ? chapter.title.trim() : "";
                    if (chapterTitleText) {
                        chapterContent += `\n\n`;
                    }
                    if (chapter && Array.isArray(chapter.paragraphs)) {
                        chapterContent += chapter.paragraphs
                            .filter(p => p && typeof p.text === 'string' && p.text.trim() !== "")
                            .map(p => p.text.trim())
                            .join('\n\n') + "\n";
                    }
                    return chapterContent;
                }).join('');
            } else if (typeof fullDocument.content === 'string' && fullDocument.content.trim() !== "") {
                documentTextContent = fullDocument.content.trim();
            }

            if (!documentTextContent.trim()) {
                updatePlaceholder("Documentul selectat este gol. Nu se poate genera preview.");
                return;
            }
            console.log(`Document content length: ${documentTextContent.length}`);

            updatePlaceholder("Se pregătește personalitatea AI...");
            let personality = await personalityModule.getPersonalityByName(assistOS.space.id, constants.DEFAULT_PERSONALITY_NAME);
            if (!personality) {
                console.warn(`Personalitatea default '${constants.DEFAULT_PERSONALITY_NAME}' nu a fost găsită. Se încearcă prima personalitate disponibilă.`);
                const personalities = await personalityModule.getPersonalities(assistOS.space.id);
                if (personalities && personalities.length > 0) {
                    personality = personalities[0];
                } else {
                    updatePlaceholder("Nicio personalitate AI disponibilă pentru procesare.", true);
                    return;
                }
            }
            console.log(`Se utilizează personalitatea: ${personality.name}.`);

            const getLLMResponse = async (prompt, stepName, timeout = 60000) => {
                updatePlaceholder(`AI Processing: Step '${stepName}'...`);
                const startTime = Date.now();
                console.log(`LLM Call START: ${stepName}. Prompt (first 300 chars): ${prompt.substring(0, 300)}...`);
                let rawResponseText = "";

                try {
                    const response = await Promise.race([
                        llmModule.generateText(assistOS.space.id, prompt, personality.id),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error(`Timeout (${timeout / 1000}s) reached for step: ${stepName}`)), timeout)
                        )
                    ]);
                    const duration = (Date.now() - startTime) / 1000;
                    rawResponseText = response?.message;
                    console.log(`LLM Call END: ${stepName}. Duration: ${duration.toFixed(2)}s. Response length: ${rawResponseText?.length || 0}`);

                    if (!response || typeof response.message !== 'string') {
                        const errorMsg = `Invalid or missing message from LLM for step '${stepName}'. Response: ${JSON.stringify(response)}`;
                        console.error(errorMsg);
                        const err = new Error(errorMsg);
                        err.rawResponse = rawResponseText;
                        throw err;
                    }
                    return response.message;
                } catch (error) {
                    if (!error.rawResponse && rawResponseText) {
                        error.rawResponse = rawResponseText;
                    }
                    console.error(`Error in getLLMResponse for step ${stepName}:`, error.message);
                    throw error;
                }
            };

            let extractedCode = { html: "", css: "", js: "" };

            const htmlExtractionPrompt = `
Your task is to analyze the provided "Document Content" and extract its primary HTML structure suitable for the <body> of a preview page.
- If clear HTML body or main content structure is found, extract that.
- If UI elements are described without full HTML, generate a plausible HTML structure for them.
- If no obvious HTML body is found, provide: "<div id='app-preview'>Generated HTML based on document content.</div>".
- Focus on content for the <body> tag. Do NOT include <html>, <head>, or <body> tags themselves unless part of a nested structure within the main content.

**Output Rules:**
1.  Output ONLY the raw HTML code.
2.  Do NOT include explanations, comments outside the code, markdown fences (like \`\`\`html), or any text surrounding the HTML.
3.  If the document does not contain or describe any HTML, output only: "<div id='app-preview'>No HTML content identified in the document.</div>"

Document Content:
---
${documentTextContent}
---
Raw HTML Code Output:`;
            try {
                updatePlaceholder("Se extrage codul HTML din document...");
                const rawHtmlResponse = await getLLMResponse(htmlExtractionPrompt, "HtmlExtraction");
                extractedCode.html = cleanLLMCodeResponse(rawHtmlResponse, "html", "HtmlExtraction");
                if (!extractedCode.html.trim()) {
                    console.warn("HTML extraction resulted in empty content. Using placeholder.");
                    extractedCode.html = '<div id="app-preview">Conținutul HTML nu a putut fi extras sau este gol.</div>';
                }
                console.log(`Extracted HTML length: ${extractedCode.html.length}`);
            } catch (e) {
                console.error("Error during HTML extraction:", e.message, "\nRaw response for HTML:", e.rawResponse || "N/A");
                updatePlaceholder(`Eroare la extragerea HTML: ${e.message}. Se folosește un placeholder.`, true);
                extractedCode.html = `<div id="app-preview" style="color:red; border:1px solid red; padding:10px;">Eroare la extragerea HTML: ${escapeHtml(e.message)}<br><pre>${escapeHtml(e.rawResponse?.substring(0,500) || "N/A")}</pre></div>`;
            }

            const cssExtractionPrompt = `
Your task is to analyze the "Document Content" and extract all CSS rules.
- Concatenate all found CSS rules into a single block.
- If the document contains <style> tags, extract their content.
- If CSS rules are described in prose, convert them into valid CSS.

**Output Rules:**
1.  Output ONLY the raw CSS code.
2.  Do NOT include explanations, comments outside the code, markdown fences (like \`\`\`css), <style> tags, or any text surrounding the CSS.
3.  If no CSS is found or described, output an empty string.

Document Content:
---
${documentTextContent}
---
Raw CSS Code Output:`;
            try {
                updatePlaceholder("Se extrage codul CSS din document...");
                const rawCssResponse = await getLLMResponse(cssExtractionPrompt, "CssExtraction");
                extractedCode.css = cleanLLMCodeResponse(rawCssResponse, "css", "CssExtraction");
                console.log(`Extracted CSS length: ${extractedCode.css.length}`);
            } catch (e) {
                console.error("Error during CSS extraction:", e.message, "\nRaw response for CSS:", e.rawResponse || "N/A");
                updatePlaceholder(`Eroare la extragerea CSS: ${e.message}. Se continuă fără CSS extras.`, true);
                extractedCode.css = `/* Eroare la extragerea CSS: ${e.message.replace(/\*\//g, '*\\/')}\nRaw Response (first 200 chars):\n${(e.rawResponse || "N/A").substring(0,200).replace(/\*\//g, '*\\/')} \n*/`;
            }

            const jsExtractionPrompt = `
Your task is to analyze the "Document Content" and extract all JavaScript code.
- Concatenate all found JavaScript code blocks into a single script.
- If <script> tags (without src) are present, extract their content.
- If JavaScript logic is described in prose, convert it into valid vanilla JavaScript.

**Output Rules:**
1.  Output ONLY the raw JavaScript code.
2.  Do NOT include explanations, comments outside the code, markdown fences (like \`\`\`javascript), <script> tags, or any text surrounding the JS.
3.  If no JavaScript is found or described, output an empty string.

Document Content:
---
${documentTextContent}
---
Raw JavaScript Code Output:`;
            try {
                updatePlaceholder("Se extrage codul JavaScript din document...");
                const rawJsResponse = await getLLMResponse(jsExtractionPrompt, "JsExtraction");
                extractedCode.js = cleanLLMCodeResponse(rawJsResponse, "javascript", "JsExtraction");
                console.log(`Extracted JS length: ${extractedCode.js.length}`);
            } catch (e) {
                console.error("Error during JavaScript extraction:", e.message, "\nRaw response for JS:", e.rawResponse || "N/A");
                updatePlaceholder(`Eroare la extragerea JavaScript: ${e.message}. Se continuă fără JavaScript extras (sau cu eroare).`, true);
                extractedCode.js = `// Eroare la extragerea JavaScript: ${e.message}\n// Raw Response (first 200 chars):\n// ${(e.rawResponse || "N/A").substring(0,200)}`;
            }

            console.log("Extracted code components (Separate LLM Calls):", {
                html_len: extractedCode.html.length,
                css_len: extractedCode.css.length,
                js_len: extractedCode.js.length,
            });

            extractedCode.html = typeof extractedCode.html === 'string' ? extractedCode.html : '<div id="app-preview">Eroare internă la procesarea HTML.</div>';
            extractedCode.css = typeof extractedCode.css === 'string' ? extractedCode.css : '';
            extractedCode.js = typeof extractedCode.js === 'string' ? extractedCode.js : '';

            if (!extractedCode.html.trim() && !extractedCode.css.trim() && !extractedCode.js.trim()) {
                if (!extractedCode.html.includes("Eroare la extragerea HTML")) {
                    updatePlaceholder("Nu s-a putut extrage niciun cod (HTML, CSS, JS) din document pentru previzualizare. Verifică dacă documentul conține elemente de UI.", true);
                }
                return;
            }

            updatePlaceholder("Se asamblează previzualizarea...");
            let finalHtml = extractedCode.html;

            if (!finalHtml.trim() || !finalHtml.toLowerCase().includes("<html")) {
                const isErrorPlaceholder = finalHtml.includes("Eroare la extragerea HTML");
                finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UI Preview</title>
</head>
<body>
    ${finalHtml.trim() ? finalHtml : (isErrorPlaceholder ? finalHtml : '<div id="app-preview">Conținutul principal al paginii.</div>')}
</body>
</html>`;
            }

            let headInjections = "";
            let bodyEndInjections = "";

            if (extractedCode.css) {
                headInjections += `<style type="text/css">\n${extractedCode.css}\n</style>\n`;
            }

            const requireShimScript = `
<script id="preview-require-shim">
    console.log('Preview: Initializing require/module/exports/process/global shims...');
    if (typeof window.require === 'undefined') {
        window.require = function(moduleName) {
            console.warn('[UI Preview Shim] Call to require("' + moduleName + '"). This is a shim. Returning mock object. Original module functionality might be missing or altered.');
            return { /* mock module */ __isMock: true, default: {}, namedExport: {} };
        };
    }
    if (typeof window.module === 'undefined') { window.module = { exports: {} }; }
    else if (typeof window.module.exports === 'undefined') { window.module.exports = {}; }
    let currentModuleExports = window.module.exports;
    Object.defineProperty(window.module, 'exports', {
        get() { return currentModuleExports; },
        set(newValue) { currentModuleExports = newValue; window.exports = currentModuleExports; },
        configurable: true
    });
    window.exports = window.module.exports;
    if (typeof window.process === 'undefined') { window.process = { env: { NODE_ENV: 'development' }, cwd: function() { return '/'; }, on: function() {} }; }
    if (typeof window.global === 'undefined') { window.global = window; }
    console.log('Preview: Shims initialized.');
</script>`;
            headInjections += requireShimScript;

            if (extractedCode.js) {
                console.log("Adding extracted JS directly.");
                bodyEndInjections += `<script type="text/javascript">\n//<![CDATA[\ntry {\n${extractedCode.js}\n} catch (e) { console.error("Error in preview JS:", e); document.body.insertAdjacentHTML("beforeend", "<div style=\\"color:red; background:white; border:1px solid red; padding:10px; margin:10px; position:fixed; bottom:0; left:0; z-index:9999;\\">JavaScript Error: " + e.message + "</div>"); }\n//]]>\n</script>\n`;
            }

            if (finalHtml.includes("</head>")) {
                finalHtml = finalHtml.replace("</head>", `${headInjections}</head>`);
            } else {
                const bodyMatch = finalHtml.match(/<body[^>]*>/i);
                if (bodyMatch) {
                    finalHtml = finalHtml.slice(0, bodyMatch.index) + `<head><meta charset="UTF-8"><title>Preview</title>${headInjections}</head>` + finalHtml.slice(bodyMatch.index);
                } else {
                    finalHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Preview</title>${headInjections}</head><body>${finalHtml}</body></html>`;
                }
            }

            if (finalHtml.includes("</body>")) {
                finalHtml = finalHtml.replace("</body>", `${bodyEndInjections}</body>`);
            } else {
                finalHtml += bodyEndInjections;
            }

            console.log("Final HTML for srcdoc (first 500 chars):", finalHtml.substring(0,500));

            if (iframe) {
                // **MODIFICARE CHEIE AICI PENTRU PROBLEMA CULORII**
                // Aplicăm sandbox pentru a restricționa capabilitățile iframe-ului.
                // Acest lucru ajută la prevenirea scripturilor din iframe să afecteze pagina părinte.
                // 'allow-scripts' este necesar pentru ca JS-ul previzualizat să ruleze.
                // 'allow-forms' și 'allow-popups' sunt permisiuni comune, relativ sigure.
                // Important: NU adăugăm 'allow-same-origin' pentru a forța iframe-ul
                // într-o origine unică, restricționând accesul la window.parent.document.
                iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups');

                // Este o practică bună să setezi srcdoc după ce ai configurat atributele iframe-ului.
                iframe.srcdoc = finalHtml;
            }
            if (placeholder) placeholder.style.display = 'none';
            if (iframeContainer) iframeContainer.style.display = 'block';
            console.log(`SUCCESS: Preview generated for document ID: ${selectedDocumentId} using separate LLM calls and iframe sandbox.`);

        } catch (error) {
            console.error('CRITICAL Error in UI preview generation process:', error.message, "\nFULL STACK TRACE:", error.stack);
            updatePlaceholder(`Eroare gravă: ${error.message || "A apărut o eroare necunoscută în timpul generării previzualizării."}. Verifică consola (F12).`, true);
        }
    }
}