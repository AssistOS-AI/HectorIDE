import {RoutingService} from "../../services/RoutingService.js";

const personalityModule = require('assistos').loadModule('personality', {});
const documentModule = require('assistos').loadModule('document', {});

export class HectorIDELanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.explainedDocuments = [];
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.refreshDocuments = async () => {
            const documentsMetadata = await assistOS.space.getDocumentsMetadata(assistOS.space.id);

            // Filter bias analysis documents
            const biasDocuments = documentsMetadata.filter((doc) => doc.title.startsWith("Phase1")) || [];

            // Filter bias explained documents
            const explainedDocuments = documentsMetadata.filter((doc) => doc.title.startsWith("Project2")) || [];

            // Get complete documents with all metadata
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
                explainedDocuments.map(async (doc) => {
                    const fullDoc = await documentModule.getDocument(assistOS.space.id, doc.id);
                    return {
                        ...doc,
                        ...fullDoc,
                        metadata: fullDoc.metadata || {}
                    };
                })
            );
        };
        this.invalidate(async () => {
            await this.refreshDocuments();
            this.boundsOnListUpdate = this.onListUpdate.bind(this);
        });
    }

    onListUpdate() {
        this.invalidate(this.refreshDocuments);
    }

    async beforeRender() {
        this.phase1 = "";
        this.phase2 = "";

        // Generate rows for bias analysis documents
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
                    abstract = JSON.parse(decodedAbstract);
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                console.error('Error handling abstract:', error);
            }

            const timestamp = abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : 'N/A';
            const personality = abstract.personality || 'N/A';

            this.phase1 += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="viewAnalysis">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="personality">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                ${personality}
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

        // Generate rows for explained documents
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
                    abstract = JSON.parse(decodedAbstract);
                } else if (doc.abstract && typeof doc.abstract === 'object') {
                    abstract = doc.abstract;
                }
            } catch (error) {
                console.error('Error handling abstract:', error);
                console.error('Raw abstract:', doc.abstract);
            }

            const timestamp = abstract && abstract.timestamp ? new Date(abstract.timestamp).toLocaleString() : new Date(doc.metadata.createdAt).toLocaleString();

            this.phase2 += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="viewAnalysis">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="timestamp">${timestamp}</span>
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

        if (assistOS.space.loadingDocuments) {
            assistOS.space.loadingDocuments.forEach((taskId) => {
                this.phase1 += `
                    <div data-id="${taskId}" class="analysis-card placeholder-analysis">
                        <div class="loading-icon small"></div>
                    </div>`;
            });
        }

        if (this.phase1 === "") {
            this.phase1 = `<div class="no-analyses">No analyses found</div>`;
        }

        if (this.phase2 === "") {
            this.phase2 = `<div class="no-analyses">No analyses found</div>`;
        }
    }

    async afterRender() {
        // Setup any event listeners or post-render operations
        const analysisItems = this.element.querySelectorAll('.analysis-card');
        analysisItems.forEach(item => {
            const content = item.querySelector('.analysis-content');
            if (content) {
                content.addEventListener('click', async () => {
                    // Get the parent card element which has the data-id
                    const card = content.closest('.analysis-card');
                    await this.editAction(card);
                });
            }
        });
        document.addEventListener('themechange', this.handleThemeChange.bind(this));
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
        let message = "Are you sure you want to delete this project?";
        let confirmation = await assistOS.UI.showModal("confirm-action-modal", {message}, true);
        if (!confirmation) {
            return;
        }
        await documentModule.deleteDocument(assistOS.space.id, this.getDocumentId(_target));
        this.invalidate(this.refreshDocuments);
    }

    getDocumentId(_target) {
        return _target.getAttribute('data-id');
    }

    async openHectorIDEModal() {
        const taskId = await assistOS.UI.showModal("hector-ide-modal", {
            "presenter": "hector-ide-modal"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async openPhase1Info(){
        const taskId = await assistOS.UI.showModal("hector-ide-phase1-info", {
            "presenter": "hector-ide-phase1-info",
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async openPhase2Info(){
        const taskId = await assistOS.UI.showModal("hector-ide-phase2-info", {
            "presenter": "hector-ide-phase2-info",
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async generateAction(_target) {
        try {
            console.log('generateAction called with target:', _target);
            const documentId = this.getDocumentId(_target);
            console.log('documentId:', documentId);

            console.log('Attempting to show modal...');
            const taskId = await assistOS.UI.showModal("hector-ide-components-modal", {
                "presenter": "hector-ide-components-modal",
                "documentId": documentId
            }, true);
            console.log('Modal shown successfully');
            if (taskId) {
                assistOS.watchTask(taskId);
            }
        } catch (error) {
            console.error('Error in generateAction:', error);
        }
    }
}