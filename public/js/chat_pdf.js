/* ==========================================================================
   Chat Copilot with PDF Module - PDF Studio Pro
   ========================================================================== */

class ChatPdf {
    constructor() {
        this.conversationHistory = [];
        this.currentDocId = null;
        this.currentDocName = 'contract_modelo.pdf';
        this.scale = 1.05;
        this.pdfDoc = null;
        this.isTyping = false;

        this.initElements();
        this.initEvents();
        this.loadInitialSample();
    }

    initElements() {
        this.messagesContainer = document.getElementById('chatMessagesContainer');
        this.inputMessage = document.getElementById('chatPdfInput');
        this.btnSend = document.getElementById('btnSendChatPdf');
        this.btnClear = document.getElementById('btnClearChatHistory');
        this.docNameLabel = document.getElementById('chatPdfDocName');
        this.previewCanvasContainer = document.getElementById('chatPdfCanvasContainer');
        this.fileInput = document.getElementById('chatFileInput');
        this.btnUpload = document.getElementById('btnChatUploadPdf');
        this.btnAttach = document.getElementById('btnChatAttachFile');
        this.chatPanel = document.querySelector('.chat-left-panel');
    }

    initEvents() {
        if (this.btnSend) {
            this.btnSend.addEventListener('click', () => this.sendMessage());
        }

        if (this.inputMessage) {
            this.inputMessage.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (this.btnClear) {
            this.btnClear.addEventListener('click', () => {
                this.conversationHistory = [];
                if (this.messagesContainer) {
                    this.messagesContainer.innerHTML = `
                        <div class="chat-message-item bot">
                            <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                            <div class="chat-bubble">
                                Olá! Sou o <strong>Copilot de IA</strong> do PDF Studio Pro. Pergunte qualquer coisa sobre o documento aberto ou selecione uma das ações rápidas acima.
                            </div>
                        </div>
                    `;
                }
            });
        }

        // Upload and Attach File Events
        const triggerUpload = () => {
            if (this.fileInput) {
                this.fileInput.value = '';
                this.fileInput.click();
            }
        };

        if (this.btnUpload) {
            this.btnUpload.addEventListener('click', triggerUpload);
        }

        if (this.btnAttach) {
            this.btnAttach.addEventListener('click', triggerUpload);
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    this.uploadPdf(e.target.files[0]);
                }
            });
        }

        // Drag and Drop Support
        if (this.chatPanel) {
            this.chatPanel.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.chatPanel.style.outline = '2px dashed var(--accent-blue)';
                this.chatPanel.style.outlineOffset = '-4px';
            });

            this.chatPanel.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.chatPanel.style.outline = '';
            });

            this.chatPanel.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.chatPanel.style.outline = '';
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                        this.uploadPdf(file);
                    } else {
                        window.App.showToast('Por favor, arraste um arquivo no formato PDF.', 'error');
                    }
                }
            });
        }

        // Quick Action Chips
        document.querySelectorAll('.chat-quick-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const prompt = chip.dataset.prompt;
                if (prompt && this.inputMessage) {
                    this.inputMessage.value = prompt;
                    this.sendMessage();
                }
            });
        });
    }

    async uploadPdf(file) {
        if (!file) return;
        window.App.showToast(`Importando "${file.name}" para análise...`, 'info');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pdf', file);

        try {
            const resp = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await resp.json();
            if (data.success && data.docId) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo?.originalName || data.originalName || file.name;
                if (this.docNameLabel) this.docNameLabel.textContent = this.currentDocName;
                
                const fileUrl = data.fileUrl || `/api/document/${data.docId}/file`;
                await this.renderPdfPreview(fileUrl);

                // Reset conversation with personalized bot intro
                this.conversationHistory = [];
                if (this.messagesContainer) {
                    this.messagesContainer.innerHTML = `
                        <div class="chat-message-item bot">
                            <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
                            <div class="chat-bubble">
                                <div style="font-weight: 700; color: var(--text-primary);"><i class="fa-solid fa-file-pdf" style="color: var(--accent-red); margin-right: 6px;"></i> Documento <strong>${this.escapeHtml(this.currentDocName)}</strong> conectado com sucesso!</div>
                                <p style="margin-top: 6px; font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">O Copilot está ancorado no conteúdo integral deste PDF. Pergunte sobre cláusulas, valores, partes ou use os atalhos rápidos acima para extrair resumos executivos.</p>
                            </div>
                        </div>
                    `;
                }

                window.App.showToast('PDF importado e conectado ao Chat Copilot!', 'success');
            } else {
                window.App.showToast(data.error || 'Erro ao importar PDF.', 'error');
            }
        } catch (e) {
            console.error('Chat upload error:', e);
            window.App.showToast(`Falha no upload: ${e.message}`, 'error');
        }
    }

    async loadInitialSample() {
        try {
            const resp = await fetch('/api/templates/contract/load', { method: 'POST' });
            const data = await resp.json();
            if (data.success) {
                this.currentDocId = data.docId;
                this.currentDocName = data.docInfo.originalName || 'contract_modelo.pdf';
                if (this.docNameLabel) this.docNameLabel.textContent = this.currentDocName;
                await this.renderPdfPreview(`/api/document/${data.docId}/file`);
            }
        } catch (e) {
            console.warn('Could not load initial contract for chat:', e);
        }
    }

    async extractCurrentPdfText() {
        if (!this.pdfDoc) return '';
        let fullText = '';
        try {
            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
        } catch (e) {
            console.warn('Text extraction warning:', e);
        }
        return fullText;
    }

    async sendMessage() {
        const text = this.inputMessage?.value?.trim();
        if (!text || this.isTyping) return;

        this.inputMessage.value = '';
        this.appendMessage('user', text);
        this.conversationHistory.push({ role: 'user', content: text });

        this.isTyping = true;
        const typingEl = this.appendTypingIndicator();

        const realText = await this.extractCurrentPdfText();

        try {
            const resp = await fetch('/api/chat-pdf/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: this.currentDocId,
                    pdfText: realText,
                    conversationHistory: this.conversationHistory,
                    userMessage: text
                })
            });

            const data = await resp.json();
            typingEl.remove();

            if (data.success && data.response) {
                this.appendMessage('bot', data.response);
                this.conversationHistory.push({ role: 'assistant', content: data.response });
            } else {
                this.appendMessage('bot', 'Desculpe, ocorreu um erro ao analisar o documento.');
            }
        } catch (e) {
            typingEl.remove();
            this.appendMessage('bot', `Erro de conexão: ${e.message}`);
        } finally {
            this.isTyping = false;
        }
    }

    appendMessage(sender, text) {
        if (!this.messagesContainer) return;

        const item = document.createElement('div');
        item.className = `chat-message-item ${sender}`;

        const avatarIcon = sender === 'user' ? 'fa-user' : 'fa-robot';
        
        let headerActions = '';
        if (sender === 'bot') {
            headerActions = `
                <div class="chat-bubble-header">
                    <span class="ai-model-tag"><i class="fa-solid fa-bolt"></i> Copilot AI</span>
                    <button type="button" class="btn-copy-bubble" title="Copiar resposta">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="chat-avatar"><i class="fa-solid ${avatarIcon}"></i></div>
            <div class="chat-bubble">
                ${headerActions}
                <div class="chat-bubble-content">${this.formatMarkdown(text)}</div>
            </div>
        `;

        if (sender === 'bot') {
            const btnCopy = item.querySelector('.btn-copy-bubble');
            if (btnCopy) {
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(text);
                    window.App.showToast('Resposta copiada para a área de transferência!', 'success');
                });
            }
        }

        this.messagesContainer.appendChild(item);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    appendTypingIndicator() {
        const item = document.createElement('div');
        item.className = 'chat-message-item bot typing-indicator-item';
        item.innerHTML = `
            <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble" style="display: flex; gap: 6px; align-items: center; padding: 12px 16px;">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">Analisando documento...</span>
            </div>
        `;
        this.messagesContainer.appendChild(item);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        return item;
    }

    formatMarkdown(text) {
        if (!text) return '';
        try {
            if (typeof marked !== 'undefined' && marked.parse) {
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                return marked.parse(text);
            }
        } catch (e) {
            console.warn('Marked parse error, using fallback:', e);
        }

        // Advanced Fallback Parser
        let out = this.escapeHtml(text);
        // Headers
        out = out.replace(/^### (.*$)/gim, '<h4>$1</h4>');
        out = out.replace(/^## (.*$)/gim, '<h3>$1</h3>');
        out = out.replace(/^# (.*$)/gim, '<h2>$1</h2>');
        // Bold
        out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic
        out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Blockquotes
        out = out.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
        // Unordered Lists
        out = out.replace(/^[\*\-] (.*$)/gim, '<li>$1</li>');
        out = out.replace(/(<li>.*<\/li>)/gms, '<ul>$1</ul>');
        // Line breaks
        out = out.replace(/\n/g, '<br>');
        return out;
    }

    async renderPdfPreview(pdfUrl) {
        if (!this.previewCanvasContainer) return;
        this.previewCanvasContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; margin-top: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Renderizando documento...</div>';

        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            this.pdfDoc = await loadingTask.promise;
            this.previewCanvasContainer.innerHTML = '';

            const wrapper = document.getElementById('chatPdfPreviewWrapper');
            const wrapperWidth = wrapper ? wrapper.clientWidth - 48 : 520;
            const samplePage = await this.pdfDoc.getPage(1);
            const unscaledViewport = samplePage.getViewport({ scale: 1.0 });
            const fitScale = Math.min(Math.max(wrapperWidth / unscaledViewport.width, 0.65), 1.15);
            this.scale = fitScale;

            for (let p = 1; p <= this.pdfDoc.numPages; p++) {
                const page = await this.pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale: this.scale });

                const card = document.createElement('div');
                card.className = 'prompt-pdf-preview-card';
                card.style.marginBottom = '18px';

                const canvas = document.createElement('canvas');
                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const ctx = canvas.getContext('2d');
                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                card.appendChild(canvas);
                this.previewCanvasContainer.appendChild(card);

                await page.render({
                    canvasContext: ctx,
                    transform: transform,
                    viewport: viewport
                }).promise;
            }
        } catch (e) {
            console.error('Chat PDF preview error:', e);
            this.previewCanvasContainer.innerHTML = `<div style="color: var(--accent-red); font-size: 12px;">Falha na renderização: ${e.message}</div>`;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.ChatPdf = new ChatPdf();
});
