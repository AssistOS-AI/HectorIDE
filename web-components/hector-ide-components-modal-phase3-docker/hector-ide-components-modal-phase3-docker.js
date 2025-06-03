const documentModule = assistOS.loadModule('document', {});
const assistOSSDK = require("assistos")
const llmModule = require("assistos").loadModule("llm", {});
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;

const FOLDER_MARKER_VALUE = (constants && constants.FOLDER_MARKER) || "__ASSISTOS_FOLDER_MARKER__";

export class HectorIdeComponentsModalPhase3Docker {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.qaDocuments = [];
        this.documentOptions = [];
        this.selectedDocumentId = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.boundUpdateDownloadButtonState = this._updateDeployButtonState.bind(this);
        this.boundHandleThemeChange = this.handleThemeChange.bind(this);
        this.maxRetries = 3;
        this.baseRetryDelay = 5000;
        this.individualCallDelay = 6000;
        this.projectCodeMap = new Map();
        this.invalidate();
    }

    _loadScript(url) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${url}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
            document.head.appendChild(script);
        });
    }

    async _ensureLibrariesLoaded() { return true; }

    async beforeRender() {
        try {
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            this.qaDocuments = allDocumentsMetadata.filter(doc => doc.title?.endsWith("QA")) || [];
            this.documentOptions = this.qaDocuments.map(doc => {
                let title = doc.title || doc.name || `Document ${doc.id || 'UnknownID'}`;
                return `<option value="${doc.id}" data-title="${title}">${title}</option>`;
            }).join('');
        } catch (error) {
            console.error("Error loading documents in beforeRender:", error);
            this.documentOptions = '<option value="" disabled>Error loading documents</option>';
            this.qaDocuments = [];
        }
    }

    async afterRender() {
        this.setupEventListeners();
        document.removeEventListener('themechange', this.boundHandleThemeChange);
        document.addEventListener('themechange', this.boundHandleThemeChange);
        this._updateDeployButtonState();
    }

    disconnectedCallback() {
        document.removeEventListener('themechange', this.boundHandleThemeChange);
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        if (documentSelect) {
            documentSelect.removeEventListener('change', this.boundUpdateDownloadButtonState);
        }
    }

    async closeModal(_target) { await assistOS.UI.closeModal(_target); }

    _updateDeployButtonState() {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        const deployButton = this.element.querySelector('#downloadQaButton');
        if (documentSelect && deployButton) {
            this.selectedDocumentId = documentSelect.value;
            deployButton.disabled = !this.selectedDocumentId;
        } else if (deployButton) {
            deployButton.disabled = true;
        }
    }

    setupEventListeners() {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        if (documentSelect) {
            documentSelect.removeEventListener('change', this.boundUpdateDownloadButtonState);
            documentSelect.addEventListener('change', this.boundUpdateDownloadButtonState);
        }
    }

    async deployProjectAction(sourceElement) {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        let docIdForProcessing = null;
        let docTitleForProcessing = null;

        if (documentSelect) {
            docIdForProcessing = documentSelect.value;
            const selectedOptionElement = documentSelect.options[documentSelect.selectedIndex];

            if (docIdForProcessing && selectedOptionElement) {
                docTitleForProcessing = selectedOptionElement.getAttribute('data-title') || `Project_QA_${docIdForProcessing}`;
            } else {
                alert("Please select a QA document to deploy.");
                return;
            }
        } else {
            alert("Critical UI error: Document selection dropdown is missing. Processing cannot proceed.");
            return;
        }
        await this._executeProcessingAndDeploy(docIdForProcessing, docTitleForProcessing);
    }

    _getNodeDetailsFromLine(line) {
        const lineTrimmedStart = line.trimStart(); if (!lineTrimmedStart) return null;
        const indent = line.length - lineTrimmedStart.length;
        let name = lineTrimmedStart.replace(/^(├──\s|└──\s|│\s{3})*/, '').replace(/^[│├└─\s]*/, '').trim();
        if (name.length === 0 || name.startsWith("```")) return null;
        const isDirectory = name.endsWith('/'); if (isDirectory) name = name.slice(0, -1);
        if (name.length === 0) return null;
        const depth = (indent === 0 && !line.match(/^(├──\s|└──\s|│\s{3})/)) ? 0 : Math.round(indent / 4);
        return { name, depth, isDirectory };
    }

    _parseProjectStructureTree(structureText) {
        const lines = structureText.split('\n').filter(line => line.trim() !== '');
        const fileMap = {};
        const directoryPaths = new Set();
        const pathStack = [];
        let rootFolder = '';
        const depthContextStack = [-1];

        if (lines.length === 0) {
            return { fileMap, directoryPaths, rootFolder };
        }

        for (const line of lines) {
            const details = this._getNodeDetailsFromLine(line);
            if (!details || typeof details.name !== 'string' || details.name.trim() === "" || typeof details.depth !== 'number') {
                continue;
            }
            let { name, depth, isDirectory } = details;
            while (depth <= depthContextStack[depthContextStack.length - 1]) {
                if (pathStack.length === 0 || depthContextStack.length <= 1) break;
                pathStack.pop();
                depthContextStack.pop();
            }
            const parentPath = pathStack.join('/');
            let currentItemFullPath = parentPath ? `${parentPath}/${name}` : name;
            if (!rootFolder && depth === 0 && isDirectory) {
                rootFolder = name;
            }
            if (rootFolder && currentItemFullPath.startsWith(rootFolder + '/' + rootFolder + '/')) {
                currentItemFullPath = currentItemFullPath.substring(rootFolder.length + 1);
            }
            let previousPath;
            do {
                previousPath = currentItemFullPath;
                currentItemFullPath = currentItemFullPath.replace("src/src/", "src/");
            } while (currentItemFullPath !== previousPath);

            if (isDirectory) {
                directoryPaths.add(currentItemFullPath.endsWith('/') ? currentItemFullPath : currentItemFullPath + "/");
                pathStack.push(name);
                depthContextStack.push(depth);
            } else {
                fileMap[name] = currentItemFullPath;
            }
        }
        if (!rootFolder && (Object.keys(fileMap).length > 0 || directoryPaths.size > 0)) {
            const allTopLevelEntries = [];
            lines.forEach(l => {
                const d = this._getNodeDetailsFromLine(l);
                if (d && d.depth === 0 && d.name) allTopLevelEntries.push(d);
            });
            if (allTopLevelEntries.length === 1 && allTopLevelEntries[0].isDirectory) {
                rootFolder = allTopLevelEntries[0].name;
            }
        }
        return { fileMap, directoryPaths, rootFolder };
    }

    _cleanCodeContent(rawCode) {
        if (!rawCode) return "";
        // Înlătură ```python, ```javascript, ``` etc. de la început
        let cleanedCode = rawCode.replace(/^```[a-zA-Z]*\s*\n?/, '');
        // Înlătură ``` de la sfârșit
        cleanedCode = cleanedCode.replace(/\n?```$/, '');
        return cleanedCode.trim(); // Elimină spațiile goale de la început/sfârșit
    }

    async extractProjectFilesFromDoc(document) {
        if (!document || !document.chapters || !Array.isArray(document.chapters) || document.chapters.length === 0) {
            console.warn("Documentul nu are capitole sau structura capitolelor este invalidă.");
            return { authoritativeStructureText: null, codeFiles: [] };
        }
        let authoritativeStructureText = null;
        const codeFiles = [];
        const ignoreChapterKeywords = ["Summary", "Fallback", "Overview", "Introduction"];
        const firstChapter = document.chapters[0];

        if (firstChapter?.paragraphs?.[0]?.text?.trim()) {
            authoritativeStructureText = firstChapter.paragraphs[0].text;
        } else {
            console.warn("Primul capitol (structura proiectului) lipsește sau este gol.");
        }

        for (let i = 1; i < document.chapters.length; i++) {
            const chapter = document.chapters[i];
            if (chapter?.title) {
                const chapterTitleTrimmed = chapter.title.trim();
                const titleLower = chapterTitleTrimmed.toLowerCase();
                const shouldBeIgnored = ignoreChapterKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
                if (!shouldBeIgnored) {
                    const rawCodeContent = chapter.paragraphs?.[0]?.text || "";
                    // *** MODIFICARE AICI: Curăță conținutul codului ***
                    const cleanedCode = this._cleanCodeContent(rawCodeContent);
                    codeFiles.push({
                        fileName: chapterTitleTrimmed,
                        code: cleanedCode
                    });
                }
            }
        }
        return { authoritativeStructureText, codeFiles };
    }

    async _getLLMResponseWithRetry(prompt, timeout, personalityId) {
        let attempts = 0;
        while (attempts < this.maxRetries) {
            try {
                return await Promise.race([
                    llmModule.generateText(assistOS.space.id, prompt, personalityId, true),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`LLM Timeout (Attempt ${attempts + 1})`)), timeout))
                ]);
            } catch (e) {
                attempts++;
                let retryAfterSeconds = (this.baseRetryDelay / 1000) * Math.pow(2, attempts - 1);
                console.warn(`LLM call failed (attempt ${attempts}/${this.maxRetries}): ${e.message}. Retrying after ${retryAfterSeconds}s...`);
                if (attempts >= this.maxRetries) throw new Error(`LLM failed after ${this.maxRetries} attempts: ${e.message}`);
                alert(`Problemă temporară cu AI (Încercarea ${attempts}/${this.maxRetries}). Reîncercare în ${retryAfterSeconds}s...`);
                await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
            }
        }
        throw new Error(`LLM call failed after ${this.maxRetries} attempts.`);
    }

    async _getStrictFilePathsInBulkFromLLM(authoritativeStructureText, codeFiles, personalityId) {
        const LLM_BULK_STRICT_PATHS_PROMPT_TEMPLATE = `
You are an AI assistant. Map chapter titles to full file paths based on PROJECT_STRUCTURE.
Return ONLY a valid JSON array: [{"original_chapter_title": "...", "determined_full_path": "..."}, ...].
Strictly follow these rules:
1. Align ALL paths with PROJECT_STRUCTURE. Place new files logically. Infer extensions.
2. If PROJECT_STRUCTURE has a root folder, start paths with it.
3. Use forward slashes. No ".." or "//". No starting/ending slashes.

PROJECT_STRUCTURE:
\`\`\`text
${authoritativeStructureText || "No structure provided. Assume standard project layout."}
\`\`\`

CODE_CHAPTERS:
\`\`\`json
${JSON.stringify(codeFiles.map(cf => ({ chapter_title: cf.fileName })), null, 2)}
\`\`\`

JSON Output:`;

        const response = await this._getLLMResponseWithRetry(LLM_BULK_STRICT_PATHS_PROMPT_TEMPLATE, 180000, personalityId);
        if (!response?.message) throw new Error("LLM returned empty response for bulk paths.");
        const jsonMatch = response.message.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\]|\{[\s\S]*\})/);
        const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : response.message;
        try {
            const pathMappings = JSON.parse(jsonString);
            if (!Array.isArray(pathMappings) || !pathMappings.every(p => p?.original_chapter_title && p?.determined_full_path)) {
                console.error("LLM bulk path response malformed:", pathMappings);
                throw new Error("LLM response is not a valid array of path objects.");
            }
            return pathMappings;
        } catch (e) {
            console.error("Failed to parse LLM bulk path response:", jsonString, e);
            throw new Error(`Failed to parse LLM bulk path response. ${e.message}. Raw: ${jsonString}`);
        }
    }

    async _determinaCaleStrictaIndividualaCuLLM(authoritativeStructureText, fileDescriptionOrChapterTitle, personalityId) {
        const LLM_INDIVIDUAL_STRICT_PATH_PROMPT_TEMPLATE = `
Determine the exact full file path for FILE_DESCRIPTION, strictly adhering to PROJECT_STRUCTURE.
Return ONLY the path string (e.g., src/utils/helpers.js).
Rules: Align with structure, infer extension, use forward slashes, no '..', no start/end slashes.

PROJECT_STRUCTURE:
\`\`\`text
${authoritativeStructureText || "No structure provided. Assume standard project layout."}
\`\`\`

FILE_DESCRIPTION:
\`${fileDescriptionOrChapterTitle}\`

Path:`;

        const response = await this._getLLMResponseWithRetry(LLM_INDIVIDUAL_STRICT_PATH_PROMPT_TEMPLATE, 60000, personalityId);
        if (response?.message) {
            let path = response.message.trim().replace(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/, '$1').trim().replace(/^`\s*([\s\S]*?)\s*`$/, '$1').trim();
            return path;
        }
        console.warn(`LLM (individual) returned no message for: "${fileDescriptionOrChapterTitle}"`);
        return null;
    }

    async _executeProcessingAndDeploy(documentId, documentTitle) {
        const deployButtonElem = this.element.querySelector('#downloadQaButton');
        if (deployButtonElem) deployButtonElem.disabled = true;

        let processingMessageElement = this.element.querySelector('#processingMessage');
        if (!processingMessageElement) {
            processingMessageElement = document.createElement('div');
            processingMessageElement.id = 'processingMessage';
            processingMessageElement.style.marginTop = '10px';
            const formActions = this.element.querySelector('.form-actions');
            if (formActions) {
                formActions.appendChild(processingMessageElement);
            } else if (deployButtonElem) {
                deployButtonElem.parentNode.insertBefore(processingMessageElement, deployButtonElem.nextSibling);
            } else {
                this.element.appendChild(processingMessageElement);
            }
        }
        processingMessageElement.innerText = "Se procesează... Acest lucru poate dura câteva minute.";

        let personality = personalityModule.getPersonalityByName(assistOS.space.id, constants.DEFAULT_PERSONALITY_NAME) || { id: null };

        try {
            this.projectCodeMap = new Map();
            const documentToExport = await documentModule.getDocument(assistOS.space.id, documentId);
            if (!documentToExport) throw new Error(`Nu s-a putut încărca documentul ID: ${documentId}.`);

            const { authoritativeStructureText, codeFiles } = await this.extractProjectFilesFromDoc(documentToExport);
            if (!authoritativeStructureText) {
                console.warn("Authoritative structure text is missing. Path determination by LLM might be less accurate for directories.");
            }

            const pathMapFromLLM = new Map();
            if (codeFiles.length > 0) {
                processingMessageElement.innerText = "Se determină căile fișierelor (LLM)...";
                const pathMappings = await this._getStrictFilePathsInBulkFromLLM(authoritativeStructureText, codeFiles, personality.id);
                pathMappings.forEach(mapping => pathMapFromLLM.set(mapping.original_chapter_title, mapping.determined_full_path));
            }

            const filesRequiringIndividualLLM = codeFiles.filter(fileData => !pathMapFromLLM.has(fileData.fileName));
            if (filesRequiringIndividualLLM.length > 0) {
                processingMessageElement.innerText = `Se determină ${filesRequiringIndividualLLM.length} căi individual...`;
                for (let i = 0; i < filesRequiringIndividualLLM.length; i++) {
                    const fileData = filesRequiringIndividualLLM[i];
                    processingMessageElement.innerText = `Procesare individuală: ${fileData.fileName} (${i + 1}/${filesRequiringIndividualLLM.length})...`;
                    if (i > 0) await new Promise(resolve => setTimeout(resolve, this.individualCallDelay));
                    const individualPath = await this._determinaCaleStrictaIndividualaCuLLM(authoritativeStructureText, fileData.fileName, personality.id);
                    if (individualPath) {
                        pathMapFromLLM.set(fileData.fileName, individualPath);
                    } else {
                        console.warn(`Calea pentru '${fileData.fileName}' nu a putut fi determinată individual, va fi omisă.`);
                    }
                }
            }

            processingMessageElement.innerText = "Se mapează codul și structura...";
            const addedMapPaths = new Set();
            for (const fileData of codeFiles) {
                let finalPath = pathMapFromLLM.get(fileData.fileName);
                if (!finalPath) {
                    console.warn(`Fișierul '${fileData.fileName}' nu are o cale determinată și va fi omis.`);
                    continue;
                }
                finalPath = finalPath.replace(/^\/+|\/+$/g, '').replace(/\.\.\//g, '').replace("src/src/", "src/");
                if (finalPath === "") {
                    console.warn(`Calea pentru '${fileData.fileName}' a devenit goală după sanitizare și va fi omisă.`);
                    continue;
                }
                let newPath = finalPath; let count = 1;
                while (addedMapPaths.has(newPath)) {
                    const dotIndex = finalPath.lastIndexOf('.');
                    const base = dotIndex > 0 ? finalPath.substring(0, dotIndex) : finalPath;
                    const ext = dotIndex > 0 ? finalPath.substring(dotIndex) : "";
                    newPath = `${base}_${count}${ext}`; count++;
                }
                this.projectCodeMap.set(newPath, fileData.code || "");
                addedMapPaths.add(newPath);
            }

            if (authoritativeStructureText) {
                const { directoryPaths: parsedDeclaredDirs } = this._parseProjectStructureTree(authoritativeStructureText);
                if (parsedDeclaredDirs && parsedDeclaredDirs.size > 0) {
                    for (let dirPathWithSlash of parsedDeclaredDirs) {
                        let dirPath = dirPathWithSlash.endsWith('/') ? dirPathWithSlash.slice(0, -1) : dirPathWithSlash;
                        dirPath = dirPath.replace(/^\/+|\/+$/g, '').replace(/\.\.\//g, '').replace("src/src/", "src/");
                        if (dirPath && dirPath.trim() !== "") {
                            if (!this.projectCodeMap.has(dirPath)) {
                                let isSubPathOrParentOfExistingFile = false;
                                for (const existingPath of this.projectCodeMap.keys()) {
                                    if (existingPath.startsWith(dirPath + "/") || dirPath.startsWith(existingPath + "/")) {
                                        isSubPathOrParentOfExistingFile = true;
                                        break;
                                    }
                                }
                                if (!isSubPathOrParentOfExistingFile) {
                                    this.projectCodeMap.set(dirPath, FOLDER_MARKER_VALUE);
                                }
                            }
                        }
                    }
                }
            }

            processingMessageElement.innerText = "Se trimite sarcina către server...";
            const codeMapObject = Object.fromEntries(this.projectCodeMap);

            const taskData = {
                projectCodeMap: codeMapObject,
                targetDocumentTitle: documentTitle
            };

            console.log('Running application task with data:', taskData);
            const taskId = await applicationModule.runApplicationTask(
                assistOS.space.id,
                "HectorIDE",
                "GenerateDockerImage",
                taskData
            );

            console.log('Task created with ID:', taskId);
            assistOS.watchTask(taskId);
            await assistOS.UI.closeModal(this.element, taskId);

        } catch (error) {
            console.error("Eroare la procesare și 'deploy':", error);
            alert(`Eroare: ${error.message}`);
            if (processingMessageElement) processingMessageElement.innerText = `Eroare: ${error.message}`;
        } finally {
            if (deployButtonElem) deployButtonElem.disabled = false;
        }
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        if (typeof this.invalidate === 'function') {
            this.invalidate();
        }
    }
}