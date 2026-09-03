/* ==========================================================================
   PDF Viewer Module - Multi-Page Continuous Rendering & HiDPI Precision
   ========================================================================== */

class PdfViewer {
    constructor() {
        this.pdfDoc = null;
        this.currentDocId = null;
        this.currentPageIndex = 0;
        this.scale = 1.25; // Default crisp zoom
        this.pageTextData = []; // Array of text items per page
        this.inspectionData = null;
    }

    async loadDocument(docId, pdfUrl) {
        this.currentDocId = docId;
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        this.pdfDoc = await loadingTask.promise;

        // Try to fetch C++ low-level Cos inspection
        try {
            const resp = await fetch(`/api/document/${docId}/inspect`);
            const result = await resp.json();
            if (result.success && result.inspection) {
                this.inspectionData = result.inspection;
            }
        } catch (e) {
            console.warn('Inspection fetch failed:', e);
        }

        await this.renderAllPages();
    }

    async renderAllPages() {
        if (!this.pdfDoc) return;
        const dropzone = document.getElementById('welcomeDropzone');
        if (dropzone) dropzone.style.display = 'none';

        const container = document.getElementById('canvasContainer');
        if (container) {
            container.style.display = 'flex';
            container.innerHTML = '';
        }
        this.pageTextData = [];

        const numPages = this.pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pageIndex = pageNum - 1;
            const page = await this.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: this.scale });

            // Create Page Wrapper Container
            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'page-wrapper';
            pageWrapper.id = `pageWrapper_${pageIndex}`;
            pageWrapper.dataset.pageIndex = pageIndex;
            pageWrapper.style.width = `${Math.floor(viewport.width)}px`;
            pageWrapper.style.height = `${Math.floor(viewport.height)}px`;

            // Page Number Indicator Badge
            const pageBadge = document.createElement('div');
            pageBadge.className = 'page-badge';
            pageBadge.textContent = `Página ${pageNum} de ${numPages}`;
            pageWrapper.appendChild(pageBadge);

            // Layer 1: PDF.js Canvas
            const canvas = document.createElement('canvas');
            canvas.id = `pdfCanvas_${pageIndex}`;
            canvas.className = 'pdf-canvas';
            
            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const context = canvas.getContext('2d');
            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            pageWrapper.appendChild(canvas);

            // Layer 2: Interactive SVG Vector Layer
            const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgOverlay.id = `svgOverlay_${pageIndex}`;
            svgOverlay.setAttribute('class', 'svg-overlay');
            svgOverlay.dataset.pageIndex = pageIndex;
            svgOverlay.setAttribute('viewBox', `0 0 ${viewport.width} ${viewport.height}`);
            pageWrapper.appendChild(svgOverlay);

            // Layer 3: Interactive Text Bounding Boxes Overlay
            const textOverlay = document.createElement('div');
            textOverlay.id = `textOverlay_${pageIndex}`;
            textOverlay.className = 'text-overlay';
            textOverlay.dataset.pageIndex = pageIndex;
            pageWrapper.appendChild(textOverlay);

            container.appendChild(pageWrapper);

            // Render PDF pixels on canvas
            await page.render({
                canvasContext: context,
                transform: transform,
                viewport: viewport
            }).promise;

            // Extract all text content directly with PDF.js for 100% universal accuracy
            const textContent = await page.getTextContent();
            this.pageTextData[pageIndex] = textContent.items;

            // Render text bounding boxes on text overlay
            this.renderPageTextOverlay(pageIndex, textContent.items, viewport);

            // Setup annotator events on this page's SVG overlay
            if (window.Annotator) {
                window.Annotator.attachOverlayEvents(svgOverlay, pageIndex);
            }

            // Click listener for page tracking and interactive placement (Signature, Stamp, New Text)
            const handleOverlayClick = (e) => {
                this.currentPageIndex = pageIndex;
                if (window.SignatureStudio && window.SignatureStudio.isPlacingSignature) {
                    e.stopPropagation();
                    const rect = pageWrapper.getBoundingClientRect();
                    const clickX = (e.clientX - rect.left) / this.scale;
                    const clickY = (e.clientY - rect.top) / this.scale;
                    window.SignatureStudio.handlePageClick(pageIndex, clickX, clickY);
                }
            };

            pageWrapper.addEventListener('click', handleOverlayClick);
            svgOverlay.addEventListener('click', handleOverlayClick);
        }
    }

    renderPageTextOverlay(pageIndex, items, viewport) {
        const textOverlay = document.getElementById(`textOverlay_${pageIndex}`);
        if (!textOverlay) return;
        textOverlay.innerHTML = '';

        let blockId = 1;
        items.forEach(item => {
            const str = item.str;
            if (!str || !str.trim()) return;

            // PDF transformation matrix: [scaleX, skewY, skewX, scaleY, tx, ty]
            const tx = item.transform[4];
            const ty = item.transform[5];
            const fontSize = Math.hypot(item.transform[0], item.transform[1]) * this.scale;

            // Convert PDF coordinates (origin bottom-left) to Viewport coordinates (origin top-left)
            const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
            const boxWidth = (item.width * this.scale) || (str.length * fontSize * 0.55);
            const boxHeight = (item.height * this.scale) || (fontSize * 1.2);
            const boxTop = vy - boxHeight;

            const box = document.createElement('div');
            box.className = 'text-box-item';
            box.dataset.pageIndex = pageIndex;
            box.dataset.id = blockId++;
            box.dataset.text = str;
            box.dataset.fontSize = Math.round(fontSize / this.scale);
            box.dataset.x = tx;
            box.dataset.y = (viewport.height / this.scale) - (vy / this.scale);
            box.dataset.width = item.width || (str.length * (fontSize / this.scale) * 0.55);
            box.dataset.height = fontSize / this.scale;

            box.style.left = `${vx}px`;
            box.style.top = `${boxTop}px`;
            box.style.width = `${Math.max(12, boxWidth)}px`;
            box.style.height = `${Math.max(12, boxHeight)}px`;

            box.addEventListener('mouseenter', () => {
                document.getElementById('propPosX').textContent = `${Math.round(tx)} pt`;
                document.getElementById('propPosY').textContent = `${Math.round(box.dataset.y)} pt`;
                document.getElementById('propFont').textContent = item.fontName || 'Helvetica';
                document.getElementById('propSize').textContent = `${box.dataset.fontSize} pt`;
            });

            box.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.App.currentTool === 'edit-text' || window.App.currentTool === 'select') {
                    window.TextEditor.openEditor({
                        pageIndex: pageIndex,
                        text: str,
                        pdfX: tx,
                        pdfY: ty,
                        x: tx,
                        y: parseFloat(box.dataset.y),
                        width: parseFloat(box.dataset.width),
                        height: parseFloat(box.dataset.height),
                        fontSize: parseFloat(box.dataset.fontSize),
                        fontName: item.fontName || 'Helvetica',
                        color: { r: 0.1, g: 0.1, b: 0.1 }
                    }, box);
                } else if (window.App.currentTool === 'redact') {
                    window.Redactor.markBlockForRedaction({
                        id: box.dataset.id,
                        pdfX: tx,
                        pdfY: ty,
                        x: tx,
                        y: parseFloat(box.dataset.y),
                        width: parseFloat(box.dataset.width),
                        height: parseFloat(box.dataset.height),
                        text: str
                    }, pageIndex);
                }
            });

            textOverlay.appendChild(box);
        });

        // Click on page overlay to insert new text if 'add-text' tool is active
        textOverlay.addEventListener('click', (e) => {
            if (window.App.currentTool === 'add-text') {
                const rect = textOverlay.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) / this.scale;
                const clickY = (e.clientY - rect.top) / this.scale;
                window.TextEditor.openNewTextPrompt(pageIndex, clickX, clickY, e.clientX, e.clientY);
            }
        });
    }

    scrollToPage(pageIndex) {
        const pageWrapper = document.getElementById(`pageWrapper_${pageIndex}`);
        if (pageWrapper) {
            pageWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    setScale(newScale) {
        this.scale = Math.max(0.5, Math.min(3.0, newScale));
        document.getElementById('zoomLevelLabel').textContent = `${Math.round(this.scale * 100)}%`;
        this.renderAllPages();
    }

    zoomIn() {
        this.setScale(this.scale + 0.15);
    }

    zoomOut() {
        this.setScale(this.scale - 0.15);
    }

    fitWidth() {
        const viewportWidth = document.getElementById('viewport').clientWidth - 80;
        if (this.pdfDoc) {
            this.pdfDoc.getPage(1).then(page => {
                const vp = page.getViewport({ scale: 1 });
                this.setScale(viewportWidth / vp.width);
            });
        }
    }

    fitPage() {
        const viewportHeight = document.getElementById('viewport').clientHeight - 100;
        if (this.pdfDoc) {
            this.pdfDoc.getPage(1).then(page => {
                const vp = page.getViewport({ scale: 1 });
                this.setScale(viewportHeight / vp.height);
            });
        }
    }
}

window.PdfViewer = new PdfViewer();
