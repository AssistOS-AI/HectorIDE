const documentModule = assistOS.loadModule('document', {});
const assistOSSDK = require("assistos")
const llmModule = require("assistos").loadModule("llm", {});
const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});
const constants = assistOSSDK.constants;

export class HectorIdeComponentsModalPhase3Download {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.qaDocuments = [];
        this.documentOptions = [];
        this.selectedDocumentId = null;
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.jszipLoadingPromise = null;
        this.fileSaverLoadingPromise = null;
        this.boundUpdateDownloadButtonState = this._updateDownloadButtonState.bind(this);
        this.boundHandleThemeChange = this.handleThemeChange.bind(this);
        this.maxRetries = 3;
        this.baseRetryDelay = 5000;
        this.individualCallDelay = 6000;
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
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
                const errorMsg = `Failed to load script dynamically: ${url}`;
                console.error(errorMsg);
                reject(new Error(errorMsg));
            };
            document.head.appendChild(script);
        });
    }

    async _ensureLibrariesLoaded() {
        try {
            if (typeof window.JSZip === 'undefined') {
                if (!this.jszipLoadingPromise) {
                    this.jszipLoadingPromise = this._loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
                }
                await this.jszipLoadingPromise;
                if (typeof window.JSZip === 'undefined') {
                    throw new Error("JSZip library failed to define window.JSZip after script load.");
                }
            }
            if (typeof window.saveAs === 'undefined') {
                if (!this.fileSaverLoadingPromise) {
                    this.fileSaverLoadingPromise = this._loadScript("https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js");
                }
                await this.fileSaverLoadingPromise;
                if (typeof window.saveAs === 'undefined') {
                    throw new Error("FileSaver.js library failed to define window.saveAs after script load.");
                }
            }
            return true;
        } catch (error) {
            const libName = error.message.includes("JSZip") ? "JSZip" : (error.message.includes("FileSaver") ? "FileSaver.js" : "A required script");
            alert(`Error: ${libName} could not be loaded. Download functionality will be affected. Please check the browser console.`);
            return false;
        }
    }

    async beforeRender() {
        try {
            const allDocumentsMetadata = await documentModule.getDocumentsMetadata(assistOS.space.id);
            this.qaDocuments = allDocumentsMetadata.filter(
                (doc) => doc.title?.endsWith("QA")
            ) || [];

            if (this.qaDocuments.length > 0) {
                this.documentOptions = this.qaDocuments.map(doc => {
                    let title = doc.title || doc.name || `Document ${doc.id || 'UnknownID'}`;
                    const displayTitle = title;
                    return `<option value="${doc.id}" data-title="${title}">${displayTitle}</option>`;
                }).join('');
            } else {
                this.documentOptions = "";
            }
        } catch (error) {
            this.documentOptions = '<option value="" disabled>Error loading documents</option>';
            this.qaDocuments = [];
        }
    }

    async afterRender() {
        this.setupEventListeners();
        document.removeEventListener('themechange', this.boundHandleThemeChange);
        document.addEventListener('themechange', this.boundHandleThemeChange);
        if (this.boundUpdateDownloadButtonState) {
            this.boundUpdateDownloadButtonState();
        }
    }

    disconnectedCallback() {
        if (this.boundHandleThemeChange) {
            document.removeEventListener('themechange', this.boundHandleThemeChange);
        }
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        if (documentSelect && this.boundUpdateDownloadButtonState) {
            documentSelect.removeEventListener('change', this.boundUpdateDownloadButtonState);
        }
    }

    async closeModal(_target) {
        await assistOS.UI.closeModal(_target);
    }

    _updateDownloadButtonState() {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        const downloadButton = this.element.querySelector('#downloadQaButton');
        if (documentSelect) {
            this.selectedDocumentId = documentSelect.value;
            if (downloadButton) {
                downloadButton.disabled = !this.selectedDocumentId || this.selectedDocumentId === "";
            }
        } else if (downloadButton) {
            downloadButton.disabled = true;
        }
    }

    setupEventListeners() {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        if (documentSelect) {
            documentSelect.removeEventListener('change', this.boundUpdateDownloadButtonState);
            documentSelect.addEventListener('change', this.boundUpdateDownloadButtonState);
        }
    }

    async downloadProjectAction(sourceElement) {
        const documentSelect = this.element.querySelector('#qaDocumentSelect');
        let docIdForDownload = null;
        let docTitleForZip = null;

        if (documentSelect) {
            docIdForDownload = documentSelect.value;
            if (docIdForDownload && typeof docIdForDownload === 'string' && docIdForDownload !== "") {
                const selectedOptionElement = documentSelect.options[documentSelect.selectedIndex];
                if (selectedOptionElement && selectedOptionElement.value === docIdForDownload) {
                    const titleAttr = selectedOptionElement.getAttribute('data-title');
                    if (titleAttr && typeof titleAttr === 'string' && titleAttr.trim() !== "" && !["null", "undefined"].includes(titleAttr.toLowerCase())) {
                        docTitleForZip = titleAttr;
                    } else {
                        const foundDoc = this.qaDocuments.find(d => d.id === docIdForDownload);
                        if (foundDoc && foundDoc.title) {
                            docTitleForZip = foundDoc.title;
                        } else {
                            docTitleForZip = `Project_QA_${docIdForDownload}`;
                        }
                    }
                } else {
                    alert("Document selection error. Please select a document and try again.");
                    return;
                }
            } else {
                alert("Please select a QA document to download.");
                return;
            }
        } else {
            alert("Critical UI error: Document selection dropdown is missing. Download cannot proceed.");
            return;
        }
        await this._executeDownloadProcess(docIdForDownload, docTitleForZip);
    }

    _getNodeDetailsFromLine(line) {
        const lineTrimmedStart = line.trimStart();
        if (!lineTrimmedStart) return null;
        const indent = line.length - lineTrimmedStart.length;
        let name = lineTrimmedStart.replace(/^(├──\s|└──\s|│\s{3})*/, '');
        name = name.replace(/^[│├└─\s]*/, '').trim();

        if (name.length === 0 || name.startsWith("```")) return null;

        const isDirectory = name.endsWith('/');
        if (isDirectory) {
            name = name.slice(0, -1);
        }

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
                const dirToAdd = currentItemFullPath.endsWith('/') ? currentItemFullPath : currentItemFullPath + "/";
                directoryPaths.add(dirToAdd);
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

    async extractProjectFilesFromDoc(document) {
        if (!document || !document.chapters || !Array.isArray(document.chapters) || document.chapters.length === 0) {
            console.warn("Documentul nu are capitole sau structura capitolelor este invalidă.");
            return { authoritativeStructureText: null, codeFiles: [] };
        }

        let authoritativeStructureText = null;
        const codeFiles = [];
        const ignoreChapterKeywords = ["Summary", "Fallback", "Overview", "Introduction"];

        const firstChapter = document.chapters[0];
        if (firstChapter && firstChapter.paragraphs && firstChapter.paragraphs[0] && typeof firstChapter.paragraphs[0].text === 'string' && firstChapter.paragraphs[0].text.trim() !== "") {
            authoritativeStructureText = firstChapter.paragraphs[0].text;
        } else {
            console.warn("Primul capitol (așteptat să fie structura proiectului) nu are conținut text valid sau este malformat.");
        }

        for (let i = 1; i < document.chapters.length; i++) {
            const chapter = document.chapters[i];
            if (chapter && chapter.title) {
                const chapterTitleTrimmed = chapter.title.trim();
                const titleLower = chapterTitleTrimmed.toLowerCase();
                const shouldBeIgnored = ignoreChapterKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));

                if (!shouldBeIgnored) {
                    const codeContent = chapter.paragraphs?.[0]?.text;
                    codeFiles.push({
                        fileName: chapterTitleTrimmed,
                        code: codeContent || ""
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
                const response = await Promise.race([
                    llmModule.generateText(assistOS.space.id, prompt, personalityId, true),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`LLM request timed out after ${timeout / 1000}s (attempt ${attempts + 1})`)), timeout)
                    )
                ]);
                return response;
            } catch (e) {
                attempts++;
                let retryAfterSeconds = this.baseRetryDelay / 1000 * Math.pow(2, attempts -1) ;
                let isRateLimitError = false;
                let errorMessageForAlert = e.message;

                if (e.message && (e.message.includes("429") || e.message.includes("RESOURCE_EXHAUSTED"))) {
                    isRateLimitError = true;
                    errorMessageForAlert = `Rate limit error: ${e.message}`;
                    try {
                        const errorJsonMatch = e.message.match(/{[\s\S]*}/);
                        if (errorJsonMatch) {
                            const errorObj = JSON.parse(errorJsonMatch[0]);
                            if (errorObj.error && errorObj.error.details) {
                                const retryInfo = errorObj.error.details.find(d => d["@type"] === "[type.googleapis.com/google.rpc.RetryInfo](https://type.googleapis.com/google.rpc.RetryInfo)");
                                if (retryInfo && retryInfo.retryDelay) {
                                    const suggestedDelay = parseInt(retryInfo.retryDelay.replace('s', ''), 10);
                                    if (!isNaN(suggestedDelay) && suggestedDelay > 0) {
                                        retryAfterSeconds = suggestedDelay;
                                    }
                                }
                            }
                        }
                    } catch (parseError) {
                        console.warn("Could not parse retryDelay from API error, using default backoff.", parseError);
                    }
                } else if (e.message && e.message.toLowerCase().includes("timeout")) {
                    errorMessageForAlert = `Timeout error: ${e.message}`;
                    retryAfterSeconds = this.baseRetryDelay / 1000 * Math.pow(2, attempts-1);
                }


                if ((isRateLimitError || e.message.toLowerCase().includes("timeout")) && attempts < this.maxRetries) {
                    console.warn(`LLM call failed (attempt ${attempts}/${this.maxRetries}): ${e.message}. Retrying after ${retryAfterSeconds}s...`);
                    alert(`A apărut o problemă temporară la comunicarea cu AI-ul (Încercarea ${attempts}/${this.maxRetries}). Se reîncearcă în ${retryAfterSeconds} secunde... Vă rugăm așteptați.`);
                    await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
                } else {
                    console.error(`LLM call failed definitively after ${attempts} attempts:`, e);
                    throw new Error(`LLM call failed definitively: ${errorMessageForAlert}`);
                }
            }
        }
        throw new Error(`LLM call failed after ${this.maxRetries} attempts. No response received.`);
    }


    async _getStrictFilePathsInBulkFromLLM(authoritativeStructureText, codeFiles, personalityId) {
        const LLM_BULK_STRICT_PATHS_PROMPT_TEMPLATE = `
You are an AI assistant specialized in software project structure analysis. Your task is to map chapter titles to their appropriate file paths, strictly adhering to a given project structure.

You will be provided with:
1.  **PROJECT_STRUCTURE**: A string representing the project's directory and file tree structure. This is the authoritative source of truth for all paths.
2.  **CODE_CHAPTERS**: A JSON array of objects. Each object contains:
    * \`chapter_title\`: A string, often describing the file's purpose, a component name, or the filename itself.

Your goal is to process this information and return a JSON array of objects. Each object in your output array must include:
* \`original_chapter_title\`: The exact \`chapter_title\` from the input.
* \`determined_full_path\`: The calculated full path (including the filename and appropriate extension, e.g., \`src/components/MyComponent.js\`, \`README.md\`) where the code corresponding to this chapter title should be saved.

**CRITICAL INSTRUCTIONS FOR DETERMINING THE PATH (MUST BE FOLLOWED STRICTLY):**
1.  **Strict Adherence to \`PROJECT_STRUCTURE\`**: All \`determined_full_path\` entries MUST align with the provided \`PROJECT_STRUCTURE\`.
    * Analyze the \`PROJECT_STRUCTURE\` to understand the intended folder hierarchy, existing file names, and common conventions used in this specific project.
    * If a \`chapter_title\` seems to match an an existing file or directory pattern in \`PROJECT_STRUCTURE\`, use that precise path.
    * If a \`chapter_title\` implies a new file, place it in the most logical existing directory according to the \`PROJECT_STRUCTURE\`. Do NOT create new top-level directories unless the \`PROJECT_STRUCTURE\` itself is empty or implies such a need for a very common case (e.g. a single 'src' or 'app' root for all code if none exists).
2.  **Root Folder Identification**: If a clear root folder for the project is identifiable *within* the \`PROJECT_STRUCTURE\` itself (e.g., \`my-app/\`, \`project_root/\`), all \`determined_full_path\` entries should start with this root folder name. If no single project root folder is evident in the structure text (e.g. multiple top-level dirs like 'src/', 'docs/', 'tests/'), paths should be relative to the top level shown in \`PROJECT_STRUCTURE\`.
3.  **File Extension Inference**: Infer appropriate file extensions (e.g., \`.js\`, \`.ts\`, \`.py\`, \`.html\`, \`.css\`, \`.java\`, \`.json\`, \`.md\`) based on hints in the \`chapter_title\` or common conventions for such files evident in \`PROJECT_STRUCTURE\`. If \`PROJECT_STRUCTURE\` lists similar files with extensions, maintain consistency. For example, if \`chapter_title\` is "User Authentication Service" and \`PROJECT_STRUCTURE\` contains \`api/userService.ts\`, then a suitable path might be \`api/authService.ts\`.
4.  **Path Formatting**: Ensure paths use forward slashes ('/') as separators. Ensure filenames in \`determined_full_path\` use standard characters and are valid. Do not use ".." or consecutive slashes like "//" in paths. Paths should not start or end with a slash.

**Input Data:**

**PROJECT_STRUCTURE:**
\`\`\`text
${"$"}{authoritativeProjectStructure}
\`\`\`

**CODE_CHAPTERS (JSON Array of objects with 'chapter_title' ONLY):**
\`\`\`json
${"$"}{codeChaptersJsonString}
\`\`\`

**Required Output Format:**
Return ONLY a valid JSON array of objects as described above (original_chapter_title, determined_full_path). Do not include any other text, explanations, or markdown formatting around the JSON output.
Example:
[
  { "original_chapter_title": "Main Application File", "determined_full_path": "src/app.js" },
  { "original_chapter_title": "User Authentication Service", "determined_full_path": "src/services/authService.js" },
  { "original_chapter_title": "Project Readme", "determined_full_path": "README.md" }
]
`;
        const chaptersForLLM = codeFiles.map(cf => ({ chapter_title: cf.fileName }));
        const codeChaptersJsonString = JSON.stringify(chaptersForLLM, null, 2);

        const finalPrompt = LLM_BULK_STRICT_PATHS_PROMPT_TEMPLATE
            .replace("${authoritativeProjectStructure}", authoritativeStructureText || "No specific project structure provided. Assume standard conventions.")
            .replace("${codeChaptersJsonString}", codeChaptersJsonString);

        try {
            const response = await this._getLLMResponseWithRetry(finalPrompt, 180000, personalityId);
            let pathMappings;
            if (response && response.message) {
                const message = response.message;
                const jsonMatch = message.match(/```json\s*([\s\S]*?)\s*```|(\[[\s\S]*\]|\{[\s\S]*\})/);
                let jsonString;
                if (jsonMatch) {
                    jsonString = jsonMatch[1] || jsonMatch[2];
                } else {
                    jsonString = message;
                }
                try {
                    pathMappings = JSON.parse(jsonString);
                    if (!Array.isArray(pathMappings) || !pathMappings.every(p => p && typeof p.original_chapter_title === 'string' && typeof p.determined_full_path === 'string')) {
                        console.error("LLM bulk path response is not a valid array of expected objects:", pathMappings);
                        throw new Error("LLM bulk path response has invalid structure.");
                    }
                    return pathMappings;
                } catch (e) {
                    console.error("Failed to parse LLM bulk path response as JSON. String was:", jsonString, "Error:", e);
                    throw new Error(`Failed to parse LLM bulk path response. Output was: ${jsonString}`);
                }
            } else {
                throw new Error("LLM returned empty or invalid response for bulk strict path determination after retries.");
            }
        } catch (error) {
            console.error(`LLM error in _getStrictFilePathsInBulkFromLLM after retries:`, error);
            throw error;
        }
    }

    async _determinaCaleStrictaIndividualaCuLLM(authoritativeProjectStructure, fileDescriptionOrChapterTitle, personalityId) {
        const LLM_INDIVIDUAL_STRICT_PATH_PROMPT_TEMPLATE = `
You are an AI assistant. Your task is to determine the exact, full, and final file path for a given file description, strictly adhering to the provided project structure.

**PROJECT_STRUCTURE:**
\`\`\`text
${"$"}{authoritativeProjectStructure}
\`\`\`

**FILE_DESCRIPTION (this is often a chapter title, a component name, or the filename itself):**
\`${"$"}{fileDescriptionOrChapterTitle}\`

**Instructions (Apply Strictly):**
1.  Analyze \`FILE_DESCRIPTION\` and \`PROJECT_STRUCTURE\`.
2.  Determine the most appropriate full path (including filename and correct extension) for \`FILE_DESCRIPTION\`.
3.  The path MUST align with \`PROJECT_STRUCTURE\`. If \`FILE_DESCRIPTION\` is new, place it logically within existing directories from \`PROJECT_STRUCTURE\`.
4.  Infer extensions based on \`PROJECT_STRUCTURE\` conventions or file type.
5.  If \`PROJECT_STRUCTURE\` indicates a root project folder (e.g., "my-app/"), paths must start with it. Otherwise, relative to top level.
6.  Use forward slashes ('/'). No ".." or consecutive slashes. Paths should not start or end with a slash.

**Required Output Format:**
Return ONLY a single string: the determined full file path. E.g., \`src/components/NewWidget.jsx\` or \`config/settings.json\`.
`;
        const finalPrompt = LLM_INDIVIDUAL_STRICT_PATH_PROMPT_TEMPLATE
            .replace("${authoritativeProjectStructure}", authoritativeProjectStructure || "No specific project structure provided.")
            .replace("${fileDescriptionOrChapterTitle}", fileDescriptionOrChapterTitle);

        try {
            const response = await this._getLLMResponseWithRetry(finalPrompt, 60000, personalityId);
            if (response && response.message) {
                let path = response.message.trim();
                path = path.replace(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/, '$1').trim();
                path = path.replace(/^`\s*([\s\S]*?)\s*`$/, '$1').trim();
                return path;
            }
            console.warn(`LLM (individual call) returned empty response for: "${fileDescriptionOrChapterTitle}"`);
            return null;
        } catch (error) {
            console.error(`LLM error in _determinaCaleStrictaIndividualaCuLLM for "${fileDescriptionOrChapterTitle}" after retries:`, error);
            return null;
        }
    }


    async _executeDownloadProcess(documentId, documentTitleFromDropdown) {
        const downloadButtonElem = this.element.querySelector('#downloadQaButton');
        if (downloadButtonElem) downloadButtonElem.disabled = true;
        let processingMessageElement = this.element.querySelector('#processingMessage');
        if (!processingMessageElement) {
            processingMessageElement = document.createElement('div');
            processingMessageElement.id = 'processingMessage';
            processingMessageElement.style.marginTop = '10px';
            downloadButtonElem.parentNode.insertBefore(processingMessageElement, downloadButtonElem.nextSibling);
        }
        processingMessageElement.innerText = "Se procesează... Acest lucru poate dura câteva minute.";


        let personality = personalityModule.getPersonalityByName(assistOS.space.id, constants.DEFAULT_PERSONALITY_NAME);
        if (!personality) {
            personality = { id: null };
        }


        try {
            if (!await this._ensureLibrariesLoaded()) {
                throw new Error("Bibliotecile necesare nu au putut fi încărcate.");
            }

            const titleToProcess = documentTitleFromDropdown;
            const baseZipName = titleToProcess.replace(/QA$/, "").trim().replace(/[\s\/\\?%*:|"<>]/g, '_');
            let zipFileName = `${baseZipName}_Project.zip`;

            const documentToExport = await documentModule.getDocument(assistOS.space.id, documentId);
            if (!documentToExport) {
                throw new Error(`Nu s-a putut încărca documentul cu ID: ${documentId}.`);
            }

            const { authoritativeStructureText, codeFiles } = await this.extractProjectFilesFromDoc(documentToExport);

            if (!authoritativeStructureText) {
                throw new Error("Critical: Primul capitol (structura proiectului) lipsește sau este gol. Generarea ZIP a fost anulată.");
            }

            const zip = new window.JSZip();
            const addedZipPaths = new Set();

            if (authoritativeStructureText) {
                let authoritativeStructureText2 = assistOS.UI.unsanitize(authoritativeStructureText)
                zip.file("PROJECT_STRUCTURE.txt", authoritativeStructureText2);
                addedZipPaths.add("PROJECT_STRUCTURE.txt");
            }

            let pathMappings = [];
            if (codeFiles.length > 0) {
                pathMappings = await this._getStrictFilePathsInBulkFromLLM(authoritativeStructureText, codeFiles, personality.id);
            }

            const pathMapFromLLM = new Map();
            if (pathMappings && Array.isArray(pathMappings)) {
                pathMappings.forEach(mapping => {
                    if (mapping.original_chapter_title && mapping.determined_full_path) {
                        pathMapFromLLM.set(mapping.original_chapter_title, mapping.determined_full_path);
                    }
                });
            } else {
                console.warn("Răspunsul LLM (bulk) pentru căi este invalid sau gol. Se va încerca individual pentru fiecare fișier.");
            }

            const filesRequiringIndividualLLM = [];
            for (const fileData of codeFiles) {
                if (!pathMapFromLLM.has(fileData.fileName)) {
                    filesRequiringIndividualLLM.push(fileData);
                }
            }

            if (filesRequiringIndividualLLM.length > 0) {
                processingMessageElement.innerText = `Apelul general nu a mapat ${filesRequiringIndividualLLM.length} fișiere. Se încearcă individual (cu pauze)...`;
                for (let i = 0; i < filesRequiringIndividualLLM.length; i++) {
                    const fileData = filesRequiringIndividualLLM[i];
                    processingMessageElement.innerText = `Procesare individuală: ${fileData.fileName} (${i+1}/${filesRequiringIndividualLLM.length})...`;

                    if (i > 0) {
                        console.log(`Așteptare ${this.individualCallDelay / 1000}s înainte de următorul apel LLM individual.`);
                        await new Promise(resolve => setTimeout(resolve, this.individualCallDelay));
                    }

                    const individualPath = await this._determinaCaleStrictaIndividualaCuLLM(authoritativeStructureText, fileData.fileName, personality.id);
                    if (individualPath) {
                        pathMapFromLLM.set(fileData.fileName, individualPath);
                    } else {
                        throw new Error(`Eroare critică: Calea pentru fișierul '${fileData.fileName}' nu a putut fi determinată de AI nici după încercarea individuală. Generarea ZIP a fost anulată pentru a asigura corectitudinea.`);
                    }
                }
            }

            processingMessageElement.innerText = "Se adaugă fișierele în arhiva ZIP...";
            for (const fileData of codeFiles) {
                let finalZipPath = pathMapFromLLM.get(fileData.fileName);

                if (finalZipPath && typeof finalZipPath === 'string' && finalZipPath.trim() !== "") {
                    if (finalZipPath.startsWith('/')) finalZipPath = finalZipPath.substring(1);
                    let previousPath;
                    do {
                        previousPath = finalZipPath;
                        finalZipPath = finalZipPath.replace("src/src/", "src/");
                    } while (finalZipPath !== previousPath);
                    finalZipPath = finalZipPath.replace(/\.\.\//g, '');
                    finalZipPath = finalZipPath.replace(/^\/+|\/+$/g, '');
                    if (finalZipPath.endsWith('/')) finalZipPath = finalZipPath.slice(0, -1);

                    if (finalZipPath === "") {
                        throw new Error(`Eroare critică: Calea pentru '${fileData.fileName}' a devenit goală după sanitizare. Generarea ZIP a fost anulată.`);
                    }
                } else {
                    throw new Error(`Eroare critică: Nu s-a putut obține o cale validă pentru '${fileData.fileName}'. Generarea ZIP a fost anulată.`);
                }

                if (!addedZipPaths.has(finalZipPath)) {
                    zip.file(finalZipPath, fileData.code || "");
                    addedZipPaths.add(finalZipPath);
                } else {
                    let count = 1;
                    let newPath = finalZipPath;
                    const dotIndex = finalZipPath.lastIndexOf('.');
                    const base = dotIndex > 0 ? finalZipPath.substring(0, dotIndex) : finalZipPath;
                    const ext = dotIndex > 0 ? finalZipPath.substring(dotIndex) : "";
                    while (addedZipPaths.has(newPath)) {
                        newPath = `${base}_${count}${ext}`;
                        count++;
                    }
                    zip.file(newPath, fileData.code || "");
                    addedZipPaths.add(newPath);
                    console.warn(`Path collision for ${finalZipPath} (from chapter ${fileData.fileName}). Saved as ${newPath}. Acest lucru indică o problemă în structură sau răspunsul LLM.`);
                }
            }

            const { directoryPaths: parsedDeclaredDirs } = this._parseProjectStructureTree(authoritativeStructureText);
            if(parsedDeclaredDirs && parsedDeclaredDirs.size > 0) {
                for (let dirPath of parsedDeclaredDirs) {
                    let pathForFolder = dirPath.endsWith('/') ? dirPath.slice(0, -1) : dirPath;
                    let previousPath;
                    do {
                        previousPath = pathForFolder;
                        pathForFolder = pathForFolder.replace("src/src/", "src/");
                    } while (pathForFolder !== previousPath);
                    pathForFolder = pathForFolder.replace(/\.\.\//g, '');
                    pathForFolder = pathForFolder.replace(/^\/+|\/+$/g, '');

                    if (pathForFolder && pathForFolder.trim() !== "" && !addedZipPaths.has(pathForFolder + "/")) {
                        if (!addedZipPaths.has(pathForFolder)) {
                            zip.folder(pathForFolder);
                            addedZipPaths.add(pathForFolder + "/");
                        }
                    }
                }
            }

            processingMessageElement.innerText = "Se generează fișierul ZIP...";
            const content = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 9 }
            });

            window.saveAs(content, zipFileName);
            processingMessageElement.innerText = "Descărcare finalizată!";
            setTimeout(() => { processingMessageElement.innerText = ""; }, 5000);


        } catch (error) {
            console.error("Eroare la generarea arhivei proiectului:", error);
            alert(`Eroare la generarea arhivei proiectului: ${error.message}`);
            if(processingMessageElement) processingMessageElement.innerText = `Eroare: ${error.message}`;
        } finally {
            if (downloadButtonElem) downloadButtonElem.disabled = false;
        }
    }

    extractDocumentContent(document) {
        if (!document) return '';
        if (document.content && typeof document.content === 'string' && document.content.trim() !== '') {
            return document.content;
        }
        if (document.chapters && Array.isArray(document.chapters)) {
            return document.chapters
                .map(chapter => {
                    const texts = [];
                    if (chapter && chapter.title) {
                        texts.push(`Chapter: ${chapter.title}`);
                    }
                    if (chapter && Array.isArray(chapter.paragraphs)) {
                        texts.push(chapter.paragraphs
                            .filter(p => p && typeof p.text === 'string')
                            .map(p => p.text)
                            .join('\n\n'));
                    }
                    const filteredTexts = texts.filter(t => t && t.trim());
                    return filteredTexts.join('\n\n');
                })
                .filter(t => t && t.trim())
                .join('\n\n\n');
        }
        return '';
    }

    handleThemeChange() {
        this.currentTheme = document.documentElement.getAttribute('theme') || 'light';
        if (typeof this.invalidate === 'function') {
            this.invalidate();
        }
    }
}