/* ==========================================================================
   Annotator Module - Multi-Page Vector Drawing, Highlights and Shapes
   ========================================================================== */

class Annotator {
    constructor() {
        this.isDrawing = false;
        this.activePageIndex = 0;
        this.currentPath = [];
    }

    attachOverlayEvents(svgOverlay, pageIndex) {
        svgOverlay.addEventListener('mousedown', (e) => this.onMouseDown(e, svgOverlay, pageIndex));
        svgOverlay.addEventListener('mousemove', (e) => this.onMouseMove(e, svgOverlay, pageIndex));
        svgOverlay.addEventListener('mouseup', (e) => this.onMouseUp(e, svgOverlay, pageIndex));
    }

    getRelativeCoords(e, svgOverlay) {
        const rect = svgOverlay.getBoundingClientRect();
        const scale = window.PdfViewer.scale;
        return {
            x: (e.clientX - rect.left) / scale,
            y: (e.clientY - rect.top) / scale,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top
        };
    }

    onMouseDown(e, svgOverlay, pageIndex) {
        const tool = window.App.currentTool;
        if (tool !== 'draw' && tool !== 'highlight' && tool !== 'rect') return;

        this.isDrawing = true;
        this.activePageIndex = pageIndex;
        const coords = this.getRelativeCoords(e, svgOverlay);
        this.currentPath = [coords];

        if (tool === 'draw') {
            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('id', `activeDrawPath_${pageIndex}`);
            pathEl.setAttribute('stroke', '#EF4444');
            pathEl.setAttribute('stroke-width', '3');
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke-linecap', 'round');
            pathEl.setAttribute('stroke-linejoin', 'round');
            pathEl.setAttribute('d', `M ${coords.screenX} ${coords.screenY}`);
            svgOverlay.appendChild(pathEl);
        } else if (tool === 'highlight' || tool === 'rect') {
            const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rectEl.setAttribute('id', `activeShape_${pageIndex}`);
            rectEl.setAttribute('x', coords.screenX);
            rectEl.setAttribute('y', coords.screenY);
            rectEl.setAttribute('width', '1');
            rectEl.setAttribute('height', '1');

            if (tool === 'highlight') {
                rectEl.setAttribute('fill', 'rgba(250, 204, 21, 0.45)');
                rectEl.setAttribute('stroke', 'rgba(234, 179, 8, 0.8)');
            } else {
                rectEl.setAttribute('fill', 'none');
                rectEl.setAttribute('stroke', '#2563EB');
                rectEl.setAttribute('stroke-width', '2');
            }
            svgOverlay.appendChild(rectEl);
        }
    }

    onMouseMove(e, svgOverlay, pageIndex) {
        if (!this.isDrawing || this.activePageIndex !== pageIndex) return;
        const tool = window.App.currentTool;
        const coords = this.getRelativeCoords(e, svgOverlay);

        if (tool === 'draw') {
            this.currentPath.push(coords);
            const pathEl = document.getElementById(`activeDrawPath_${pageIndex}`);
            if (pathEl) {
                const d = this.currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.screenX} ${p.screenY}`).join(' ');
                pathEl.setAttribute('d', d);
            }
        } else if (tool === 'highlight' || tool === 'rect') {
            const rectEl = document.getElementById(`activeShape_${pageIndex}`);
            if (rectEl && this.currentPath.length > 0) {
                const start = this.currentPath[0];
                const x = Math.min(start.screenX, coords.screenX);
                const y = Math.min(start.screenY, coords.screenY);
                const w = Math.abs(coords.screenX - start.screenX);
                const h = Math.abs(coords.screenY - start.screenY);

                rectEl.setAttribute('x', x);
                rectEl.setAttribute('y', y);
                rectEl.setAttribute('width', w);
                rectEl.setAttribute('height', h);
            }
        }
    }

    async onMouseUp(e, svgOverlay, pageIndex) {
        if (!this.isDrawing || this.activePageIndex !== pageIndex) return;
        this.isDrawing = false;
        const tool = window.App.currentTool;
        const coords = this.getRelativeCoords(e, svgOverlay);

        if (tool === 'draw' && this.currentPath.length > 2) {
            await this.saveAnnotation({
                pageIndex: pageIndex,
                type: 'draw',
                pathPoints: this.currentPath.map(p => ({ x: p.x, y: p.y }))
            });
        } else if (tool === 'highlight' || tool === 'rect') {
            const start = this.currentPath[0];
            const x = Math.min(start.x, coords.x);
            const y = Math.min(start.y, coords.y);
            const w = Math.abs(coords.x - start.x);
            const h = Math.abs(coords.y - start.y);

            if (w > 5 && h > 5) {
                await this.saveAnnotation({
                    pageIndex: pageIndex,
                    type: tool === 'highlight' ? 'highlight' : 'rect',
                    x, y, width: w, height: h
                });
            }
        }
    }

    async saveAnnotation(data) {
        if (!window.App.currentDocId) return;
        window.App.showToast('Gravando anotação no PDF...', 'info');

        try {
            const resp = await fetch(`/api/document/${window.App.currentDocId}/annotate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await resp.json();
            if (result.success) {
                window.App.showToast('Anotação gravada com sucesso!', 'success');
                window.App.reloadCurrentDocument();
            } else {
                window.App.showToast(result.error || 'Erro ao gravar anotação.', 'error');
            }
        } catch (err) {
            window.App.showToast(`Erro de rede: ${err.message}`, 'error');
        }
    }
}

window.Annotator = new Annotator();
