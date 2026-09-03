/* ==========================================================================
   Inspector Module - Low-Level PDF Cos Object Tree & Stream Preflight
   ========================================================================== */

class Inspector {
    constructor() {
        this.treeContainer = document.getElementById('inspectorTree');
        this.initEvents();
    }

    initEvents() {
        document.getElementById('btnRefreshInspector').addEventListener('click', () => {
            if (window.App.currentDocId) this.loadInspection(window.App.currentDocId);
        });
    }

    async loadInspection(docId) {
        this.treeContainer.innerHTML = '<div class="empty-state">Inspecionando árvore de objetos via C++...</div>';

        try {
            const resp = await fetch(`/api/document/${docId}/inspect`);
            const result = await resp.json();

            if (result.success && result.inspection) {
                this.renderTree(result.inspection);
            } else {
                this.treeContainer.innerHTML = '<div class="empty-state">Falha ao ler objetos do PDF.</div>';
            }
        } catch (err) {
            this.treeContainer.innerHTML = `<div class="empty-state">Erro: ${err.message}</div>`;
        }
    }

    renderTree(data) {
        this.treeContainer.innerHTML = '';

        // Summary Header
        const header = document.createElement('div');
        header.className = 'cos-node';
        header.innerHTML = `
            <div><span class="cos-key">Versão PDF:</span> <span class="cos-val">${data.version}</span></div>
            <div><span class="cos-key">Páginas:</span> <span class="cos-val">${data.pageCount}</span></div>
            <div><span class="cos-key">Objetos Indiretos:</span> <span class="cos-val">${data.objectsSummary ? data.objectsSummary.totalObjects : 'N/A'}</span></div>
        `;
        this.treeContainer.appendChild(header);

        // Render Page Details & Text Blocks
        data.pages.forEach(p => {
            const pageNode = document.createElement('div');
            pageNode.className = 'cos-node';
            pageNode.innerHTML = `
                <div><span class="cos-key">Página ${p.pageNumber}:</span> Obj ${p.objNum} (Dimensões: ${p.width}x${p.height} pt, Rotação: ${p.rotation}°)</div>
                <div style="margin-top: 4px;"><span class="cos-key">Blocos de Texto (BT/ET):</span> ${p.textBlocks.length}</div>
            `;
            this.treeContainer.appendChild(pageNode);
        });

        // Object List Tree
        if (data.objectsSummary && data.objectsSummary.objectList) {
            const listTitle = document.createElement('div');
            listTitle.style.margin = '10px 0 4px 0';
            listTitle.style.fontWeight = '700';
            listTitle.style.color = '#94A3B8';
            listTitle.textContent = 'TABELA DE OBJETOS XREF:';
            this.treeContainer.appendChild(listTitle);

            data.objectsSummary.objectList.forEach(obj => {
                const item = document.createElement('div');
                item.className = 'cos-node';
                item.style.fontSize = '10px';
                item.innerHTML = `<span class="cos-key">Objeto ${obj.objNum} ${obj.gen} R</span> | Tipo Interno: <span class="cos-val">${this.getTypeName(obj.type)}</span>`;
                this.treeContainer.appendChild(item);
            });
        }
    }

    getTypeName(typeId) {
        const types = {
            0: "Null", 1: "Boolean", 2: "Number", 3: "String", 4: "HexString",
            5: "Name", 6: "Array", 7: "Dictionary (/Pages, /Font)", 8: "Stream (Content Stream)", 9: "Reference"
        };
        return types[typeId] || "Object";
    }
}

window.Inspector = new Inspector();
