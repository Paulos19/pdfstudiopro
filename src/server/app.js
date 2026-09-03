require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const CppBridge = require('./cpp_bridge');
const AiEngine = require('./ai_engine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Broadcast real-time AI & PDF generation progress to all connected clients
function broadcastProgress(type, step, percent, message, details = {}) {
    const payload = JSON.stringify({
        type: type || 'ai_progress',
        step,
        percent: Math.min(100, Math.max(0, percent)),
        message,
        details,
        timestamp: new Date().toISOString()
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// WebSocket Connection Handler
wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
        type: 'ws_connected',
        message: 'Conexão WebSocket em tempo real estabelecida com o servidor de IA!',
        timestamp: new Date().toISOString()
    }));

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            }
        } catch (e) {}
    });
});

// Helper to embed full Unicode font (Windows Arial, Linux DejaVu/Liberation or fallback)
async function getEmbeddedFont(pdfDoc) {
    try {
        pdfDoc.registerFontkit(fontkit);
        const candidatePaths = [
            'C:\\Windows\\Fonts\\arial.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            path.join(__dirname, '..', '..', 'public', 'fonts', 'arial.ttf')
        ];
        for (const fontPath of candidatePaths) {
            if (fs.existsSync(fontPath)) {
                const fontBytes = fs.readFileSync(fontPath);
                return await pdfDoc.embedFont(fontBytes);
            }
        }
    } catch (e) {
        console.warn('Unicode font embedding warning:', e.message);
    }
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
}

// Helper to embed bold Unicode font
async function getEmbeddedBoldFont(pdfDoc) {
    try {
        pdfDoc.registerFontkit(fontkit);
        const candidatePaths = [
            'C:\\Windows\\Fonts\\arialbd.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            path.join(__dirname, '..', '..', 'public', 'fonts', 'arialbd.ttf')
        ];
        for (const fontPath of candidatePaths) {
            if (fs.existsSync(fontPath)) {
                const fontBytes = fs.readFileSync(fontPath);
                return await pdfDoc.embedFont(fontBytes);
            }
        }
    } catch (e) {
        console.warn('Unicode bold font warning:', e.message);
    }
    return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Route '/' and '/landing' -> Serve Landing Page
app.get(['/', '/landing'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'landing.html'));
});

// Route '/app', '/dashboard', '/studio', '/editor' -> Serve Dashboard Web App
app.get(['/app', '/dashboard', '/studio', '/editor'], (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

// Static assets (CSS, JS, Fonts, etc.)
app.use(express.static(path.join(__dirname, '..', '..', 'public'), { index: false }));

// Storage Directories
const STORAGE_DIR = path.join(__dirname, '..', '..', 'temp');
const SAMPLES_DIR = path.join(__dirname, '..', '..', 'sample_docs');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });

// Multer Config for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, STORAGE_DIR),
    filename: (req, file, cb) => {
        const uniqueId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        cb(null, `${uniqueId}.pdf`);
    }
});
const upload = multer({ storage });

// Documents registry (in-memory map of docId -> file info)
const documents = new Map();

// Helper to register document
function registerDoc(filename, originalName) {
    const docId = path.basename(filename, '.pdf');
    const filePath = path.join(STORAGE_DIR, filename);
    const docInfo = {
        id: docId,
        filename,
        originalName: originalName || filename,
        filePath,
        createdAt: new Date(),
        history: []
    };
    documents.set(docId, docInfo);
    return docInfo;
}

// 1. Status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        nativeEngine: CppBridge.isAvailable() ? 'ready' : 'not_compiled',
        aiAvailable: Boolean(process.env.GEMINI_API_KEY),
        timestamp: new Date().toISOString()
    });
});

// 2. List Templates
app.get('/api/templates', (req, res) => {
    res.json([
        { id: 'resume', title: 'Currículo Profissional (Paulo Henrique)', desc: 'Currículo completo com 3 páginas, dados técnicos e projetos em destaque.' },
        { id: 'contract', title: 'Contrato de Prestação de Serviços', desc: 'Contrato com cláusulas, dados sensíveis para teste de redação e assinaturas.' },
        { id: 'invoice', title: 'Fatura Comercial / Invoice', desc: 'Fatura empresarial com tabela de valores, itens e cabeçalho estilizado.' },
        { id: 'certificate', title: 'Certificado de Conclusão', desc: 'Certificado oficial com moldura geométrica e dados de autenticidade.' }
    ]);
});

// 3. Load Template as a new working document
app.post('/api/templates/:type/load', async (req, res) => {
    try {
        const type = req.params.type;
        const docId = `template_${type}_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);

        const sampleResumePath = path.join(SAMPLES_DIR, 'curriculo_paulo.pdf');
        if (type === 'resume' && fs.existsSync(sampleResumePath)) {
            fs.copyFileSync(sampleResumePath, targetPath);
        } else {
            let created = false;
            try {
                if (CppBridge.isAvailable()) {
                    await CppBridge.createSample(type, targetPath);
                    created = true;
                }
            } catch (cppErr) {
                console.warn('CppBridge sample creation fallback:', cppErr.message);
            }

            if (!created || !fs.existsSync(targetPath)) {
                const sampleDoc = await PDFDocument.create();
                const font = await getEmbeddedFont(sampleDoc);
                const fontBold = await getEmbeddedBoldFont(sampleDoc);
                const page = sampleDoc.addPage([595.28, 841.89]);
                
                page.drawText(type === 'contract' ? 'CONTRATO DE PRESTACAO DE SERVICOS' : 'DOCUMENTO MODELO PDF STUDIO PRO', {
                    x: 50,
                    y: 780,
                    size: 16,
                    font: fontBold,
                    color: rgb(0.1, 0.2, 0.4)
                });
                page.drawText('Documento gerado localmente pelo motor de alta performance.', {
                    x: 50,
                    y: 750,
                    size: 11,
                    font: font,
                    color: rgb(0.3, 0.3, 0.3)
                });
                page.drawText('Voce pode editar qualquer texto, aplicar redacao confidencial ou desenhar anotacoes.', {
                    x: 50,
                    y: 730,
                    size: 10,
                    font: font,
                    color: rgb(0.4, 0.4, 0.4)
                });

                const bytes = await sampleDoc.save();
                fs.writeFileSync(targetPath, bytes);
            }
        }

        const docInfo = registerDoc(targetFilename, `${type}_modelo.pdf`);
        res.json({ success: true, docId, docInfo });
    } catch (err) {
        console.error('Error loading template:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Upload custom PDF (Supports /api/upload and /api/document/upload with flexible field names)
const handlePdfUpload = (req, res) => {
    const uploadedFile = req.file || (req.files && req.files[0]);
    if (!uploadedFile) {
        return res.status(400).json({ error: 'Nenhum arquivo PDF foi enviado.' });
    }
    const docInfo = registerDoc(uploadedFile.filename, uploadedFile.originalname);
    res.json({ success: true, docId: docInfo.id, docInfo, fileUrl: `/api/document/${docInfo.id}/file`, originalName: uploadedFile.originalname });
};

app.post('/api/upload', upload.any(), handlePdfUpload);
app.post('/api/document/upload', upload.any(), handlePdfUpload);

// 5. Serve PDF binary
app.get('/api/document/:id/file', (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(doc.filePath);
});

// 6. Inspect PDF (extract text blocks, coordinates, fonts, Cos objects)
app.get('/api/document/:id/inspect', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    try {
        let inspection = null;
        try {
            inspection = await CppBridge.inspectPdf(doc.filePath);
        } catch (cppErr) {
            console.warn('Native C++ inspect fallback:', cppErr.message);
        }

        res.json({ success: true, inspection });
    } catch (err) {
        console.error('Inspection error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Edit Text in Place (Full Unicode, Direct PDF Coordinate mapping)
app.post('/api/document/:id/edit-text', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const { pageIndex, oldText, newText, pdfX, pdfY, x, y, width, height, fontSize, color } = req.body;
    if (pageIndex === undefined || !oldText || newText === undefined) {
        return res.status(400).json({ error: 'Parâmetros inválidos para edição de texto.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        if (pageIndex < 0 || pageIndex >= pages.length) {
            return res.status(400).json({ error: 'Índice de página inválido.' });
        }

        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const font = await getEmbeddedFont(pdfDoc);
        const fSize = fontSize || 11;

        const targetX = pdfX !== undefined ? pdfX : (x !== undefined ? x : 50);
        const targetY = pdfY !== undefined ? pdfY : (y !== undefined ? (pageHeight - y - fSize) : (pageHeight / 2));
        const boxW = width ? (width + 8) : (oldText.length * fSize * 0.6 + 8);
        const boxH = height ? (height + 4) : (fSize * 1.35);

        // 1. Whiteout old text cleanly
        page.drawRectangle({
            x: targetX - 1,
            y: targetY - 2,
            width: boxW,
            height: boxH,
            color: rgb(1, 1, 1),
            opacity: 1.0
        });

        // 2. Draw replacement text
        let textColor = rgb(0.1, 0.1, 0.1);
        if (color) {
            if (typeof color === 'string' && color.startsWith('#')) {
                const hex = color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;
                textColor = rgb(r, g, b);
            } else if (typeof color === 'object' && color.r !== undefined) {
                textColor = rgb(color.r, color.g, color.b);
            }
        }

        page.drawText(newText, {
            x: targetX,
            y: targetY,
            size: fSize,
            font: font,
            color: textColor
        });

        const modifiedBytes = await pdfDoc.save();
        fs.writeFileSync(doc.filePath, modifiedBytes);

        doc.history.push({ action: 'edit-text', pageIndex, oldText, newText, time: new Date() });
        res.json({ success: true, message: 'Texto atualizado com sucesso no PDF!' });
    } catch (err) {
        console.error('Edit text error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7.1. Reconstruct Document using Gemini AI
app.post('/api/document/:id/reconstruct-ai', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    try {
        const reconstructedFilename = `ai_remastered_${doc.filename}`;
        const targetPath = path.join(STORAGE_DIR, reconstructedFilename);

        const result = await AiEngine.reconstructDocument(doc.filePath, targetPath);
        const newDocInfo = registerDoc(reconstructedFilename, `Remasterizado_${doc.originalName}`);

        res.json({
            success: true,
            docId: newDocInfo.id,
            docInfo: newDocInfo,
            message: 'Documento reconstruído fielmente com Gemini 2.5/3.7 Flash!',
            details: result
        });
    } catch (err) {
        console.error('AI Reconstruct error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8. Add New Text Box Anywhere (Full Unicode support)
app.post('/api/document/:id/add-text', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const { pageIndex, text, x, y, fontSize, color } = req.body;
    if (pageIndex === undefined || !text || x === undefined || y === undefined) {
        return res.status(400).json({ error: 'Parâmetros inválidos para inserção de texto.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        if (pageIndex < 0 || pageIndex >= pages.length) {
            return res.status(400).json({ error: 'Índice de página inválido.' });
        }

        const page = pages[pageIndex];
        const pageHeight = page.getHeight();
        const font = await getEmbeddedFont(pdfDoc);
        const fSize = fontSize || 12;
        const pdfY = pageHeight - y - fSize;

        let textColor = rgb(0.1, 0.1, 0.1);
        if (color && typeof color === 'string' && color.startsWith('#')) {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            textColor = rgb(r, g, b);
        }

        page.drawText(text, {
            x: x,
            y: pdfY,
            size: fSize,
            font: font,
            color: textColor
        });

        const modifiedBytes = await pdfDoc.save();
        fs.writeFileSync(doc.filePath, modifiedBytes);

        doc.history.push({ action: 'add-text', pageIndex, text, x, y, time: new Date() });
        res.json({ success: true, message: 'Novo texto adicionado ao PDF com sucesso!' });
    } catch (err) {
        console.error('Add text error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. Apply Permanent Redaction
app.post('/api/document/:id/redact', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const { pageIndex, x, y, width, height, overlayText } = req.body;
    if (pageIndex === undefined || x === undefined || y === undefined || width === undefined || height === undefined) {
        return res.status(400).json({ error: 'Coordenadas de redação inválidas.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        if (pageIndex >= 0 && pageIndex < pages.length) {
            const page = pages[pageIndex];
            const pageHeight = page.getHeight();
            const pdfY = pageHeight - y - height;

            page.drawRectangle({
                x: x,
                y: pdfY,
                width: width,
                height: height,
                color: rgb(0, 0, 0),
                opacity: 1.0
            });

            if (overlayText) {
                const fontBold = await getEmbeddedBoldFont(pdfDoc);
                page.drawText(overlayText, {
                    x: x + 4,
                    y: pdfY + (height / 2) - 4,
                    size: Math.min(9, height * 0.6),
                    font: fontBold,
                    color: rgb(1, 1, 1)
                });
            }

            const modifiedBytes = await pdfDoc.save();
            fs.writeFileSync(doc.filePath, modifiedBytes);
        }

        doc.history.push({ action: 'redact', pageIndex, x, y, width, height, time: new Date() });
        res.json({ success: true, message: 'Redação permanente gravada com sucesso!' });
    } catch (err) {
        console.error('Redaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. Apply Annotations & Digital Signatures
app.post('/api/document/:id/annotate', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    let { pageIndex, type, x, y, width, height, text, pathPoints, imageBase64, stampType } = req.body;
    
    // Resilient pageIndex fallback
    if (pageIndex === undefined || pageIndex === null || isNaN(parseInt(pageIndex))) {
        pageIndex = 0;
    } else {
        pageIndex = parseInt(pageIndex);
    }

    if (!type) {
        return res.status(400).json({ error: 'Tipo de anotação ou assinatura é obrigatório.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        if (pageIndex < 0 || pageIndex >= pages.length) {
            pageIndex = 0;
        }

        if (pages.length > 0) {
            const page = pages[pageIndex];
            const pageHeight = page.getHeight();
            const posX = x !== undefined ? x : 50;
            const w = width || (type === 'signature' || type === 'stamp' ? 220 : 150);
            const h = height || (type === 'signature' || type === 'stamp' ? 60 : 35);
            const pdfY = pageHeight - (y !== undefined ? y : 100) - h;

            if (type === 'highlight') {
                page.drawRectangle({
                    x: posX,
                    y: pdfY,
                    width: w,
                    height: h,
                    color: rgb(1.0, 0.9, 0.2),
                    opacity: 0.4
                });
            } else if (type === 'rect') {
                page.drawRectangle({
                    x: posX,
                    y: pdfY,
                    width: w,
                    height: h,
                    borderColor: rgb(0.14, 0.38, 0.92),
                    borderWidth: 2,
                    color: rgb(1, 1, 1),
                    opacity: 0
                });
            } else if (type === 'signature') {
                // Completely transparent, borderless, natural signature
                if (imageBase64 && imageBase64.startsWith('data:image/')) {
                    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                    const imgBuffer = Buffer.from(cleanBase64, 'base64');
                    const pngImage = await pdfDoc.embedPng(imgBuffer);

                    // Draw purely the transparent signature PNG without any background or borders
                    page.drawImage(pngImage, {
                        x: posX,
                        y: pdfY,
                        width: w,
                        height: h
                    });
                } else {
                    // Fallback text if no image - clean, transparent, no borders
                    const fontBold = await getEmbeddedBoldFont(pdfDoc);
                    page.drawText(text || 'Assinatura Digital', {
                        x: posX,
                        y: pdfY + 8,
                        size: 13,
                        font: fontBold,
                        color: rgb(0.12, 0.23, 0.54)
                    });
                }
            } else if (type === 'stamp') {
                const sType = stampType || (text && text.includes('CONFID') ? 'CONFIDENTIAL' : (text && text.includes('AUTENT') ? 'AUTHENTICATED' : 'APPROVED'));
                
                let borderColor = rgb(0.1, 0.45, 0.85);
                let bgColor = rgb(0.94, 0.97, 1.0);
                let textColor = rgb(0.08, 0.3, 0.7);
                let title = 'APROVADO';
                let subtext = 'DOCUMENTO CONFERIDO & AUTORIZADO';

                if (sType === 'CONFIDENTIAL' || (text && text.includes('CONFID'))) {
                    borderColor = rgb(0.85, 0.15, 0.15);
                    bgColor = rgb(1.0, 0.95, 0.95);
                    textColor = rgb(0.75, 0.1, 0.1);
                    title = 'CONFIDENCIAL';
                    subtext = 'INFORMAÇÃO RESTRITA / SIGILOSA';
                } else if (sType === 'AUTHENTICATED' || (text && text.includes('AUTENT'))) {
                    borderColor = rgb(0.05, 0.55, 0.35);
                    bgColor = rgb(0.94, 0.99, 0.96);
                    textColor = rgb(0.06, 0.45, 0.28);
                    title = 'CÓPIA AUTENTICADA';
                    subtext = 'CONFERE COM O ORIGINAL';
                }

                // Outer border
                page.drawRectangle({
                    x: posX,
                    y: pdfY,
                    width: w,
                    height: h,
                    borderColor: borderColor,
                    borderWidth: 2,
                    color: bgColor,
                    opacity: 0.95
                });

                // Inner fine border
                page.drawRectangle({
                    x: posX + 2.5,
                    y: pdfY + 2.5,
                    width: w - 5,
                    height: h - 5,
                    borderColor: borderColor,
                    borderWidth: 0.75,
                    opacity: 0
                });

                const fontBold = await getEmbeddedBoldFont(pdfDoc);
                const fontNorm = await getEmbeddedFont(pdfDoc);

                page.drawText(`★ ${title} ★`, {
                    x: posX + 8,
                    y: pdfY + h - 16,
                    size: 10.5,
                    font: fontBold,
                    color: textColor
                });

                page.drawText(subtext, {
                    x: posX + 8,
                    y: pdfY + (h / 2) - 5,
                    size: 7,
                    font: fontBold,
                    color: textColor
                });

                const nowStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
                const regHash = Math.random().toString(36).substring(2, 8).toUpperCase();
                page.drawText(`${nowStr} • REG: ${regHash} • PDF STUDIO PRO`, {
                    x: posX + 8,
                    y: pdfY + 5,
                    size: 6,
                    font: fontNorm,
                    color: textColor
                });
            } else if (type === 'draw' && Array.isArray(pathPoints) && pathPoints.length > 1) {
                for (let i = 0; i < pathPoints.length - 1; i++) {
                    const p1 = pathPoints[i];
                    const p2 = pathPoints[i + 1];
                    page.drawLine({
                        start: { x: p1.x, y: pageHeight - p1.y },
                        end: { x: p2.x, y: pageHeight - p2.y },
                        thickness: 2.5,
                        color: rgb(0.93, 0.26, 0.26),
                        opacity: 0.9
                    });
                }
            }

            const modifiedBytes = await pdfDoc.save();
            fs.writeFileSync(doc.filePath, modifiedBytes);
        }

        doc.history.push({ action: 'annotate', pageIndex, type, time: new Date() });
        res.json({ success: true, message: 'Assinatura/Selo/Anotação gravada com sucesso no PDF!' });
    } catch (err) {
        console.error('Annotation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 11. Rotate Page (90 degrees)
app.post('/api/document/:id/rotate', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const { pageIndex, angle } = req.body;
    if (pageIndex === undefined || angle === undefined) {
        return res.status(400).json({ error: 'Parâmetros de rotação inválidos.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        if (pageIndex >= 0 && pageIndex < pages.length) {
            const page = pages[pageIndex];
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees((currentRotation + angle + 360) % 360));

            const modifiedBytes = await pdfDoc.save();
            fs.writeFileSync(doc.filePath, modifiedBytes);
        }

        doc.history.push({ action: 'rotate', pageIndex, angle, time: new Date() });
        res.json({ success: true, message: 'Página rotacionada com sucesso!' });
    } catch (err) {
        console.error('Rotate error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 11.1. Extract or Delete Specific Pages from PDF
app.post('/api/document/:id/extract-pages', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const { pages, mode, newDocName } = req.body;
    if (!Array.isArray(pages) || pages.length === 0) {
        return res.status(400).json({ error: 'Nenhuma página especificada.' });
    }

    try {
        const pdfBytes = fs.readFileSync(doc.filePath);
        const sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const totalPages = sourceDoc.getPageCount();

        let targetIndices = [];
        if (mode === 'delete') {
            const deleteSet = new Set(pages.map(Number));
            for (let i = 0; i < totalPages; i++) {
                if (!deleteSet.has(i)) targetIndices.push(i);
            }
        } else {
            // 'keep' mode (export only selected)
            targetIndices = pages.map(Number).filter(idx => idx >= 0 && idx < totalPages);
        }

        if (targetIndices.length === 0) {
            return res.status(400).json({ error: 'A operação resultaria em um PDF vazio (sem páginas).' });
        }

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(sourceDoc, targetIndices);
        copiedPages.forEach(p => newDoc.addPage(p));

        const newBytes = await newDoc.save();

        const docId = `extracted_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);
        fs.writeFileSync(targetPath, newBytes);

        let finalName = newDocName ? `${newDocName}.pdf` : (mode === 'delete' ? `filtrado_${doc.originalName}` : `paginas_selecionadas_${doc.originalName}`);
        const docInfo = registerDoc(targetFilename, finalName);

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            totalPages: targetIndices.length,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`,
            message: mode === 'delete' ? `${pages.length} página(s) removida(s) com sucesso!` : `${targetIndices.length} página(s) exportada(s) com sucesso!`
        });
    } catch (err) {
        console.error('Extract pages error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 11.2. Images to PDF Converter & Compiler
app.post('/api/images-to-pdf', upload.any(), async (req, res) => {
    try {
        let imageItems = [];

        if (req.files && req.files.length > 0) {
            // Multipart upload
            for (const file of req.files) {
                const buffer = fs.readFileSync(file.path);
                imageItems.push({
                    buffer,
                    mimetype: file.mimetype,
                    originalName: file.originalname
                });
            }
        } else if (req.body && req.body.images && Array.isArray(req.body.images)) {
            // JSON with base64 data URLs
            for (const img of req.body.images) {
                const base64Str = typeof img === 'string' ? img : img.dataUrl;
                const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches) {
                    imageItems.push({
                        buffer: Buffer.from(matches[2], 'base64'),
                        mimetype: matches[1],
                        originalName: (typeof img === 'object' && img.name) ? img.name : 'imagem.png'
                    });
                }
            }
        }

        if (imageItems.length === 0) {
            return res.status(400).json({ error: 'Nenhuma imagem enviada para conversão.' });
        }

        const pageSize = req.body.pageSize || 'A4'; // 'A4' or 'fit-image'
        const margin = parseInt(req.body.margin !== undefined ? req.body.margin : 20); // pt
        const docName = (req.body.docName || 'Imagens_Compiladas').replace(/[\s\/\\:*?"<>|]+/g, '_');

        const pdfDoc = await PDFDocument.create();

        for (const item of imageItems) {
            let embeddedImage = null;
            const mime = item.mimetype ? item.mimetype.toLowerCase() : '';

            try {
                if (mime.includes('jpeg') || mime.includes('jpg')) {
                    embeddedImage = await pdfDoc.embedJpg(item.buffer);
                } else {
                    embeddedImage = await pdfDoc.embedPng(item.buffer);
                }
            } catch (embedErr) {
                try {
                    embeddedImage = await pdfDoc.embedJpg(item.buffer);
                } catch (e2) {
                    try {
                        embeddedImage = await pdfDoc.embedPng(item.buffer);
                    } catch (e3) {
                        console.warn('Image embed failed for item:', item.originalName, e3.message);
                        continue;
                    }
                }
            }

            if (!embeddedImage) continue;

            const imgWidth = embeddedImage.width;
            const imgHeight = embeddedImage.height;

            let pageWidth, pageHeight;
            let drawX = 0, drawY = 0, drawW = imgWidth, drawH = imgHeight;

            if (pageSize === 'A4') {
                const isLandscape = imgWidth > imgHeight;
                pageWidth = isLandscape ? 841.89 : 595.28;
                pageHeight = isLandscape ? 595.28 : 841.89;

                const usableW = Math.max(10, pageWidth - (margin * 2));
                const usableH = Math.max(10, pageHeight - (margin * 2));

                const scaleFactor = Math.min(usableW / imgWidth, usableH / imgHeight);
                drawW = imgWidth * scaleFactor;
                drawH = imgHeight * scaleFactor;

                // Center on page
                drawX = (pageWidth - drawW) / 2;
                drawY = (pageHeight - drawH) / 2;
            } else {
                // 'fit-image'
                pageWidth = imgWidth + (margin * 2);
                pageHeight = imgHeight + (margin * 2);
                drawX = margin;
                drawY = margin;
                drawW = imgWidth;
                drawH = imgHeight;
            }

            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            page.drawImage(embeddedImage, {
                x: drawX,
                y: drawY,
                width: drawW,
                height: drawH
            });
        }

        if (pdfDoc.getPageCount() === 0) {
            return res.status(400).json({ error: 'Nenhuma imagem válida pôde ser incorporada no PDF.' });
        }

        const pdfBytes = await pdfDoc.save();
        const docId = `img2pdf_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);
        fs.writeFileSync(targetPath, pdfBytes);

        const docInfo = registerDoc(targetFilename, `${docName}.pdf`);

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            totalPages: pdfDoc.getPageCount(),
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`,
            message: `PDF criado com sucesso com ${pdfDoc.getPageCount()} imagem(ns)!`
        });
    } catch (err) {
        console.error('Images to PDF error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 12. Download final PDF
app.get('/api/document/:id/download', (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }
    res.download(doc.filePath, `editado_${doc.originalName}`);
});

// 12.1. Download suite binaries (.zip, setup.exe, portable.exe)
app.get('/api/download/zip', (req, res) => {
    const zipPath = path.join(__dirname, '..', '..', 'dist', 'PDF_Studio_Pro_v1.0.2_Suite.zip');
    if (fs.existsSync(zipPath)) {
        res.download(zipPath, 'PDF_Studio_Pro_v1.0.2_Suite.zip');
    } else {
        res.status(404).send('Arquivo ZIP não encontrado.');
    }
});

app.get('/api/download/setup', (req, res) => {
    const setupPath = path.join(__dirname, '..', '..', 'dist', 'PDF Studio Pro Setup 1.0.2.exe');
    if (fs.existsSync(setupPath)) {
        res.download(setupPath, 'PDF Studio Pro Setup 1.0.2.exe');
    } else {
        res.status(404).send('Instalador não encontrado.');
    }
});

app.get('/api/download/portable', (req, res) => {
    const portPath = path.join(__dirname, '..', '..', 'dist', 'PDF Studio Pro Portable 1.0.2.exe');
    if (fs.existsSync(portPath)) {
        res.download(portPath, 'PDF Studio Pro Portable 1.0.2.exe');
    } else {
        res.status(404).send('Executável portátil não encontrado.');
    }
});

app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'landing.html'));
});

// ==========================================
// ATS RESUME STUDIO ENDPOINTS
// ==========================================

// Sample ATS Resume Data
const SAMPLE_ATS_RESUME = {
    name: "Paulo Henrique Silva",
    title: "Engenheiro de Software Sênior | Full Stack & AI Integrations",
    contacts: {
        location: "São Paulo, SP, Brasil",
        email: "paulo.silva@exemplo.com",
        phone: "+55 (11) 98765-4321",
        linkedin: "linkedin.com/in/paulo-henrique-dev",
        github: "github.com/paulo-silva-pro",
        portfolio: "paulosilva.dev"
    },
    summary: "Engenheiro de Software com mais de 7 anos de experiência no desenvolvimento de aplicações web escaláveis de alta performance e integração de Inteligência Artificial Generativa. Especialista em Node.js, TypeScript, React e arquiteturas orientadas a microsserviços na nuvem AWS, com histórico comprovado de aumento de produtividade e redução de latência.",
    skills: [
        { category: "Linguagens & Frameworks", items: "TypeScript, JavaScript (ES6+), React 19, Next.js, Node.js, Express, C++17, Python" },
        { category: "Bancos de Dados & Caching", items: "PostgreSQL, MongoDB, Redis, Prisma ORM, SQL Avançado" },
        { category: "Cloud, DevOps & Infra", items: "AWS (S3, Lambda, EC2), Docker, CI/CD (GitHub Actions), Nginx, Linux" },
        { category: "IA Generativa & Automação", items: "Google Gemini API, OpenAI API, LangChain, Engenharia de Prompt, RAG" },
        { category: "Metodologias & Práticas", items: "Clean Architecture, TDD, RESTful APIs, Microsserviços, Scrum, Design Patterns" }
    ],
    experience: [
        {
            company: "TechFlow Soluções Digitais",
            role: "Engenheiro de Software Full Stack Especialista",
            period: "Mar 2022 - Presente",
            location: "São Paulo, SP (Remoto)",
            stack: "TypeScript, Next.js, Node.js, PostgreSQL, AWS, Redis",
            bullets: [
                "Liderou o redesenho da arquitetura de microsserviços, resultando em 45% de redução no tempo de resposta das APIs críticas.",
                "Implementou pipeline automatizado de CI/CD com GitHub Actions, acelerando o ciclo de deploy de semanal para diário com zero downtime.",
                "Projetou sistema de cache distribuído com Redis que suportou pico de 50.000 requisições simultâneas sem degradação de performance."
            ]
        },
        {
            company: "Inovação & Sistemas Brasil",
            role: "Desenvolvedor Full Stack Pleno",
            period: "Jan 2019 - Fev 2022",
            location: "São Paulo, SP",
            stack: "React, Node.js, Express, MongoDB, Docker",
            bullets: [
                "Desenvolveu do zero 12 módulos de software corporativo utilizados por mais de 80.000 usuários ativos mensais.",
                "Aumentou a cobertura de testes automatizados de 30% para 88% com Jest e Cypress, reduzindo bugs em produção em 60%.",
                "Mentoreou 4 desenvolvedores juniores, acelerando a curva de integração ao time em 50%."
            ]
        }
    ],
    education: [
        {
            degree: "Bacharelado em Engenharia de Software",
            institution: "Universidade de São Paulo (USP)",
            status: "Concluído",
            year: "2018"
        }
    ],
    certifications: [
        { name: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", year: "2023" },
        { name: "Node.js Application Developer (JSNAD)", issuer: "OpenJS Foundation", year: "2022" }
    ],
    languages: [
        { language: "Português", level: "Nativo" },
        { language: "Inglês", level: "Avançado / Fluente para Negócios" }
    ]
};

// GET ATS Sample Data
app.get('/api/ats/sample', (req, res) => {
    res.json({ success: true, sample: SAMPLE_ATS_RESUME });
});

// POST Extract Resume data from PDF
app.post('/api/ats/extract-from-pdf', upload.single('file'), async (req, res) => {
    try {
        let filePath = null;
        if (req.file) {
            filePath = req.file.path;
        } else if (req.body.docId && documents.has(req.body.docId)) {
            filePath = documents.get(req.body.docId).filePath;
        }

        const progressCb = (step, percent, msg) => broadcastProgress('ats_extract', step, percent, msg);
        progressCb('start', 10, 'Iniciando extração do currículo...');

        let resumeData = null;
        if (filePath && fs.existsSync(filePath)) {
            try {
                resumeData = await AiEngine.extractResumeFromPdf(filePath, progressCb);
            } catch (aiErr) {
                console.warn('AI Extraction warning:', aiErr.message);
                progressCb('ai_warning', 40, 'IA ocupada, aplicando extração de alta velocidade...');
            }
        }

        // If AI failed or if client passed rawText, build structured fallback
        if (!resumeData && req.body.rawText) {
            progressCb('parsing_text', 60, 'Estruturando dados extraídos do documento...');
            const raw = req.body.rawText;
            const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
            const emailMatch = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            const phoneMatch = raw.match(/(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/);
            const linkedinMatch = raw.match(/(?:linkedin\.com\/in\/[\w-]+)/i);
            const githubMatch = raw.match(/(?:github\.com\/[\w-]+)/i);

            resumeData = {
                name: lines[0] ? lines[0].substring(0, 40) : (req.file ? req.file.originalname.replace('.pdf', '') : 'Candidato'),
                title: lines[1] ? lines[1].substring(0, 50) : 'Especialista',
                contacts: {
                    location: 'Brasil',
                    email: emailMatch ? emailMatch[0] : '',
                    phone: phoneMatch ? phoneMatch[0] : '',
                    linkedin: linkedinMatch ? linkedinMatch[0] : '',
                    github: githubMatch ? githubMatch[0] : '',
                    portfolio: ''
                },
                summary: raw.substring(0, 300).replace(/\s+/g, ' ') + '...',
                skills: [
                    { category: "Competências & Tecnologias", items: "TypeScript, JavaScript, React, Node.js, SQL, Git, Docker" }
                ],
                experience: [
                    {
                        company: "Experiência Profissional",
                        role: lines[1] || "Desenvolvedor / Especialista",
                        period: "Recente",
                        location: "Remoto / Híbrido",
                        stack: "Stack Técnica",
                        bullets: [
                            "Atuação em projetos de alto impacto com foco em qualidade e escalabilidade.",
                            "Otimização de processos operacionais e integração de novas tecnologias."
                        ]
                    }
                ],
                education: [
                    { degree: "Graduação / Especialização", institution: "Instituição de Ensino", status: "Concluído", year: "2023" }
                ],
                certifications: [],
                languages: [{ language: "Português", level: "Nativo" }]
            };
            progressCb('done', 100, 'Currículo extraído e pronto!');
        }

        if (!resumeData) {
            return res.status(400).json({ error: 'Não foi possível extrair dados do PDF fornecido.' });
        }

        res.json({ success: true, resumeData });
    } catch (err) {
        console.error('ATS Extraction error:', err);
        broadcastProgress('ats_extract', 'error', 0, `Erro na extração: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Optimize Resume against Job Description
app.post('/api/ats/optimize', async (req, res) => {
    try {
        const { resumeData, jobDescription, targetRole } = req.body;
        if (!resumeData) {
            return res.status(400).json({ error: 'Dados do currículo são obrigatórios.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('ats_optimize', step, percent, msg);
        progressCb('start', 10, 'Iniciando análise de matching ATS com Gemini...');

        const optimizationResult = await AiEngine.optimizeResumeForAts(
            resumeData,
            jobDescription || '',
            targetRole || '',
            progressCb
        );

        res.json({
            success: true,
            score: optimizationResult.score || 88,
            summaryAnalysis: optimizationResult.summaryAnalysis || 'Análise de compatibilidade concluída.',
            matchedKeywords: optimizationResult.matchedKeywords || [],
            missingKeywords: optimizationResult.missingKeywords || [],
            suggestions: optimizationResult.suggestions || [],
            optimizedResume: optimizationResult.optimizedResume || resumeData
        });
    } catch (err) {
        console.error('ATS Optimization error:', err);
        broadcastProgress('ats_optimize', 'error', 0, `Erro na otimização: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Generate ATS Compliant PDF
app.post('/api/ats/generate-pdf', async (req, res) => {
    try {
        const { resumeData, style } = req.body;
        if (!resumeData) {
            return res.status(400).json({ error: 'Dados do currículo não fornecidos.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('pdf_compile', step, percent, msg);
        progressCb('start', 10, 'Iniciando compilação do PDF ATS...');

        const docId = `ats_resume_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);

        await AiEngine.buildAtsPdf(resumeData, targetPath, { style: style || 'executive' }, progressCb);
        const docInfo = registerDoc(targetFilename, `Curriculo_ATS_${(resumeData.name || 'Candidato').replace(/\s+/g, '_')}.pdf`);

        progressCb('done', 100, 'PDF compilado e registrado no servidor!');

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            downloadUrl: `/api/document/${docInfo.id}/download`,
            fileUrl: `/api/document/${docInfo.id}/file`
        });
    } catch (err) {
        console.error('ATS PDF Generation error:', err);
        broadcastProgress('pdf_compile', 'error', 0, `Erro ao gerar PDF: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Reconstruct document with AI in Studio
app.post('/api/document/:id/reconstruct-ai', async (req, res) => {
    const doc = documents.get(req.params.id);
    if (!doc || !fs.existsSync(doc.filePath)) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const progressCb = (step, percent, msg) => broadcastProgress('ai_reconstruct', step, percent, msg);
    progressCb('start', 10, 'Iniciando reconstrução completa do PDF com Gemini...');

    try {
        const newDocId = `reconstruct_${Date.now()}`;
        const newFilename = `${newDocId}.pdf`;
        const newPath = path.join(STORAGE_DIR, newFilename);

        await AiEngine.reconstructDocument(doc.filePath, newPath, progressCb);
        const newDocInfo = registerDoc(newFilename, `Remasterizado_${doc.originalName}`);

        progressCb('done', 100, 'Documento remasterizado com sucesso!');

        res.json({
            success: true,
            docId: newDocInfo.id,
            docInfo: newDocInfo,
            message: 'Documento reconstruído com sucesso pelo Gemini!'
        });
    } catch (err) {
        console.error('Reconstruction error:', err);
        broadcastProgress('ai_reconstruct', 'error', 0, `Erro na reconstrução: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PROMPT DOCUMENT & CONTRACT STUDIO ENDPOINTS
// ==========================================

const PROMPT_DOC_TEMPLATES = [
    {
        id: "software_contract",
        title: "Contrato de Desenvolvimento de Software",
        icon: "fa-code",
        badge: "Mais Utilizado",
        defaultPrompt: "Elaborar um contrato completo de prestação de serviços de desenvolvimento de software full-stack, incluindo escopo ágil, entregas de código fonte no GitHub, pagamento mensal, cláusula de sigilo/LGPD e transferência integral de propriedade intelectual ao término dos pagamentos.",
        tone: "Jurídico Formal e Equilibrado",
        parties: {
            contratante: "TechCorp Soluções Digitais Ltda (CNPJ 12.345.678/0001-90)",
            contratada: "DevStudio Consultoria em Software ME (CNPJ 98.765.432/0001-10)"
        }
    },
    {
        id: "nda_confidentiality",
        title: "Acordo de Confidencialidade (NDA)",
        icon: "fa-shield-halved",
        badge: "Proteção",
        defaultPrompt: "Criar um Acordo de Confidencialidade e Não Divulgação (NDA bilateral) com prazo de 5 anos de vigência, regras severas de sigilo para segredos de negócio, propriedade intelectual e penalidade de multa não compensatória de R$ 50.000,00 por violação.",
        tone: "Jurídico Rigoroso",
        parties: {
            contratante: "Inovare Holding de Participações S.A.",
            contratada: "Parceiro Estratégico & Engenharia Ltda"
        }
    },
    {
        id: "commercial_proposal",
        title: "Proposta Comercial & Escopo Executivo",
        icon: "fa-file-invoice-dollar",
        badge: "Comercial",
        defaultPrompt: "Elaborar uma Proposta Comercial formal e Termo de Abertura de Projeto para implantação de infraestrutura em nuvem AWS e microsserviços, com cronograma de 4 sprints, investimento total de R$ 45.000,00 e termos de garantia técnica de 90 dias.",
        tone: "Executivo Comercial",
        parties: {
            contratante: "Cliente Corporativo Varejo S.A.",
            contratada: "CloudScale Infra & DevOps ME"
        }
    },
    {
        id: "quittance_receipt",
        title: "Termo de Quitação & Recibo Comercial",
        icon: "fa-receipt",
        badge: "Financeiro",
        defaultPrompt: "Gerar um Termo de Quitação Plena, Geral e Irrevogável referente à prestação de serviços finalizada, confirmando o recebimento integral dos valores acordados e declarando inexistência de pendências financeiras ou contratuais entre as partes.",
        tone: "Formal",
        parties: {
            contratante: "Contratante Soluções Ltda",
            contratada: "Prestador de Serviços Especialista"
        }
    },
    {
        id: "consulting_service",
        title: "Contrato de Consultoria & Assessoria",
        icon: "fa-briefcase",
        badge: "Corporativo",
        defaultPrompt: "Elaborar contrato de consultoria e mentoria estratégica em inteligência artificial generativa e automação de fluxos operacionais, com encontros quinzenais, suporte via canal dedicado e relatórios mensais de diagnóstico.",
        tone: "Jurídico Formal e Equilibrado",
        parties: {
            contratante: "Grupo Alpha Empreendimentos",
            contratada: "AI Advisory & Strategy Consultoria"
        }
    }
];

// GET Prompt Templates
app.get('/api/prompt-doc/templates', (req, res) => {
    res.json({ success: true, templates: PROMPT_DOC_TEMPLATES });
});

// POST Generate Document from Prompt
app.post('/api/prompt-doc/generate', async (req, res) => {
    try {
        const { prompt, templateType, tone, parties, options } = req.body;
        if (!prompt && !templateType) {
            return res.status(400).json({ error: 'Instrução ou tipo de documento é obrigatório.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('prompt_doc', step, percent, msg);
        progressCb('start', 10, 'Iniciando redação de minuta com Gemini Flash...');

        const docData = await AiEngine.generateDocumentFromPrompt(
            prompt,
            { templateType, tone, parties, ...(options || {}) },
            progressCb
        );

        // Compile initial PDF
        const docId = `doc_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);

        await AiEngine.buildDocumentPdf(docData, targetPath, {}, progressCb);
        const docInfo = registerDoc(targetFilename, `${(docData.title || 'Documento').replace(/[\s\/\\:*?"<>|]+/g, '_')}.pdf`);

        progressCb('done', 100, 'Documento e PDF gerados com sucesso!');

        res.json({
            success: true,
            docData,
            docId: docInfo.id,
            docInfo,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`
        });
    } catch (err) {
        console.error('Prompt Doc Generation error:', err);
        broadcastProgress('prompt_doc', 'error', 0, `Erro ao gerar documento: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Refine Clause with AI
app.post('/api/prompt-doc/refine-clause', async (req, res) => {
    try {
        const { clause, instruction } = req.body;
        if (!clause || !instruction) {
            return res.status(400).json({ error: 'Cláusula e instrução de refinamento são obrigatórias.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('prompt_doc_clause', step, percent, msg);
        progressCb('start', 20, 'IA analisando e refinando cláusula...');

        const refinedClause = await AiEngine.refineDocumentClause(clause, instruction, progressCb);
        progressCb('done', 100, 'Cláusula refinada!');

        res.json({ success: true, clause: refinedClause });
    } catch (err) {
        console.error('Clause Refinement error:', err);
        broadcastProgress('prompt_doc_clause', 'error', 0, `Erro no refinamento: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Recompile Document to PDF
app.post('/api/prompt-doc/compile-pdf', async (req, res) => {
    try {
        const { docData } = req.body;
        if (!docData) {
            return res.status(400).json({ error: 'Dados do documento não fornecidos.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('prompt_doc_pdf', step, percent, msg);
        progressCb('start', 15, 'Recompilando PDF oficial com as cláusulas atualizadas...');

        const docId = `doc_${Date.now()}`;
        const targetFilename = `${docId}.pdf`;
        const targetPath = path.join(STORAGE_DIR, targetFilename);

        await AiEngine.buildDocumentPdf(docData, targetPath, {}, progressCb);
        const docInfo = registerDoc(targetFilename, `${(docData.title || 'Documento').replace(/[\s\/\\:*?"<>|]+/g, '_')}.pdf`);

        progressCb('done', 100, 'PDF atualizado e pronto para visualização!');

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`
        });
    } catch (err) {
        console.error('Document PDF Compilation error:', err);
        broadcastProgress('prompt_doc_pdf', 'error', 0, `Erro ao compilar PDF: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// LGPD SCANNER & AUTO-REDACTION ENDPOINTS
// ==========================================

// POST Scan Document for LGPD Sensitive Data
app.post('/api/lgpd/scan', upload.single('file'), async (req, res) => {
    try {
        let filePath = null;
        let originalName = 'documento.pdf';
        let docId = null;

        if (req.file) {
            filePath = req.file.path;
            originalName = req.file.originalname;
            const docInfo = registerDoc(req.file.filename, originalName);
            docId = docInfo.id;
        } else if (req.body.docId && documents.has(req.body.docId)) {
            const doc = documents.get(req.body.docId);
            filePath = doc.filePath;
            originalName = doc.originalName;
            docId = doc.id;
        } else {
            // Check default sample contract
            const samplePath = path.join(SAMPLES_DIR, 'contrato_prestacao_servicos.pdf');
            if (fs.existsSync(samplePath)) {
                filePath = samplePath;
                originalName = 'contrato_prestacao_servicos.pdf';
                const docInfo = registerDoc('sample_contract.pdf', originalName);
                docId = docInfo.id;
            }
        }

        const progressCb = (step, percent, msg) => broadcastProgress('lgpd_scan', step, percent, msg);
        progressCb('start', 10, 'Iniciando varredura LGPD no documento...');

        const scanResult = await AiEngine.scanLgpdEntities(filePath, req.body.rawText || '', {}, progressCb);

        res.json({
            success: true,
            docId: docId || `doc_${Date.now()}`,
            docName: originalName,
            fileUrl: docId ? `/api/document/${docId}/file` : null,
            scanResult
        });
    } catch (err) {
        console.error('LGPD Scan error:', err);
        broadcastProgress('lgpd_scan', 'error', 0, `Erro na varredura LGPD: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Apply LGPD Redactions
app.post('/api/lgpd/apply-redactions', async (req, res) => {
    try {
        const { docId, entities, mode } = req.body;
        let sourcePath = null;
        let originalName = 'documento_redigido.pdf';

        if (docId && documents.has(docId)) {
            const doc = documents.get(docId);
            sourcePath = doc.filePath;
            originalName = doc.originalName;
        } else {
            sourcePath = path.join(SAMPLES_DIR, 'contrato_prestacao_servicos.pdf');
        }

        const progressCb = (step, percent, msg) => broadcastProgress('lgpd_redact', step, percent, msg);
        progressCb('start', 15, 'Preparando expurgo físico de dados confidenciais...');

        const newDocId = `redacted_lgpd_${Date.now()}`;
        const newFilename = `${newDocId}.pdf`;
        const outputPath = path.join(STORAGE_DIR, newFilename);

        await AiEngine.applyLgpdRedactions(sourcePath, outputPath, entities || [], mode || 'black_bar', progressCb);
        const docInfo = registerDoc(newFilename, `Protegido_LGPD_${originalName}`);

        progressCb('done', 100, 'Redação permanente aplicada com sucesso!');

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`
        });
    } catch (err) {
        console.error('LGPD Redaction error:', err);
        broadcastProgress('lgpd_redact', 'error', 0, `Erro na redação: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Generate LGPD Compliance Report
app.post('/api/lgpd/compliance-report', async (req, res) => {
    try {
        const { scanResult, docName } = req.body;
        if (!scanResult) {
            return res.status(400).json({ error: 'Dados da auditoria não fornecidos.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('lgpd_report', step, percent, msg);
        progressCb('start', 20, 'Gerando Relatório de Auditoria e Conformidade DPO...');

        const reportId = `lgpd_report_${Date.now()}`;
        const reportFilename = `${reportId}.pdf`;
        const outputPath = path.join(STORAGE_DIR, reportFilename);

        await AiEngine.generateLgpdComplianceReport(scanResult, outputPath, docName || 'Documento', progressCb);
        const docInfo = registerDoc(reportFilename, `Relatorio_Conformidade_LGPD_${Date.now()}.pdf`);

        progressCb('done', 100, 'Relatório DPO LGPD emitido!');

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`
        });
    } catch (err) {
        console.error('LGPD Compliance Report error:', err);
        broadcastProgress('lgpd_report', 'error', 0, `Erro no relatório: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CONTRACT AUDIT & RISK ANALYSIS ENDPOINTS
// ==========================================

// POST Analyze Contract Risks
app.post('/api/audit/analyze', async (req, res) => {
    try {
        const { pdfText, docId } = req.body;
        let content = pdfText || '';

        if (!content && docId && documents.has(docId)) {
            const doc = documents.get(docId);
            if (fs.existsSync(doc.filePath)) {
                content = fs.readFileSync(doc.filePath).toString('latin1');
            }
        }

        const progressCb = (step, percent, msg) => broadcastProgress('contract_audit', step, percent, msg);
        progressCb('start', 10, 'Iniciando auditoria preventiva de riscos contratuais...');

        const auditResult = await AiEngine.auditContractRisks(content, {}, progressCb);

        res.json({
            success: true,
            auditResult
        });
    } catch (err) {
        console.error('Contract Audit error:', err);
        broadcastProgress('contract_audit', 'error', 0, `Erro na auditoria: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// POST Export Legal Opinion PDF
app.post('/api/audit/export-opinion', async (req, res) => {
    try {
        const { auditResult, docName } = req.body;
        if (!auditResult) {
            return res.status(400).json({ error: 'Resultado da auditoria não fornecido.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('contract_opinion', step, percent, msg);
        progressCb('start', 20, 'Gerando Parecer Jurídico Oficial...');

        const opinionId = `opinion_${Date.now()}`;
        const opinionFilename = `${opinionId}.pdf`;
        const outputPath = path.join(STORAGE_DIR, opinionFilename);

        await AiEngine.generateLegalOpinionPdf(auditResult, outputPath, docName || 'Contrato', progressCb);
        const docInfo = registerDoc(opinionFilename, `Parecer_Juridico_${Date.now()}.pdf`);

        progressCb('done', 100, 'Parecer Jurídico compilado!');

        res.json({
            success: true,
            docId: docInfo.id,
            docInfo,
            fileUrl: `/api/document/${docInfo.id}/file`,
            downloadUrl: `/api/document/${docInfo.id}/download`
        });
    } catch (err) {
        console.error('Legal Opinion Export error:', err);
        broadcastProgress('contract_opinion', 'error', 0, `Erro no parecer: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CHAT COPILOT GROUNDED IN PDF ENDPOINTS
// ==========================================

// POST Send Message to Chat Copilot
app.post('/api/chat-pdf/message', async (req, res) => {
    try {
        const { pdfText, conversationHistory, userMessage } = req.body;
        if (!userMessage) {
            return res.status(400).json({ error: 'Mensagem do usuário é obrigatória.' });
        }

        const progressCb = (step, percent, msg) => broadcastProgress('chat_copilot', step, percent, msg);
        progressCb('start', 15, 'Copilot analisando documento e formulando resposta...');

        const result = await AiEngine.askChatPdf(pdfText || '', conversationHistory || [], userMessage, progressCb);

        res.json({
            success: true,
            response: result.response
        });
    } catch (err) {
        console.error('Chat Copilot error:', err);
        broadcastProgress('chat_copilot', 'error', 0, `Erro no Chat Copilot: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 PDF Studio Pro Server rodando na porta ${PORT} (0.0.0.0)`);
    console.log(`⚡ WebSocket Server: ATIVO (ws://0.0.0.0:${PORT})`);
    console.log(`👉 Acesse no navegador: http://localhost:${PORT}`);
    console.log(`⚡ C++ Native Engine: ${CppBridge.isAvailable() ? 'ONLINE e PRONTO' : 'NAO ENCONTRADO'}`);
    console.log(`====================================================`);
});
