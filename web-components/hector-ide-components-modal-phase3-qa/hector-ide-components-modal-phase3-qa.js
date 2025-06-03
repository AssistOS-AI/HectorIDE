const applicationModule = require('assistos').loadModule('application', {});
const documentModule = require('assistos').loadModule('document', {});

export class HectorIdeComponentsModalPhase3Qa {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.sourceApplicationDocuments = [];
        this.documentOptions = [];
        this.documentId = this.element.getAttribute("data-documentId");
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.programmingLanguages = [
            "Python", "JavaScript", "Java", "C#", "C++", "TypeScript", "PHP", "Go", "Swift", "Kotlin",
            "Ruby", "Rust", "Scala", "R", "Dart", "C", "Objective-C", "SQL", "Perl", "Lua"
        ];
        this.invalidate();
    }

    async beforeRender() {
        try {
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            const phase3AppDocumentsMetadata = allDocumentsMetadata.filter(
                (doc) => doc.title?.endsWith("Code")
            ) || [];

            console.log('Number of Phase 3/Code documents (for QA source selection):', phase3AppDocumentsMetadata.length);
            this.sourceApplicationDocuments = phase3AppDocumentsMetadata;

            this.documentOptions = phase3AppDocumentsMetadata.map(doc => {
                let title = doc.title || doc.name || doc.id;
                // title = title.replace("Code", "").trim();
                if(title === "") {
                    title = doc.id;
                }
                return `<option value="${doc.id}">${title}</option>`;
            }).join('');

        } catch (error) {
            console.error('Error loading source application document data for QA:', error);
            this.documentOptions = '<option value="">Error loading documents</option>';
        }
    }

    renderProgrammingLanguages() {
        const languageListContainer = this.element.querySelector('#programmingLanguageList');
        if (languageListContainer) {
            languageListContainer.innerHTML = '';
            let languageRadiosHTML = '';
            this.programmingLanguages.forEach((lang, index) => {
                const langId = `qa-lang-${index}`;
                languageRadiosHTML += `
                    <div class="radio-option">
                        <input type="radio" id="${langId}" name="testProgrammingLanguage" value="${lang}">
                        <label for="${langId}">${lang}</label>
                    </div>
                `;
            });
            languageListContainer.innerHTML = languageRadiosHTML;
            return true;
        } else {
            console.warn("#programmingLanguageList container not found for QA test languages.");
            return false;
        }
    }

    async afterRender() {
        const languagesWereRendered = this.renderProgrammingLanguages();

        if (languagesWereRendered) {
            this.setupEventListeners();
        } else {
            setTimeout(() => {
                if (this.renderProgrammingLanguages()) {
                    this.setupEventListeners();
                } else {
                    console.error("QA Modal: Failed to render programming languages. Event listeners might not work correctly.");
                }
            }, 100);
        }
        document.addEventListener('themechange', this.handleThemeChange.bind(this));
    }

    disconnectedCallback() {
        document.removeEventListener('themechange', this.handleThemeChange.bind(this));
    }

    async closeModal(_target, taskId) {
        await assistOS.UI.closeModal(_target, taskId);
    }

    setupEventListeners() {
        const form = this.element.querySelector('#qaTestForm');
        const submitButton = this.element.querySelector('#generateQaButton');
        const documentSelect = this.element.querySelector('#sourceApplicationDocument');
        const languageRadioGroup = this.element.querySelectorAll('input[name="testProgrammingLanguage"]');
        const testTypeRadioGroup = this.element.querySelectorAll('input[name="testType"]');
        const testFrameworkInput = this.element.querySelector('#testFramework');
        const specificFocusTextarea = this.element.querySelector('#specificFocus');

        const updateButtonState = () => {
            const isDocumentSelected = documentSelect ? documentSelect.value !== "" : false;
            const isLanguageSelected = languageRadioGroup.length > 0 ? Array.from(languageRadioGroup).some(radio => radio.checked) : false;
            const isTestTypeSelected = testTypeRadioGroup.length > 0 ? Array.from(testTypeRadioGroup).some(radio => radio.checked) : false;

            const canSubmit = isDocumentSelected && isLanguageSelected && isTestTypeSelected;

            if (submitButton) {
                submitButton.disabled = !canSubmit;
                submitButton.style.opacity = canSubmit ? '1' : '0.6';
                submitButton.style.cursor = canSubmit ? 'pointer' : 'not-allowed';
            }
        };

        updateButtonState();

        if (documentSelect) {
            documentSelect.addEventListener('change', updateButtonState);
        }
        if (languageRadioGroup.length > 0) {
            languageRadioGroup.forEach(radio => {
                radio.addEventListener('change', updateButtonState);
            });
        }
        if (testTypeRadioGroup.length > 0) {
            testTypeRadioGroup.forEach(radio => {
                radio.addEventListener('change', updateButtonState);
            });
        }

        if (form && submitButton) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (submitButton.disabled) {
                    return;
                }
                await this.handleQAGenerationRequest(form);
            });
        } else {
            console.warn("QA Modal: Form or submit button not found, submit functionality will NOT be available.");
        }
    }

    async handleQAGenerationRequest(form) {
        const submitButton = this.element.querySelector('#generateQaButton');
        if (submitButton) submitButton.disabled = true;

        await assistOS.loadifyFunction(async () => {
            const formData = await assistOS.UI.extractFormInformation(form);

            const selectedLanguageRadio = form.querySelector('input[name="testProgrammingLanguage"]:checked');
            const testProgrammingLanguage = selectedLanguageRadio ? selectedLanguageRadio.value : null;

            const selectedTestTypeRadio = form.querySelector('input[name="testType"]:checked');
            const testType = selectedTestTypeRadio ? selectedTestTypeRadio.value : null;

            const sourceDocumentSelect = form.querySelector('#sourceApplicationDocument');
            const sourceApplicationDocumentId = sourceDocumentSelect ? sourceDocumentSelect.value : null;

            let sourceApplicationDocumentTitle = '';
            if (sourceDocumentSelect && sourceDocumentSelect.selectedIndex !== -1) {
                sourceApplicationDocumentTitle = sourceDocumentSelect.options[sourceDocumentSelect.selectedIndex].text.replace(" (App Code)", "").trim();
            }

            const testFramework = formData.data.testFramework || "";
            const specificFocus = formData.data.specificFocus || "";

            if (!testProgrammingLanguage || !sourceApplicationDocumentId || !testType) {
                console.error('Missing essential data for QA test generation!');
                if (submitButton) {
                    submitButton.disabled = false;
                    this.element.querySelector('#generateQaButton').disabled = false; /* Re-enable after loadify */
                }
                return;
            }

            const targetQADocumentTitle = `${sourceApplicationDocumentTitle}`;

            const taskData = {
                sourceApplicationDocumentId: sourceApplicationDocumentId,
                testType: testType,
                programmingLanguage: testProgrammingLanguage,
                testFramework: testFramework,
                specificFocus: specificFocus,
                targetDocumentTitle: targetQADocumentTitle
            };

            console.log('Running QA Generation Task with data:', taskData);
            const taskId = await applicationModule.runApplicationTask(
                assistOS.space.id,
                "HectorIDE",
                "GeneratePhase3Qa",
                taskData
            );

            await assistOS.UI.closeModal(this.element, taskId);
        });
        if (submitButton && submitButton.disabled) {
            submitButton.disabled = false;
        }
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        this.invalidate();
    }
}