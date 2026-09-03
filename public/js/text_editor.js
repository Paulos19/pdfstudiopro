/* ==========================================================================
   Text Editor Module - In-Place Typographic Replacement and New Text Insertion
   ========================================================================== */

class TextEditor {
    constructor() {
        this.selectedBlock = null;
        this.newTextCoords = null; // for adding text
        this.floatingEditor = document.getElementById('floatingTextEditor');
        this.editTextarea = document.getElementById('editTextarea');
        this.editFontSize = document.getElementById('editFontSize');
        this.editTextColor = document.getElementById('editTextColor');

        this.initEvents();
    }

    initEvents() {
        document.getElementById('btnCloseTextEditor').addEventListener('click', () => this.closeEditor());
        document.getElementById('btnCancelEditText').addEventListener('click', () => this.closeEditor());
        document.getElementById('btnSaveEditText').addEventListener('click', () => this.saveEdit());
    }

    openEditor(block, element) {
        this.selectedBlock = block;
        this.newTextCoords = null;
        
        // Remove previous selection highlight
        document.querySelectorAll('.text-box-item.selected').forEach(el => el.classList.remove('selected'));
        if (element) element.classList.add('selected');

        this.editTextarea.value = block.text;
        this.editFontSize.value = Math.round(block.fontSize || 12);
        this.editTextColor.value = '#000000';

        this.floatingEditor.querySelector('.editor-header span').innerHTML = '<i class="fa-solid fa-font"></i> Editar Texto no PDF';
        this.floatingEditor.style.display = 'block';
        this.editTextarea.focus();
    }

    openNewTextPrompt(pageIndex, x, y, screenX, screenY) {
        this.selectedBlock = null;
        this.newTextCoords = { pageIndex, x, y };

        document.querySelectorAll('.text-box-item.selected').forEach(el => el.classList.remove('selected'));

        this.editTextarea.value = '';
        this.editTextarea.placeholder = 'Digite o novo texto a ser inserido no PDF...';
        this.editFontSize.value = 12;
        this.editTextColor.value = '#000000';

        this.floatingEditor.querySelector('.editor-header span').innerHTML = '<i class="fa-solid fa-square-plus"></i> Inserir Novo Texto';
        this.floatingEditor.style.display = 'block';
        this.editTextarea.focus();
    }

    closeEditor() {
        this.floatingEditor.style.display = 'none';
        this.selectedBlock = null;
        this.newTextCoords = null;
        document.querySelectorAll('.text-box-item.selected').forEach(el => el.classList.remove('selected'));
    }

    async saveEdit() {
        if (!window.App.currentDocId) return;
        const textVal = this.editTextarea.value.trim();
        if (!textVal) {
            window.App.showToast('O texto não pode estar vazio.', 'error');
            return;
        }

        const fontSize = parseFloat(this.editFontSize.value) || 12;
        const color = this.editTextColor.value;

        if (this.newTextCoords) {
            // Adding brand new text at coordinates
            window.App.showToast('Inserindo novo texto no PDF...', 'info');
            try {
                const resp = await fetch(`/api/document/${window.App.currentDocId}/add-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pageIndex: this.newTextCoords.pageIndex,
                        text: textVal,
                        x: this.newTextCoords.x,
                        y: this.newTextCoords.y,
                        fontSize: fontSize,
                        color: color
                    })
                });

                const result = await resp.json();
                if (result.success) {
                    window.App.showToast('Texto inserido no PDF com sucesso!', 'success');
                    this.closeEditor();
                    window.App.reloadCurrentDocument();
                } else {
                    window.App.showToast(result.error || 'Erro ao inserir texto.', 'error');
                }
            } catch (err) {
                window.App.showToast(`Erro de conexão: ${err.message}`, 'error');
            }
        } else if (this.selectedBlock) {
            // Replacing existing text
            window.App.showToast('Atualizando texto no PDF...', 'info');
            try {
                const resp = await fetch(`/api/document/${window.App.currentDocId}/edit-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pageIndex: this.selectedBlock.pageIndex,
                        oldText: this.selectedBlock.text,
                        newText: textVal,
                        pdfX: this.selectedBlock.pdfX,
                        pdfY: this.selectedBlock.pdfY,
                        x: this.selectedBlock.x,
                        y: this.selectedBlock.y,
                        width: this.selectedBlock.width,
                        height: this.selectedBlock.height,
                        fontSize: fontSize,
                        color: color
                    })
                });

                const result = await resp.json();
                if (result.success) {
                    window.App.showToast('Texto atualizado com sucesso!', 'success');
                    this.closeEditor();
                    window.App.reloadCurrentDocument();
                } else {
                    window.App.showToast(result.error || 'Erro ao editar texto.', 'error');
                }
            } catch (err) {
                window.App.showToast(`Erro de conexão: ${err.message}`, 'error');
            }
        }
    }
}

window.TextEditor = new TextEditor();
