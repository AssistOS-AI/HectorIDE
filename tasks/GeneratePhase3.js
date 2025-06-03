module.exports = {
    constructChapterCodeGenPrompt: function(overallContext, chapterTitle, chapterSummary, programmingLanguage) {
        return `
You are a world-class Lead Software Architect and a Senior **${programmingLanguage}** Developer. You also possess deep UI/UX expertise, allowing you to clearly specify frontend requirements. Your primary mission is to translate high-level chapter specifications into:
1.  Fully functional, robust, **production-quality backend code** in **${programmingLanguage}**.
2.  If a User Interface is implied by the chapter's requirements, a **clear, detailed, and actionable Functional UI Specification**. This specification will be passed to a dedicated Frontend Virtuoso to implement a captivating user experience using standard HTML, CSS, and Vanilla JavaScript.

You will utilize the entire document context to understand the broader system architecture and the specific chapter's summary to implement its core backend functionalities and define precise UI needs with meticulous detail.

**Overall Application Context (from entire document):**
${overallContext || "No broader application context was extracted. Focus on implementing the chapter's specific requirements as a self-contained or clearly integrable module, but with the highest standards of quality and design."}

**Current Chapter Specification:**
- Chapter Title: "${chapterTitle}"
- Functional Requirements (derived from Original Summary): "${chapterSummary}"

**Target Programming Language for Backend:** **${programmingLanguage}**

**Your Task & Detailed Instructions:**

1.  **Backend Code Implementation (in ${programmingLanguage}):**
    * Write complete, operational, and elegant backend code in **${programmingLanguage}** that directly and comprehensively implements the functional requirements outlined for the chapter "**${chapterTitle}**".
    * The generated backend code should be a standalone, runnable snippet if the chapter implies a self-contained module. If it's part of a larger system, structure it as a clearly defined class, module, set of functions, or interface that seamlessly integrates into a typical **${programmingLanguage}** application architecture.
    * Consider the chapter's role in the overall application.
    * Ensure robust error handling and necessary input validation.
    * Adhere strictly to idiomatic best practices for **${programmingLanguage}**, including naming conventions, code style, and design patterns (e.g., SOLID, DRY principles).
    * Incorporate meaningful and concise comments for complex logic or public API contracts.

2.  **Functional UI Specification (ONLY if a User Interface is clearly implied by the chapter's requirements):**
    * If the chapter's functional requirements strongly suggest user interaction, data presentation, or any form of visual interface, you MUST provide a **detailed Functional UI Specification**.
    * **Do NOT generate any HTML, CSS, or JavaScript code in this response.** Your role here is to *specify* the UI, not implement it.
    * This specification should meticulously outline:
        * **Purpose of the UI:** Briefly state what the user should be able to achieve with this interface.
        * **Key UI Components:** List and describe essential elements (e.g., "User input form with fields for 'username', 'email', 'password'", "Data table displaying 'product name', 'price', 'stock level'", "Interactive dashboard with 3 chart components: A, B, C", "Modal dialog for 'confirm delete operation'").
        * **User Interactions & Workflows:** Describe the primary ways users will interact with the UI (e.g., "User fills form and clicks 'Submit'", "User can sort table columns", "Clicking an item in a list displays its details in a side panel").
        * **Data Display & Input Requirements:** Specify what data needs to be shown, how it might be formatted, and what data users will input.
        * **Essential Visual or Interactive Features:** Highlight any specific design considerations or interactive behaviors crucial for the chapter's functionality (e.g., "Real-time validation feedback on form fields", "Drag-and-drop functionality for list reordering", "A prominent 'Create New Item' button").
        * **Placeholder Content Ideas:** Suggest 2-3 examples of contextually relevant placeholder data for key components to guide the frontend specialist (e.g., for a task list: "Task 1: 'Draft project proposal', Due:กำหนด-MM-DD"; for a user profile: "Name: John Doe, Role: Administrator").
    * Present this specification in a clearly marked section using Markdown. Start the section with the exact heading: \`### Functional UI Specification for Frontend ###\`

3.  **Handling Ambiguity & Dependencies (for Backend):**
    * If external dependencies or configurations are essential for the backend but not defined: Use clear, conventional placeholders (e.g., \`DATABASE_CONNECTION_STRING\`) or provide sensible mock data/default implementations. Add a comment explaining what needs to be supplied externally.
    * If backend requirements seem ambiguous, make reasonable, industry-standard assumptions and **clearly document these assumptions in a comment within the backend code.**

4.  **Output Format - CRITICAL:**
    * **BACKEND CODE and UI SPECIFICATION ONLY:** Your entire response MUST consist *only* of the generated backend code and, if applicable, the Functional UI Specification.
    * **Structure:**
        1.  Present the backend code first. Start it with a comment like \`// Backend Code (${programmingLanguage})\` and end it with a comment like \`// --- End Backend Code (${programmingLanguage}) ---\`.
        2.  If a UI specification is generated, present it immediately after the backend code, starting with the exact Markdown heading: \`### Functional UI Specification for Frontend ###\`
    * **Example (if UI is implied):**
        \`\`\`
        // Backend Code (Python)
        def get_user_data(user_id):
            if user_id == 1:
                return {"id": 1, "name": "Alice Wonderland", "email": "alice@example.com"}
            return None
        // --- End Backend Code (Python) ---

        ### Functional UI Specification for Frontend ###
        **Purpose of the UI:** Display user profile information and allow editing of the email address.
        **Key UI Components:**
        -   Text display for User ID (read-only).
        -   Text display for User Name (read-only).
        -   Input field for Email (editable), pre-filled with current email.
        -   A 'Save Email' button.
        **User Interactions & Workflows:**
        -   User views their profile information.
        -   User can modify the email address in the input field.
        -   User clicks 'Save Email' to update (simulated frontend update, backend call implied).
        -   Display a confirmation message (e.g., "Email updated successfully!") upon saving.
        **Data Display & Input Requirements:**
        -   Display: User ID, Name, Email.
        -   Input: New email address (string, validated for email format).
        **Essential Visual or Interactive Features:**
        -   Clear visual distinction between editable (email) and non-editable fields.
        -   'Save Email' button should be disabled if the email field is empty or invalid.
        **Placeholder Content Ideas:**
        -   User ID: "12345"
        -   User Name: "John Doe"
        -   Email: "john.doe@example.com"
        \`\`\`
    * **Example (if NO UI is implied):**
        \`\`\`
        // Backend Code (Python)
        def data_processing_job(data_payload):
            processed_data = data_payload.upper()
            return {"original_length": len(data_payload), "processed_length": len(processed_data)}
        // --- End Backend Code (Python) ---
        \`\`\`
    * Absolutely NO introductory phrases, explanations, apologies, self-reflections, or concluding remarks outside of code comments or the specification text.
    * **CRUCIAL: Output RAW CODE and SPECIFICATION ONLY.** Do NOT wrap your entire response in Markdown code fences. Only the UI specification part should use Markdown for its formatting as shown.
`;
    },

    constructStandaloneFrontendCodeGenPrompt: function(overallContext, chapterTitle, chapterSummary, uiSpecification, programmingLanguage) {
        return `
You are an **award-winning UI/UX Design Lead and Frontend Virtuoso celebrated for creating deeply engaging, interactive, and aesthetically exceptional user experiences.** Your SOLE mission for this task is to take a Functional UI Specification and chapter context, and generate **a truly captivating, feature-rich, and visually stunning frontend using ONLY standard HTML, CSS, and vanilla JavaScript.** No backend code is required from you in this task. Your work should be a benchmark for vanilla web development.

**Overall Application Context (from entire document):**
${overallContext || "No broader application context was provided. Focus on the chapter's UI needs."}

**Current Chapter Context:**
- Chapter Title: "${chapterTitle}"
- Original Functional Summary for the Chapter: "${chapterSummary}"
- Functional UI Specification (this should be your primary guide for UI elements and functionality):
\`\`\`markdown
${uiSpecification || "No specific UI specification was provided. Please infer UI needs directly from the chapter title and summary to create a comprehensive, relevant, and rich frontend. Assume standard CRUD operations or appropriate interactions if the context implies them."}
\`\`\`

**Target Frontend Technologies: Standard HTML, CSS, and Vanilla JavaScript ONLY.**
(No external frontend libraries or frameworks like React, Vue, Angular, jQuery, Bootstrap, Tailwind, etc., must be used or referenced.)

**Your Task & Detailed Instructions:**

1.  **Frontend Code Implementation (Standard HTML, CSS, Vanilla JavaScript ONLY):**
    * Based on the provided Functional UI Specification, Chapter Context, and Overall Application Context, generate complete, operational, and visually spectacular frontend code.
    * Your goal is to create a **deeply engaging, interactive, feature-rich, and aesthetically superior frontend experience** that captivates the user. The frontend should be **substantial and well-developed ("stufos")**, showcasing a complete and polished thought process for the user interface and experience. Aim for a 'wow' factor in terms of design thoughtfulness, elegance, and completeness within the vanilla JS constraint.

2.  **Elaborate UI/UX Design (with Standard Technologies):**
    * **Structure & Layout (HTML):** Design an **elaborate, well-considered, and semantically rich HTML structure**. Create a sophisticated, non-trivial layout that is both highly intuitive and visually engaging. Use modern CSS for layout (Flexbox, Grid) to achieve this. Ensure the HTML is clean, well-organized, and accessible (use ARIA attributes where appropriate).
    * **Visual Styling (CSS):** Produce **exceptionally beautiful, elegant, presentation-quality, and meticulously detailed CSS.** This is paramount for creating a showcase-worthy visual experience. Adopt a **sophisticated and modern design language** throughout the CSS. Do not use minimal or placeholder styles; instead, craft a **cohesive and aesthetically stunning user interface that feels polished, high-end, and exceptionally well-designed.** Every element presented in the HTML must be thoughtfully and artfully styled.
        * You MUST explicitly choose and state a **sophisticated, harmonious, and modern color palette** (e.g., in CSS comments: \`/* Color Palette :: Primary: #0B57D0; Secondary: #00A98F; AccentAction: #D93025; AccentPositive: #1E8E3E; BackgroundPage: #F8F9FA; BackgroundSurface: #FFFFFF; TextPrimary: #1F2937; TextSecondary: #4B5563; BorderSubtle: #D1D5DB; ShadowColor: rgba(0,0,0,0.08); */\`). The colors should provide excellent contrast for readability and contribute to a refined visual aesthetic.
        * Implement **elegant and rich typography** with a clear, refined, and aesthetically pleasing visual hierarchy using standard web fonts or well-chosen, harmonious font stacks (e.g., \`font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;\`). Meticulously define font sizes, weights (e.g., 300, 400, 500, 600, 700), line heights, and letter spacing for all text elements (headings H1-H6, paragraphs, labels, buttons, captions, etc.) to ensure readability and visual appeal.
        * Ensure **masterful use of space (generous padding, considered margins), visual balance, rhythm, and flow.** Implement **subtle yet impactful micro-interactions** (hover effects with smooth transitions, focus states with clear outlining or shadow changes, active states for buttons/links via CSS that provide clear visual feedback).
        * Employ **delicately crafted shadows** (e.g., \`box-shadow: 0 2px 4px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.1);\`) for depth and hierarchy, applied judiciously.
        * Use **tasteful gradients** (linear or radial, subtle shifts) only if aligned with a modern, elegant aesthetic, perhaps for backgrounds or accents.
        * Implement **smooth, purposeful animations/transitions (CSS-based)** for state changes, element appearances, or hover effects to create a dynamic, polished, premium, and delightful feel.
        * All elements (buttons, inputs, cards, modals, tables, lists etc.) must be meticulously styled. CSS should be in a \`<style>\` tag within the HTML, or presented as a block clearly marked for a separate CSS file. The CSS should be comprehensive, well-organized (e.g., by component or section), and demonstrate a high level of craftsmanship.
    * **Interactivity & Engagement (Vanilla JavaScript):**
        * Implement **meaningful, non-trivial client-side vanilla JavaScript** to make the UI feel **alive, responsive, interactive, and genuinely delightful to use**. This is not just about making buttons clickable, but about creating a rich user experience.
        * Your JavaScript should handle all interactions defined in the UI specification. This includes:
            * Event handling for all interactive elements (buttons, forms, custom controls).
            * DOM manipulation to dynamically update content or UI states (e.g., showing/hiding elements, updating text, adding/removing list items). Use mock data based on placeholder suggestions if real data interaction isn't applicable for a static demo.
            * Client-side form validation (e.g., for required fields, email formats, password strength) with clear, non-intrusive visual feedback (e.g., changing border colors, displaying small error messages near fields).
            * Orchestrating or triggering CSS animations/transitions based on user events or application state.
            * If the UI involves multiple views or states within a single page, manage these transitions smoothly.
        * JavaScript should be clean, efficient, well-commented for complex logic, and follow modern ECMAScript standards (ES6+). Structure your JS logically, perhaps using an IIFE or a simple module pattern for encapsulation if appropriate for complexity.

3.  **Content Placeholders (CRITICAL FOR RICHNESS AND REALISM):**
    * When using placeholder text or data, make it **highly contextually relevant to the chapter's function, the UI specification, and the overall application's domain. It must be rich in detail, varied, and realistic** to give an accurate impression of a populated application, not just "Lorem ipsum" or generic "Item 1."
    * For example, if the UI spec mentions a task list, create 3-5 distinct placeholder tasks with plausible titles (e.g., "Finalize Q3 marketing strategy document & stakeholder review", "Develop new user onboarding interactive tutorial (Phase 1)", "Conduct A/B testing for homepage CTA conversion funnel"), detailed multi-sentence descriptions, realistic due dates (e.g., "Due: October 26, 2025"), statuses (e.g., "In Progress", "Completed", "Pending Review"), and assigned users (e.g., "Dr. Eleanor Vance", "Mr. Samuel Green", "AI Assistant").
    * The goal is for the UI to look "lived-in," fully functional, and visually complete, showcasing the design with data that makes sense.

4.  **Logo/Branding Elements (if applicable from UI Specification or implied context):**
    * If a header or logo area is part of the UI spec: Use a **simple, elegant text-based placeholder** for the brand name (e.g., "AppModule" or derived from chapter title like "TaskFlow" if chapter is "Task Management"). Style this text logo thoughtfully using CSS (consider a distinct modern font, appropriate weight, color, and letter spacing for a sophisticated mark – e.g., \`font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 1.5rem;\`).
    * Alternatively, a **minimalist, modern, abstract vector icon** (implementable with simple inline SVG like \`<svg width="32" height="32" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0B57D0"/></svg>\` or carefully crafted CSS shapes/borders) can be used if it fits the overall elegant aesthetic. Do NOT use external image files or complex graphics.

5.  **User Experience (UX) Excellence:**
    * The interface must be highly intuitive, with clear navigation (if applicable), logical flow, and readily apparent calls to action.
    * Prioritize accessibility: Use semantic HTML (nav, main, aside, article, section, header, footer). Ensure all interactive elements are keyboard accessible and have focus indicators. Provide sufficient color contrast as per WCAG AA guidelines. Use ARIA attributes (e.g., \`aria-label\`, \`aria-describedby\`, roles) to enhance semantics for assistive technologies, especially for custom components.

6.  **Responsiveness:**
    * The frontend MUST be **fully responsive and flawlessly adapt** to desktop, tablet, and mobile displays (e.g., screen widths like 360px, 768px, 1024px, 1440px), maintaining its beauty, elegance, and functionality, using CSS media queries. Layouts should reflow intelligently.

7.  **Output Format - CRITICAL:**
    * **CODE ONLY:** Your entire response MUST consist *only* of the generated frontend code (HTML, CSS, JavaScript).
    * The primary output should be a single HTML structure. CSS should be included within a \`<style>\` tag in the \`<head>\`, and JavaScript should be included within a \`<script>\` tag before the closing \`</body>\` tag.
    * **Example Structure (Illustrative - your content will be much richer):**
        \`\`\`html
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${chapterTitle} Interface</title>
            <style>
                :root {
                    --primary-color: #0B57D0;
                    --text-primary-color: #1F2937;
                }
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #F8F9FA;
                    color: var(--text-primary-color);
                    line-height: 1.6;
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }
                .container {
                    width: 90%;
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 2rem;
                    background-color: #FFFFFF;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 10px 20px rgba(0,0,0,0.07);
                }
                h1, h2, h3 { color: var(--primary-color); }
                button {
                    padding: 0.75rem 1.5rem;
                    font-size: 1rem;
                    font-weight: 500;
                    color: white;
                    background-color: var(--primary-color);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background-color 0.2s ease-in-out, transform 0.1s ease;
                }
                button:hover { background-color: #0A50A0; }
                button:active { transform: scale(0.98); }
            </style>
        </head>
        <body>
            <div class="app-wrapper"> <header class="app-header">
                    </header>
                <main class="app-main container">
                    <h1>${chapterTitle} Interface</h1>
                    </main>
                <footer class="app-footer">
                    <p>&copy; 2025 ApplicationName. Chapter: ${chapterTitle}.</p>
                </footer>
            </div>

            <script>
                (function() {
                    'use strict';

                    document.addEventListener('DOMContentLoaded', () => {
                    });

                })();
            </script>
        </body>
        </html>
        \`\`\`
    * Absolutely NO introductory phrases, explanations, apologies, self-reflections, or concluding remarks outside of code comments.
    * **CRUCIAL: Output RAW CODE ONLY.** Do NOT wrap the HTML output in Markdown code fences like \`\`\`html ... \`\`\`. The output should be the direct HTML content with embedded CSS and JS.
`;
    },

    constructProjectStructurePrompt: function(fullGeneratedCode, programmingLanguage, chapterTitles) {
        const chapterTitlesList = chapterTitles.map(t => `- ${t}`).join('\n');
        return `
You are an expert Software Architect with extensive experience in designing scalable and maintainable project structures for **${programmingLanguage}** applications, potentially including web frontends (HTML, CSS, JavaScript). You have been provided with a complete codebase for an application, possibly composed of several modules or functional areas, including backend and frontend code. Your task is to analyze this codebase and propose an optimal, conventional directory and file structure **for the application code only**.

**Target Programming Language (for backend):** **${programmingLanguage}**
(Frontend code will be standard HTML, CSS, JavaScript)

**Full Application Codebase:**
\`\`\`${programmingLanguage.toLowerCase()}
${fullGeneratedCode}
\`\`\`

**Original Main Modules/Chapter Titles (for high-level functional grouping reference):**
${chapterTitlesList || "No specific module list provided; infer from code."}

**Instructions:**

1.  **Analyze Codebase:** Thoroughly review the provided "**Full Application Codebase**" to understand its components, modules, classes, functions, interdependencies, and their apparent responsibilities. Pay attention to comments like "/* --- Code for module/chapter: ... --- */" or language delineators (e.g., "// Backend Code", "// Frontend Code") which may delineate original functional blocks or code for different tiers (backend/frontend).
2.  **Design Structure:** Based on your analysis and common best practices for **${programmingLanguage}** projects (and associated standard frontend development using HTML, CSS, JS), design a clear, logical, and idiomatic directory and file structure **specifically for the application's source code**.
    * Group related files into appropriately named directories (e.g., \`src/\`, \`app/\`, \`lib/\`, \`components/\`, \`controllers/\`, \`services/\`, \`models/\`, \`utils/\`, \`routes/\`, \`config/\`).
    * **For applications with both backend and frontend components, aim for a standard professional production project structure rather than defaulting to separate top-level \`backend/\` and \`frontend/\` directories.** Frontend assets (HTML, CSS, JS) should typically reside in directories like \`public/\`, \`static/\`, \`client/\`, or \`ui/\`, often within a main application source directory (e.g., \`src/main/resources/static\` for Java Spring, \`app/static/\` for Python Flask/Django, or a \`client/\` directory built into \`public/\` for Node.js with frontend frameworks). The overall structure should be conventional, cohesive, and professional for a **${programmingLanguage}** application that includes a web frontend.
    * **IMPORTANT: Do NOT include directories or files related to testing (e.g., do not create a \`tests/\` directory or files like \`*_test.py\`, \`*.spec.js\`, \`*Tests.cs\`). Focus solely on the application's structure.**
    * Suggest appropriate file names that accurately reflect their content and adhere to common naming conventions for their respective languages (e.g., \`auth_controller.js\`, \`user_service.py\`, \`ProductModel.java\`, \`index.html\`, \`style.css\`, \`app.js\`).
    * Consider a typical project layout that facilitates development and deployment for applications built with **${programmingLanguage}** and a standard web frontend.
3.  **Output Format - CRITICAL:**
    * Present the project structure as a **hierarchical tree** or a clearly indented list. Use standard ASCII characters like \`/\`, \`-\`, \`|\`, \`+\`, and spaces to represent the tree clearly.
    * For each significant file, you MAY add a very brief inline comment (e.g., after some spaces from the filename) indicating its primary purpose. Keep these comments extremely concise.
    * Your entire response MUST BE *only* the project structure description (the tree).
    * Do NOT include any introductory or concluding text, explanations outside the structure itself, or any other prose.
    * Do NOT use Markdown code fences for the structure output itself.

**Example Output (Illustrative for a Python/Flask-like project with an integrated frontend - WITHOUT TESTS):**
my_application/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── auth_routes.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── user_service.py
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   └── app.js
│   │   └── images/
│   ├── templates/
│   │   ├── base.html
│   │   └── index.html
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
├── config/
│   └── settings.py
├── run.py
├── requirements.txt
└── .env.example
`;
    },

    constructFileCodeGenPrompt: function(overallApplicationContext, projectStructureHint, targetFilePath, programmingLanguage) {
        return `
You are a world-class Lead Software Architect and Senior Developer, proficient in multiple languages including **${programmingLanguage}**, HTML, CSS, and JavaScript. Your task is to write the specific code for the file located at the path "**${targetFilePath}**" within a larger application. The frontend code must be written using ONLY standard HTML, CSS, and vanilla JavaScript, and must be rich, detailed, and visually appealing with contextually relevant content.

**Overall Application Context (derived from the entire source document):**
${overallApplicationContext || "No broader application context was extracted. Focus on implementing the file's specific role."}

**Overall Project Structure (Visual Tree):**
\`\`\`
${projectStructureHint || "Project structure not available. Infer based on common practices and file path."}
\`\`\`

**Target File Path:** **${targetFilePath}**
**Primary Backend Programming Language:** **${programmingLanguage}** (Use this as a reference for backend files. For other file types such as HTML, CSS, JavaScript, configuration files, etc., you MUST use the correct language and syntax appropriate for **${targetFilePath}**. Specifically, frontend code must be standard HTML, CSS, and vanilla JavaScript, and should be of high visual and interactive quality, consistent with the detailed UI/UX standards previously established.)

**Your Task & Detailed Instructions:**

1.  **Implement File Content:**
    * Write complete, operational, and elegant code that belongs *exclusively* in the file "**${targetFilePath}**".
    * Determine the file's language and purpose based on its extension and path (e.g., if it's \`user_controller.py\` use Python; if \`index.html\` use HTML; if \`style.css\` use CSS; if \`main.js\` use vanilla JavaScript).
    * Consider the file's name, path, and the overall application context to determine its precise responsibilities.
    * Ensure all necessary imports, includes, package declarations, namespace definitions, HTML doctype, script tags, style tags, etc., required *for this specific file* and its determined language are present at the beginning of the code or in the appropriate sections.
    * Define classes, functions, variables, constants, HTML elements, CSS rules, or other constructs that are appropriate for this file's role and language.
    * **For frontend files (HTML, CSS, JS):**
        * If this is an HTML file, it should be the complete page or a significant, self-contained fragment. It might link to CSS and JS files as per the project structure.
        * If this is a CSS file, it should contain **rich, elegant, presentation-quality styles** relevant to its scope (e.g., global styles, component styles, layout styles). Adhere to the high aesthetic standards, color palettes, and typographic principles established for the application.
        * If this is a vanilla JavaScript file, it should implement **meaningful interactivity, DOM manipulation, or client-side logic** as appropriate for its role (e.g., \`app.js\`, \`utils.js\`, a component-specific JS file).
        * Ensure the output is **substantial, well-styled, and interactive where appropriate**. Use **rich, contextually relevant placeholder content** (not generic "Lorem Ipsum") that makes the UI feel complete and related to the application's purpose, adhering to the high UI/UX standards set for the application.

2.  **Code Quality & Best Practices:**
    * Adhere strictly to idiomatic best practices for the language of "**${targetFilePath}**" (e.g., naming conventions, style, patterns like SOLID/DRY for object-oriented code, proper HTML semantics, efficient CSS selectors, modern vanilla JavaScript features).
    * Write clean, efficient, well-structured, and maintainable code.
    * Include meaningful comments for complex logic or public APIs within this file.
    * Implement necessary error handling and input validation relevant to this file's scope and language.

3.  **Contextual Awareness:**
    * While generating code *only* for "**${targetFilePath}**", be mindful of how it integrates with other parts of the application as implied by the "Overall Application Context" and "Overall Project Structure".
    * For example, if this file defines a class in **${programmingLanguage}** that is used elsewhere, its public interface should be clear. If it's a frontend vanilla JavaScript file making API calls, assume the backend API endpoints (potentially in **${programmingLanguage}**) exist as per the overall design. If it's an HTML file, it must correctly link to CSS or JS files also shown in the project structure (e.g., using relative paths like \`<link rel="stylesheet" href="../css/style.css">\` or \`<script src="../js/app.js"></script>\`).

4.  **Handling Dependencies within the File:**
    * If this file depends on other modules/files within the project structure tree, use correct relative or absolute import/include paths or links standard for its language (e.g., \`#include "../models/user.h"\` in C++, \`from ..services import user_service\` in Python, \`<script src="../utils/helpers.js"></script>\` in HTML). Assume these other files will exist as per the project structure.
    * For external library dependencies (e.g., npm packages for JavaScript if it were allowed for backend, pip packages for Python), ensure import/require statements are correct for the language of this file. **However, for frontend code in HTML/CSS/JS files, avoid introducing external frontend libraries or frameworks.**

5.  **Output Format - CRITICAL:**
    * **CODE ONLY:** Your entire response MUST consist *only* of the generated code for the file "**${targetFilePath}**".
    * Absolutely NO introductory phrases (e.g., "Here's the code for ${targetFilePath}...", "Okay, I've generated..."), explanations, or concluding remarks are allowed outside of code comments.
    * **CRUCIAL: Output RAW CODE ONLY.** Your response must be the pure source code for the file. Do NOT wrap the code in Markdown code fences (e.g., do NOT use \`\`\`python ... \`\`\` or \`\`\`html ... \`\`\` or any other \`\`\` ... \`\`\`). The output will be saved directly as a file, so any such fences will lead to syntax errors or incorrect file content. Just provide the code itself.
`;
    },

    parseProjectStructureToFiles: function(structureText) {
        const files = [];
        const lines = structureText.split('\n');
        const pathStack = [];
        let baseIndent = -1;

        const isLikelyFile = (name) => {
            if (!name || name.endsWith('/')) return false;
            if (/\.[a-zA-Z0-9]+$/.test(name) ||
                ['Makefile', 'Dockerfile', 'LICENSE', 'README', 'Procfile', '.env', '.gitignore', 'config', 'requirements.txt', 'package.json', 'pom.xml', 'build.gradle'].includes(name.split('/').pop())) return true;
            if (pathStack.length > 0 && (pathStack[pathStack.length-1].name === 'bin' || pathStack[pathStack.length-1].name.endsWith('/bin')) && !name.includes('.')) return true;
            if (['.env.example', 'settings'].includes(name) && !name.endsWith('/')) return true;
            return false;
        };

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const indentMatch = line.match(/^(\s*)/);
            const currentIndent = indentMatch ? indentMatch[1].length : 0;

            const namePart = line.replace(/^\s*[│├──└─\s]*/, '');
            const name = namePart.split(/\s+#\s+/)[0].trim();

            if (!name) continue;

            if (baseIndent === -1) {
                baseIndent = currentIndent;
                if (name.endsWith('/') || (!isLikelyFile(name) && name !== '.env.example' && name !== 'Procfile' && name !== 'requirements.txt')) {
                    pathStack.push({ name: name.replace(/\/$/, ''), indent: currentIndent });
                    continue;
                } else {
                    if (isLikelyFile(name) && !files.includes(name)) files.push(name);
                    continue;
                }
            }

            while (pathStack.length > 0 && currentIndent <= pathStack[pathStack.length - 1].indent) {
                pathStack.pop();
            }

            const basePath = pathStack.map(p => p.name).join('/');
            const currentItemName = name.replace(/\/$/, '');
            const currentFullPath = basePath ? `${basePath}/${currentItemName}` : currentItemName;

            if (name.endsWith('/') || !isLikelyFile(currentItemName)) {
                pathStack.push({ name: currentItemName, indent: currentIndent });
            } else {
                if (!files.includes(currentFullPath)) {
                    files.push(currentFullPath);
                }
            }
        }

        const cleanedFiles = files.filter(f => f && f.trim() !== '' && isLikelyFile(f.split('/').pop()));
        return cleanedFiles;
    },

    extractDocumentContent: async function(document, type = 'context') {
        if (!document) return '';
        if (type === 'full_text_for_analysis' && document.content) return document.content;

        if (document.chapters && Array.isArray(document.chapters)) {
            return document.chapters
                .map(chapter => {
                    const texts = [];
                    if (chapter && chapter.title) {
                        texts.push(`Chapter Title: ${chapter.title}`);
                    }
                    if (chapter && Array.isArray(chapter.paragraphs) && chapter.paragraphs.length > 0 && chapter.paragraphs[0].text) {
                        const summary = chapter.paragraphs[0].text;
                        texts.push(`Summary: ${summary.substring(0, 700)}${summary.length > 700 ? '...' : ''}`);
                    }
                    return texts.filter(t => t && t.trim()).join('\n');
                })
                .filter(t => t && t.trim())
                .join('\n\n---\n\n');
        }
        return '';
    },

    runTask: async function () {
        try {
            this.logInfo("Initializing application generation task (v2.1: Integrated Project Structure)...");
            const llmModule = await this.loadModule("llm");
            const documentModule = await this.loadModule("document");
            const path = require('path');

            const { sourceDocumentId, programmingLanguage, targetDocumentTitle } = this.parameters;

            if (!sourceDocumentId) throw new Error("Missing required parameter: sourceDocumentId");
            if (!targetDocumentTitle) throw new Error("Missing required parameter: targetDocumentTitle for the new document");
            if (!programmingLanguage) throw new Error("Missing required parameter: programmingLanguage");

            this.logInfo(`Parameters: sourceDocId=${sourceDocumentId}, lang=${programmingLanguage}, title=${targetDocumentTitle}`);
            this.logProgress(`Loading source document: ${sourceDocumentId}...`);

            let sourceDoc;
            try {
                sourceDoc = await documentModule.getDocument(this.spaceId, sourceDocumentId);
            } catch (docError) {
                this.logError(`Error loading source document ${sourceDocumentId}: ${docError.message}`);
                throw new Error(`Failed to load source document: ${docError.message}`);
            }

            if (!sourceDoc || !sourceDoc.chapters || !Array.isArray(sourceDoc.chapters) || sourceDoc.chapters.length === 0) {
                this.logError(`Source document ${sourceDocumentId} is invalid or has no chapters.`);
                throw new Error(`Source document ${sourceDocumentId} does not contain a valid chapter structure.`);
            }
            this.logInfo(`Source document loaded with ${sourceDoc.chapters.length} chapters.`);

            const overallDocumentContextForChapterCode = await this.extractDocumentContent(sourceDoc, 'context');
            this.logInfo("Overall document context extracted.");

            const stripLLMWrapperLines = (text) => {
                if (!text) return "";
                const lines = text.split('\n');
                if (lines.length <= 1) return text.trim();

                let firstRealLineIndex = 0;
                let lastRealLineIndex = lines.length - 1;

                if (lines[firstRealLineIndex].match(/^```(\w*\s*)$/)) {
                    firstRealLineIndex++;
                }
                if (lastRealLineIndex >= firstRealLineIndex && lines[lastRealLineIndex].match(/^```$/)) {
                    lastRealLineIndex--;
                }

                if (firstRealLineIndex > lastRealLineIndex) return "";

                const commonPhrasesStart = [
                    "here's the code", "sure, here is", "okay, here is", "certainly, here's the",
                    "this code implements", "the code for", "below is the code", "here is the code",
                    "here is the generated code", "here's the generated code for", "this is the code for"
                ];
                const commonPhrasesEnd = [
                    "let me know if", "hope this helps", "if you have any questions", "feel free to ask"
                ];

                if (firstRealLineIndex <= lastRealLineIndex) {
                    const firstContentLineLower = lines[firstRealLineIndex].toLowerCase().trim();
                    if (commonPhrasesStart.some(phrase => firstContentLineLower.startsWith(phrase) && firstContentLineLower.length < phrase.length + 15)) {
                        if (lines[firstRealLineIndex].split(' ').length < 10) {
                            firstRealLineIndex++;
                        }
                    }
                }
                if (lastRealLineIndex >= firstRealLineIndex) {
                    const lastContentLineLower = lines[lastRealLineIndex].toLowerCase().trim();
                    if (commonPhrasesEnd.some(phrase => lastContentLineLower.includes(phrase) && lastContentLineLower.length < phrase.length + 25)) {
                        if (lines[lastRealLineIndex].split(' ').length < 12) {
                            lastRealLineIndex--;
                        }
                    }
                }

                if (firstRealLineIndex <= lastRealLineIndex) {
                    return lines.slice(firstRealLineIndex, lastRealLineIndex + 1).join('\n').trim();
                }
                return "";
            };


            this.logInfo("Generating backend code and UI specifications for each chapter...");
            const allGeneratedCodeSnippets = [];
            const originalChapterTitlesForStructure = [];
            const MIN_EXPECTED_CODE_LENGTH = 20;
            let chapterIndex = 0;

            for (const chapter of sourceDoc.chapters) {
                chapterIndex++;
                const chapterTitle = chapter.title || `Chapter ${chapterIndex}`;
                this.logProgress(`Processing chapter ${chapterIndex}/${sourceDoc.chapters.length}: ${chapterTitle} (Backend & UI Spec)`);
                let originalSummary = chapter.paragraphs?.[0]?.text || "";

                if (!originalSummary) {
                    this.logWarning(`Chapter "${chapterTitle}" has no summary. Skipping code/spec generation for it.`);
                    allGeneratedCodeSnippets.push({ title: chapterTitle, code: `// No functional requirements (summary) provided for chapter: ${chapterTitle}` });
                    originalChapterTitlesForStructure.push(chapterTitle);
                    continue;
                }
                if (chapterTitle === "MermaidDiagramChapter" || (originalSummary.trim().startsWith("graph") || originalSummary.trim().startsWith("sequenceDiagram") || originalSummary.trim().startsWith("classDiagram") || originalSummary.trim().startsWith("stateDiagram") || originalSummary.trim().startsWith("erDiagram") || originalSummary.trim().startsWith("gantt") || originalSummary.trim().startsWith("pie") || originalSummary.trim().startsWith("flowchart"))) {
                    this.logInfo(`Skipping LLM processing for Mermaid/diagram-like Chapter: ${chapterTitle}. Adding content as comment.`);
                    allGeneratedCodeSnippets.push({ title: chapterTitle, code: `/*\nMermaid Diagram or similar DSL Content for: ${chapterTitle}\n\n${originalSummary}\n*/` });
                    originalChapterTitlesForStructure.push(chapterTitle);
                    continue;
                }

                const backendAndSpecPrompt = this.constructChapterCodeGenPrompt(
                    overallDocumentContextForChapterCode, chapterTitle, originalSummary, programmingLanguage
                );
                let backendCode = `// Backend code generation failed for chapter: ${chapterTitle}`;
                let uiSpecification = "";
                let combinedBackendAndSpecOutput = "";
                let retries = 2;

                while (retries >= 0) {
                    try {
                        this.logInfo(`LLM call for Backend & UI Spec: "${chapterTitle}" (Attempt ${3 - retries}/3)`);
                        const response = await llmModule.generateText(this.spaceId, backendAndSpecPrompt, { max_tokens: 8000 });
                        if (response && response.message && response.message.trim().length >= MIN_EXPECTED_CODE_LENGTH) {
                            combinedBackendAndSpecOutput = response.message;
                            if (!combinedBackendAndSpecOutput.toLowerCase().includes("no code required") &&
                                !combinedBackendAndSpecOutput.toLowerCase().includes("not applicable") &&
                                !combinedBackendAndSpecOutput.toLowerCase().includes("failed to generate")) {
                                this.logInfo(`Backend & UI Spec generated successfully for chapter: "${chapterTitle}" (raw length: ${combinedBackendAndSpecOutput.length})`);
                                break;
                            }
                        }
                        throw new Error("LLM returned an empty, too short, or non-applicable response for backend/UI spec.");
                    } catch (llmError) {
                        retries--;
                        this.logWarning(`LLM call failed for "${chapterTitle}" (Backend/UI Spec): ${llmError.message} (Retries left: ${retries})`);
                        if (retries < 0) {
                            this.logError(`Failed to generate Backend/UI Spec for "${chapterTitle}" after all retries.`);
                            combinedBackendAndSpecOutput = `// Backend code and UI Spec generation failed for chapter: ${chapterTitle}\n// Error: ${llmError.message}`;
                        } else { await new Promise(resolve => setTimeout(resolve, 5000 * (2-retries) )); }
                    }
                }

                const backendStartMarker = `// Backend Code (${programmingLanguage})`;
                const backendEndMarker = `// --- End Backend Code (${programmingLanguage}) ---`;
                const specStartMarker = `### Functional UI Specification for Frontend ###`;

                let backendStartIndex = combinedBackendAndSpecOutput.indexOf(backendStartMarker);
                let backendEndIndex = combinedBackendAndSpecOutput.indexOf(backendEndMarker);
                let specStartIndex = combinedBackendAndSpecOutput.indexOf(specStartMarker);

                if (backendStartIndex !== -1 && backendEndIndex !== -1 && backendEndIndex > backendStartIndex) {
                    backendCode = combinedBackendAndSpecOutput.substring(backendStartIndex, backendEndIndex + backendEndMarker.length).trim();
                    if (specStartIndex !== -1 && specStartIndex > backendEndIndex) {
                        uiSpecification = combinedBackendAndSpecOutput.substring(specStartIndex).trim();
                    } else {
                        uiSpecification = "";
                    }
                } else if (specStartIndex !== -1 && (backendStartIndex === -1 || specStartIndex < backendStartIndex)) {
                    backendCode = `// No distinct backend code block identified for chapter: ${chapterTitle}. UI spec might be present.`;
                    uiSpecification = combinedBackendAndSpecOutput.substring(specStartIndex).trim();
                } else if (backendStartIndex !== -1 && backendEndIndex === -1) {
                    backendCode = combinedBackendAndSpecOutput.substring(backendStartIndex).trim();
                    uiSpecification = "";
                } else {
                    if (combinedBackendAndSpecOutput.trim().startsWith(specStartMarker)){
                        backendCode = `// No backend code block identified for chapter: ${chapterTitle}.`;
                        uiSpecification = combinedBackendAndSpecOutput.trim();
                    } else {
                        backendCode = combinedBackendAndSpecOutput.trim();
                        uiSpecification = "";
                    }
                }
                backendCode = stripLLMWrapperLines(backendCode);
                if (uiSpecification) {
                    const uiSpecContent = uiSpecification.substring(specStartMarker.length).trim();
                    uiSpecification = `${specStartMarker}\n${stripLLMWrapperLines(uiSpecContent)}`;
                    if (stripLLMWrapperLines(uiSpecContent).length < 10) uiSpecification = "";
                }


                let chapterFullCode = backendCode;

                if (uiSpecification && uiSpecification.replace(specStartMarker, '').trim().length > 20) {
                    this.logProgress(`Processing chapter ${chapterIndex}/${sourceDoc.chapters.length}: ${chapterTitle} (Frontend Gen)`);
                    const frontendGenPrompt = this.constructStandaloneFrontendCodeGenPrompt(
                        overallDocumentContextForChapterCode,
                        chapterTitle,
                        originalSummary,
                        uiSpecification,
                        programmingLanguage
                    );
                    let frontendCode = `// Frontend generation failed for chapter: ${chapterTitle}`;
                    let frontendRetries = 2;
                    while (frontendRetries >= 0) {
                        try {
                            this.logInfo(`LLM call for Frontend: "${chapterTitle}" (Attempt ${3 - frontendRetries}/3)`);
                            const frontendResponse = await llmModule.generateText(this.spaceId, frontendGenPrompt, { max_tokens: 8000 });
                            if (frontendResponse && frontendResponse.message && frontendResponse.message.trim().length > 100) {
                                let rawFrontend = frontendResponse.message;
                                frontendCode = stripLLMWrapperLines(rawFrontend);
                                if (!frontendCode && rawFrontend.trim().length > 100) {
                                    this.logWarning(`Stripping all content from frontend response for ${chapterTitle}. Using raw response.`);
                                    frontendCode = rawFrontend.trim();
                                } else if (!frontendCode) {
                                    this.logWarning(`Frontend response for ${chapterTitle} resulted in empty code after stripping. Original was short or non-code.`);
                                    frontendCode = `// Frontend generation for ${chapterTitle} resulted in empty or non-code content.`;
                                }
                                this.logInfo(`Frontend code generated successfully for chapter: "${chapterTitle}" (stripped length: ${frontendCode.length})`);
                                break;
                            }
                            throw new Error("LLM returned an empty or too short response for frontend code.");
                        } catch (frontendLlmError) {
                            frontendRetries--;
                            this.logWarning(`LLM call failed for frontend of "${chapterTitle}": ${frontendLlmError.message} (Retries left: ${frontendRetries})`);
                            if (frontendRetries < 0) {
                                this.logError(`Failed to generate frontend for "${chapterTitle}" after all retries.`);
                                frontendCode = `\n`;
                            } else { await new Promise(resolve => setTimeout(resolve, 5000 * (2-frontendRetries))); }
                        }
                    }
                    chapterFullCode = `/* --- Backend for ${chapterTitle} --- */\n${backendCode}\n\n/* --- UI Specification for ${chapterTitle} --- */\n/*\n${uiSpecification.replace(/\*\*\*/g, '**')}\n*/\n\n/* --- Frontend HTML/CSS/JS for ${chapterTitle} --- */\n${frontendCode}`;
                } else {
                    this.logInfo(`No significant UI specification for chapter: "${chapterTitle}". Skipping dedicated frontend generation.`);
                    if (uiSpecification) {
                        chapterFullCode = `/* --- Backend for ${chapterTitle} --- */\n${backendCode}\n\n/* --- UI Specification (minimal) for ${chapterTitle} --- */\n/*\n${uiSpecification.replace(/\*\*\*/g, '**')}\n*/`;
                    }
                }

                allGeneratedCodeSnippets.push({ title: chapterTitle, code: chapterFullCode });
                originalChapterTitlesForStructure.push(chapterTitle);
            }
            this.logInfo("Backend code, UI specifications, and frontend code (where applicable) generated for all chapters.");

            const fullGeneratedCodeForStructure = allGeneratedCodeSnippets
                .map(s => `\n\n/* === Code for Chapter: ${s.title} === */\n\n${s.code}\n\n/* === End of Code for Chapter: ${s.title} === */`)
                .join("\n\n");

            this.logInfo("Generating project structure tree (application code only)...");
            let projectStructureTreeText = "// Project structure tree generation failed or was not applicable.";
            const treeStructurePrompt = this.constructProjectStructurePrompt(
                fullGeneratedCodeForStructure, programmingLanguage, originalChapterTitlesForStructure
            );
            try {
                this.logInfo("LLM call for project structure tree...");
                const treeResponse = await llmModule.generateText(this.spaceId, treeStructurePrompt, { max_tokens: 3072 });
                if (treeResponse && treeResponse.message && treeResponse.message.trim().length > 10) {
                    projectStructureTreeText = stripLLMWrapperLines(treeResponse.message.trim());
                    if (!projectStructureTreeText || projectStructureTreeText.length < 5) {
                        projectStructureTreeText = treeResponse.message.trim();
                        this.logWarning("Stripping LLM wrappers from project structure resulted in empty content. Using raw tree response.");
                    }
                    this.logInfo("Project structure tree generated successfully.");
                } else {
                    this.logWarning("LLM returned an empty or invalid response for project structure tree.");
                    projectStructureTreeText = "// LLM returned empty or invalid response for project structure tree, or structure is very simple (e.g., single file).";
                }
            } catch (treeError) {
                this.logError(`Error generating project structure tree: ${treeError.message}`);
                projectStructureTreeText = `// Error generating project structure tree: ${treeError.message}`;
            }


            this.logInfo("Parsing project structure tree into file paths...");
            let filePathsToGenerate = [];
            if (projectStructureTreeText && !projectStructureTreeText.startsWith("//") && projectStructureTreeText.includes('/')) {
                try {
                    filePathsToGenerate = this.parseProjectStructureToFiles(projectStructureTreeText);
                    if (!filePathsToGenerate || filePathsToGenerate.length === 0) {
                        this.logWarning("Parsing the structure tree yielded no file paths. Tree was:\n" + projectStructureTreeText + "\nWill attempt to save aggregated code.");
                    } else {
                        this.logInfo(`Successfully parsed ${filePathsToGenerate.length} file paths from tree.`);
                    }
                } catch(parseError) {
                    this.logError(`Error parsing project structure tree: ${parseError.message}. Tree was:\n${projectStructureTreeText}`);
                    filePathsToGenerate = [];
                }
            } else {
                this.logWarning("Skipping parsing because tree structure generation failed, was empty, indicated no structure, or not a tree. Tree:\n" + projectStructureTreeText);
            }

            if (!filePathsToGenerate || filePathsToGenerate.length === 0) {
                let singleFileName = `main.${programmingLanguage.toLowerCase()}`;
                if (programmingLanguage.toLowerCase() === "python") singleFileName = "app.py";
                else if (programmingLanguage.toLowerCase() === "javascript" && fullGeneratedCodeForStructure.toLowerCase().includes("<!doctype html>")) singleFileName = "index.html";
                else if (programmingLanguage.toLowerCase() === "java") singleFileName = "Main.java";

                this.logWarning(`No file paths parsed or structure is flat. Assuming single file output: ${singleFileName} or saving aggregated code.`);
                if (projectStructureTreeText && !projectStructureTreeText.includes('/') && projectStructureTreeText.trim().length > 0 && !projectStructureTreeText.startsWith("//")) {
                    const potentialSingleFile = projectStructureTreeText.trim().split(/\s+/)[0];
                    if (this.parseProjectStructureToFiles(potentialSingleFile).length === 1) {
                        filePathsToGenerate = [potentialSingleFile];
                        this.logInfo(`Interpreted structure as single file: ${potentialSingleFile}`);
                    } else {
                        this.logInfo("Structure was simple but not parsed as a single file. Saving aggregated output.");
                    }
                }
                if (filePathsToGenerate.length === 0) {
                    this.logError("No valid file paths obtained. Saving aggregated code and intermediate results.");
                    const partialDocTitle = `${targetDocumentTitle} (Aggregated Code - Structure Error)`;
                    const partialDocObj = {
                        title: partialDocTitle, type: 'generated_application_aggregated',
                        abstract: JSON.stringify({ generatedAt: new Date().toISOString(), error: "File path parsing failed or structure was flat/not provided. Contains aggregated code.", programmingLanguage: programmingLanguage }, null, 2),
                        metadata: {}
                    };
                    const partialDocId = await documentModule.addDocument(this.spaceId, partialDocObj);
                    const structChapterData = { title: "Project Structure (Parsing Failed, Empty, or Not Applicable)" };
                    const structChapterId = await documentModule.addChapter(this.spaceId, partialDocId, structChapterData);
                    await documentModule.addParagraph(this.spaceId, partialDocId, structChapterId, { text: projectStructureTreeText, commands: {"language": "plaintext"} });

                    const aggregatedCodeChapterData = { title: "Aggregated Code (All Chapters Combined)" };
                    const aggregatedCodeChapterId = await documentModule.addChapter(this.spaceId, partialDocId, aggregatedCodeChapterData);
                    await documentModule.addParagraph(this.spaceId, partialDocId, aggregatedCodeChapterId, { text: fullGeneratedCodeForStructure, commands: { "language": "markdown" } });
                    this.logInfo(`Aggregated code and intermediate results saved to document: ${partialDocTitle} (ID: ${partialDocId})`);
                    throw new Error("Failed to obtain valid file paths from structure tree parsing. Application might be too simple for a complex structure, structure generation failed, or it's a single file. Aggregated code saved.");
                }
            }


            this.logInfo("Generating code for each identified file path...");
            const allGeneratedFileCodes = [];
            for (const filePath of filePathsToGenerate) {
                this.logProgress(`Generating code for file: ${filePath}`);
                const fileCodeGenPrompt = this.constructFileCodeGenPrompt(
                    fullGeneratedCodeForStructure,
                    projectStructureTreeText,
                    filePath,
                    programmingLanguage
                );

                let specificFileCode = `// Code generation failed for file: ${filePath}`;
                let fileRetries = 2;
                while (fileRetries >= 0) {
                    try {
                        this.logInfo(`LLM call for file code: "${filePath}" (Attempt ${3 - fileRetries}/3)`);
                        const response = await llmModule.generateText(this.spaceId, fileCodeGenPrompt, { max_tokens: 8000 });

                        if (response && response.message) {
                            let rawResponse = response.message;
                            specificFileCode = stripLLMWrapperLines(rawResponse);

                            if (!specificFileCode && rawResponse.trim() !== "" && rawResponse.trim().length > 10) {
                                this.logWarning(`Stripping resulted in empty code for ${filePath}, but original response had content. Using original (trimmed).`);
                                specificFileCode = rawResponse.trim();
                            } else if (!specificFileCode && (rawResponse.trim() === "" || rawResponse.trim().length <=10 )) {
                                specificFileCode = `// File intended to be empty or generation yielded no significant content for: ${filePath}`;
                                if (rawResponse.trim() !== "") specificFileCode += `\n// Original trivial response: ${rawResponse.trim()}`;
                            }
                            this.logInfo(`Code processed for file: "${filePath}" (stripped length: ${specificFileCode.length})`);
                            break;
                        }
                        throw new Error("LLM returned an empty or invalid response for file code.");
                    } catch (llmError) {
                        fileRetries--;
                        this.logWarning(`LLM call failed for file "${filePath}" code: ${llmError.message} (Retries left: ${fileRetries})`);
                        if (fileRetries < 0) {
                            this.logError(`Failed to generate code for file "${filePath}" after all retries.`);
                            specificFileCode = `// Code generation failed for file: ${filePath}\n// Error: ${llmError.message}`;
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 5000 * (2-fileRetries) ));
                        }
                    }
                }
                allGeneratedFileCodes.push({ path: filePath, code: specificFileCode });
            }
            this.logInfo("Code generation loop for individual application files completed.");

            this.logInfo("Saving new application document...");
            const newDocumentObject = {
                title: `${targetDocumentTitle} Code`,
                type: 'generated_application_structured',
                abstract: JSON.stringify({
                    generatedAt: new Date().toISOString(),
                    sourceDocumentId: sourceDocumentId,
                    programmingLanguage: programmingLanguage,
                    generationType: "full_application_v2.1_integrated_structure_per_file"
                }, null, 2),
                metadata: {}
            };

            const newDocumentId = await documentModule.addDocument(this.spaceId, newDocumentObject);
            this.logInfo(`New structured document created with ID: ${newDocumentId}`);

            this.logProgress("Adding 'Project Structure' chapter (Tree View)...");
            const structureChapterData = { title: "Project Structure" };
            const structureChapterId = await documentModule.addChapter(this.spaceId, newDocumentId, structureChapterData);
            await documentModule.addParagraph(this.spaceId, newDocumentId, structureChapterId, { text: projectStructureTreeText, commands: {"language": "text"} });

            if (allGeneratedFileCodes.length > 0) {
                this.logProgress(`Adding ${allGeneratedFileCodes.length} file-specific code chapters...`);
                for (const fileCodeData of allGeneratedFileCodes) {
                    this.logProgress(`Adding chapter for file: ${fileCodeData.path}`);
                    const chapterTitleForFile = fileCodeData.path.replace(/\//g, '_');
                    const fileChapterData = { title: `File: ${chapterTitleForFile}` };
                    const fileChapterId = await documentModule.addChapter(this.spaceId, newDocumentId, fileChapterData);

                    let fileExtension = path.extname(fileCodeData.path).substring(1).toLowerCase();
                    let highlightLanguage = programmingLanguage.toLowerCase();

                    const langMap = {
                        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
                        html: 'html', htm: 'html', xml: 'xml', svg: 'xml', xhtml: 'xml',
                        css: 'css', scss: 'scss', sass: 'sass', less: 'less',
                        py: 'python', pyw: 'python',
                        java: 'java',
                        cs: 'csharp',
                        cpp: 'cpp', cxx: 'cpp', cc: 'cpp', h: 'cpp', hpp: 'cpp', hh: 'cpp',
                        c: 'c',
                        json: 'json', yml: 'yaml', yaml: 'yaml',
                        md: 'markdown', markdown: 'markdown',
                        sh: 'bash', zsh: 'bash', bash: 'bash',
                        ps1: 'powershell',
                        rb: 'ruby',
                        go: 'go',
                        php: 'php',
                        swift: 'swift',
                        kt: 'kotlin', kts: 'kotlin',
                        rs: 'rust',
                        conf: 'ini', ini: 'ini', properties: 'ini', cfg: 'ini', toml: 'toml',
                        sql: 'sql',
                        dockerfile: 'dockerfile',
                        gitignore: 'plaintext',
                        env: 'plaintext',
                        gradle: 'groovy',
                        bat: 'batch', cmd: 'batch',
                        vb: 'vbnet',
                        lua: 'lua',
                        perl: 'perl', pl: 'perl',
                        makefile: 'makefile',
                        tf: 'terraform'
                    };
                    if (langMap[fileExtension]) {
                        highlightLanguage = langMap[fileExtension];
                    } else if (fileExtension === '') {
                        const fileNameLower = path.basename(fileCodeData.path).toLowerCase();
                        if (fileNameLower.includes('dockerfile')) highlightLanguage = 'dockerfile';
                        else if (fileNameLower.includes('makefile')) highlightLanguage = 'makefile';
                        else if (fileNameLower.startsWith('.') && fileNameLower.endsWith('ignore')) highlightLanguage = 'plaintext';
                        else if (fileNameLower === 'procfile') highlightLanguage = 'yaml';
                        else if (fileNameLower === 'readme') highlightLanguage = 'markdown';
                        else highlightLanguage = 'plaintext';
                    } else {
                        highlightLanguage = 'plaintext';
                    }
                    const validLanguages = ["plaintext", "python", "javascript", "typescript", "html", "css", "java", "csharp", "cpp", "ruby", "php", "go", "swift", "kotlin", "rust", "scala", "sql", "json", "xml", "yaml", "markdown", "bash", "powershell", "dockerfile", "makefile", "groovy", "scss", "sass", "less", "ini", "toml", "vbnet", "lua", "perl", "diff", "http", "objectivec", "fortran", "r", "dart", "elixir", "erlang", "haskell", "julia", "ocaml", "pascal", "prolog", "scheme", "smalltalk", "text", "ada", "assembly", "clojure", "cobol", "commonlisp", "d", "fsharp", "lisp", "matlab", "perl6", "tcl", "verilog", "vhdl", "apex", "solidity", "systemverilog"];
                    if (!validLanguages.includes(highlightLanguage)) {
                        this.logWarning(`Unsupported highlight language '${highlightLanguage}' for file ${fileCodeData.path}. Defaulting to 'plaintext'.`);
                        highlightLanguage = 'plaintext';
                    }

                    await documentModule.addParagraph(this.spaceId, newDocumentId, fileChapterId, { text: fileCodeData.code, commands: { "language": highlightLanguage } });
                }
                this.logInfo("All file-specific code chapters added.");
            } else {
                this.logWarning("No specific file codes were generated or available to be added as chapters (e.g. structure parsing failed, or it was an aggregated save).");
                const fallbackChapterData = { title: "Aggregated Code (Fallback - No Individual Files Split)" };
                const fallbackChapterId = await documentModule.addChapter(this.spaceId, newDocumentId, fallbackChapterData);
                await documentModule.addParagraph(this.spaceId, newDocumentId, fallbackChapterId, { text: fullGeneratedCodeForStructure, commands: { "language": "markdown" } });
            }

            this.logSuccess("Document generated and saved successfully.");
            return {
                status: 'completed',
                newDocumentId: newDocumentId,
                newDocumentTitle: newDocumentObject.title
            };

        } catch (error) {
            this.logError(`[FINAL CATCH] Error in application generation task: ${error.message} \nStack: ${error.stack}`);
            try {
                const { targetDocumentTitle = "UntitledApp", sourceDocumentId = "N/A", programmingLanguage: lang = "N/A" } = this.parameters || {};
                const errorDocTitle = `${targetDocumentTitle || 'UntitledApp'} - Generation Error`;
                const errorDocObj = {
                    title: errorDocTitle, type: 'generated_application_error',
                    abstract: JSON.stringify({
                        timestamp: new Date().toISOString(), sourceDocumentId: sourceDocumentId,
                        programmingLanguage: lang, errorMessage: error.message,
                        errorStack: error.stack ? error.stack.split('\n').slice(0,20).join('\n') : "No stack available."
                    }, null, 2),
                    metadata: {}
                };
                if (this.loadModule && this.spaceId) {
                    const documentModuleForError = await this.loadModule("document");
                    const errorDocId = await documentModuleForError.addDocument(this.spaceId, errorDocObj);
                    const errorChapterId = await documentModuleForError.addChapter(this.spaceId, errorDocId, { title: "Detailed Error Information" });
                    await documentModuleForError.addParagraph(this.spaceId, errorDocId, errorChapterId, { text: `Error: ${error.message}\n\nStack Trace:\n${error.stack}`});
                    this.logInfo(`Error state document saved with ID: ${errorDocId} and Title: ${errorDocTitle}`);
                    return { status: 'failed', error: { message: error.message, stack: error.stack }, errorDocumentId: errorDocId };
                } else {
                    this.logError("Could not save error document because loadModule or spaceId was unavailable.");
                    return { status: 'failed', error: { message: error.message, stack: error.stack }};
                }
            } catch (saveError) {
                this.logError(`Failed to save error state document: ${saveError.message}`);
                return { status: 'failed', error: { message: error.message, stack: error.stack, saveErrorMessage: saveError.message }};
            }
        }
    },

    cancelTask: async function () {
        this.logWarning("Task cancellation requested.");
        return { status: 'cancelled', message: 'Task was cancelled by user or system.' };
    },
    serialize: async function () {
        return {
            taskType: 'FullApplicationGenerator_V2.1',
            parameters: this.parameters,
        };
    },
    getRelevantInfo: async function () {
        return {
            taskType: 'FullApplicationGenerator_V2.1',
            parameters: this.parameters,
            status: this.status || 'pending',
        };
    }
};