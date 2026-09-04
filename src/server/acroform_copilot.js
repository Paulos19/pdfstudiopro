const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const AiEngine = require('./ai_engine');

class AcroFormCopilot {
    /**
     * Creates an interactive, official AcroForm sample PDF with rich fields
     */
    static async createSampleAcroFormPdf(outputPath) {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();

        const form = pdfDoc.getForm();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Header Background
        page.drawRectangle({
            x: 0,
            y: height - 90,
            width: width,
            height: 90,
            color: rgb(0.06, 0.09, 0.16)
        });

        // Brand Title
        page.drawText('FORMULÁRIO OFICIAL DE CADASTRO & ADESÃO', {
            x: 40,
            y: height - 42,
            size: 15,
            font: fontBold,
            color: rgb(0.95, 0.98, 1.0)
        });

        page.drawText('PDF Studio Pro • Sistema Inteligente de Formulários Interativos (AcroForms)', {
            x: 40,
            y: height - 60,
            size: 9.5,
            font: font,
            color: rgb(0.4, 0.7, 0.9)
        });

        // Instructions
        page.drawText('Preencha os campos interativos abaixo manualmente ou utilize o Copiloto de IA para preenchimento automático.', {
            x: 40,
            y: height - 110,
            size: 8.5,
            font: font,
            color: rgb(0.3, 0.35, 0.4)
        });

        // Section 1: Dados Pessoais
        page.drawRectangle({
            x: 40,
            y: height - 130,
            width: width - 80,
            height: 18,
            color: rgb(0.92, 0.95, 0.98)
        });
        page.drawText('1. IDENTIFICAÇÃO DO TITULAR', {
            x: 48,
            y: height - 125,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.25, 0.45)
        });

        // Field: Nome Completo
        page.drawText('Nome Completo:', { x: 40, y: height - 150, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const nameField = form.createTextField('nome_completo');
        nameField.setText('');
        nameField.addToPage(page, { x: 40, y: height - 176, width: 320, height: 22 });

        // Field: CPF / CNPJ
        page.drawText('CPF / CNPJ:', { x: 375, y: height - 150, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const cpfField = form.createTextField('cpf_cnpj');
        cpfField.setText('');
        cpfField.addToPage(page, { x: 375, y: height - 176, width: width - 80 - 335, height: 22 });

        // Field: E-mail
        page.drawText('E-mail Principal:', { x: 40, y: height - 204, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const emailField = form.createTextField('email');
        emailField.setText('');
        emailField.addToPage(page, { x: 40, y: height - 230, width: 250, height: 22 });

        // Field: Telefone
        page.drawText('Telefone / WhatsApp:', { x: 305, y: height - 204, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const phoneField = form.createTextField('telefone');
        phoneField.setText('');
        phoneField.addToPage(page, { x: 305, y: height - 230, width: width - 80 - 265, height: 22 });

        // Section 2: Endereço & Localização
        page.drawRectangle({
            x: 40,
            y: height - 265,
            width: width - 80,
            height: 18,
            color: rgb(0.92, 0.95, 0.98)
        });
        page.drawText('2. ENDEREÇO & RESIDÊNCIA', {
            x: 48,
            y: height - 260,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.25, 0.45)
        });

        // Field: Endereço
        page.drawText('Logradouro e Número:', { x: 40, y: height - 285, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const addressField = form.createTextField('endereco');
        addressField.setText('');
        addressField.addToPage(page, { x: 40, y: height - 311, width: 330, height: 22 });

        // Field: CEP
        page.drawText('CEP:', { x: 385, y: height - 285, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const cepField = form.createTextField('cep');
        cepField.setText('');
        cepField.addToPage(page, { x: 385, y: height - 311, width: width - 80 - 345, height: 22 });

        // Field: Cidade / UF
        page.drawText('Cidade / Estado (UF):', { x: 40, y: height - 338, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const cityField = form.createTextField('cidade_uf');
        cityField.setText('');
        cityField.addToPage(page, { x: 40, y: height - 364, width: 250, height: 22 });

        // Field: Nacionalidade
        page.drawText('Nacionalidade / Estado Civil:', { x: 305, y: height - 338, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const statusField = form.createTextField('estado_civil');
        statusField.setText('');
        statusField.addToPage(page, { x: 305, y: height - 364, width: width - 80 - 265, height: 22 });

        // Section 3: Perfil Profissional & Cargo
        page.drawRectangle({
            x: 40,
            y: height - 400,
            width: width - 80,
            height: 18,
            color: rgb(0.92, 0.95, 0.98)
        });
        page.drawText('3. ATUAÇÃO PROFISSIONAL & ENQUADRAMENTO', {
            x: 48,
            y: height - 395,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.25, 0.45)
        });

        // Field: Cargo Desejado
        page.drawText('Cargo / Função Principal:', { x: 40, y: height - 420, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const roleField = form.createTextField('cargo');
        roleField.setText('');
        roleField.addToPage(page, { x: 40, y: height - 446, width: 270, height: 22 });

        // Field: Nível de Experiência (Dropdown)
        page.drawText('Nível de Senioridade:', { x: 325, y: height - 420, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const levelDropdown = form.createDropdown('nivel_senioridade');
        levelDropdown.addOptions(['Júnior', 'Pleno', 'Sênior', 'Especialista / Lead', 'Diretoria / C-Level']);
        levelDropdown.select('Pleno');
        levelDropdown.addToPage(page, { x: 325, y: height - 446, width: width - 80 - 285, height: 22 });

        // Field: Pretensão Salarial
        page.drawText('Pretensão Salarial Mensal (R$):', { x: 40, y: height - 475, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const salaryField = form.createTextField('pretensao_salarial');
        salaryField.setText('');
        salaryField.addToPage(page, { x: 40, y: height - 501, width: 220, height: 22 });

        // Field: Modalidade de Contratação (Dropdown)
        page.drawText('Modalidade Preferencial:', { x: 275, y: height - 475, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const contractDropdown = form.createDropdown('modalidade_contrato');
        contractDropdown.addOptions(['CLT Efetivo', 'PJ (Pessoa Jurídica)', 'Cooperado', 'Estágio / Trainee']);
        contractDropdown.select('PJ (Pessoa Jurídica)');
        contractDropdown.addToPage(page, { x: 275, y: height - 501, width: width - 80 - 235, height: 22 });

        // Section 4: Termos & Declarações (Checkboxes)
        page.drawRectangle({
            x: 40,
            y: height - 540,
            width: width - 80,
            height: 18,
            color: rgb(0.92, 0.95, 0.98)
        });
        page.drawText('4. TERMOS DE ADESÃO & DECLARAÇÕES', {
            x: 48,
            y: height - 535,
            size: 9,
            font: fontBold,
            color: rgb(0.1, 0.25, 0.45)
        });

        // Checkbox 1: Termos LGPD
        const checkLgpd = form.createCheckBox('aceite_lgpd');
        checkLgpd.addToPage(page, { x: 42, y: height - 575, width: 14, height: 14 });
        page.drawText('Declaro ciência e autorizo o tratamento de dados conforme a LGPD (Lei 13.709/2018).', {
            x: 64,
            y: height - 572,
            size: 8,
            font: font,
            color: rgb(0.2, 0.2, 0.2)
        });

        // Checkbox 2: Disponibilidade Imediata
        const checkDisp = form.createCheckBox('disponibilidade_imediata');
        checkDisp.addToPage(page, { x: 42, y: height - 600, width: 14, height: 14 });
        page.drawText('Possuo disponibilidade imediata para início das atividades ou trabalho remoto.', {
            x: 64,
            y: height - 597,
            size: 8,
            font: font,
            color: rgb(0.2, 0.2, 0.2)
        });

        // Checkbox 3: Veracidade das Informações
        const checkVeracidade = form.createCheckBox('veracidade_dados');
        checkVeracidade.addToPage(page, { x: 42, y: height - 625, width: 14, height: 14 });
        page.drawText('Declaro sob as penas da lei que todas as informações prestadas são verdadeiras.', {
            x: 64,
            y: height - 622,
            size: 8,
            font: font,
            color: rgb(0.2, 0.2, 0.2)
        });

        // Observations textarea
        page.drawText('Observações Adicionais / Resumo do Candidato:', { x: 40, y: height - 655, size: 8.5, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
        const obsField = form.createTextField('observacoes');
        obsField.enableMultiline();
        obsField.setText('');
        obsField.addToPage(page, { x: 40, y: height - 730, width: width - 80, height: 65 });

        // Footer Note
        page.drawText('PDF Studio Pro • AcroForm Certified • Assinável Digitalmente (ICP-Brasil PAdES)', {
            x: 40,
            y: 30,
            size: 8,
            font: font,
            color: rgb(0.5, 0.55, 0.6)
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
        return pdfBytes;
    }

    /**
     * Detects all AcroForm interactive fields in any PDF document
     */
    static async detectFields(pdfBytes) {
        try {
            const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const form = pdfDoc.getForm();
            const rawFields = form.getFields();

            const detected = [];

            for (const field of rawFields) {
                const name = field.getName();
                const constructorName = field.constructor.name;
                let type = 'text';
                let currentValue = '';
                let options = [];

                if (constructorName.includes('CheckBox') || constructorName === 'PDFCheckBox') {
                    type = 'checkbox';
                    currentValue = field.isChecked ? field.isChecked() : false;
                } else if (constructorName.includes('Dropdown') || constructorName === 'PDFDropdown') {
                    type = 'dropdown';
                    currentValue = field.getSelected ? (field.getSelected()[0] || '') : '';
                    options = field.getOptions ? field.getOptions() : [];
                } else if (constructorName.includes('RadioGroup') || constructorName === 'PDFRadioGroup') {
                    type = 'radio';
                    currentValue = field.getSelected ? field.getSelected() : '';
                    options = field.getOptions ? field.getOptions() : [];
                } else if (constructorName.includes('OptionList') || constructorName === 'PDFOptionList') {
                    type = 'optionList';
                    currentValue = field.getSelected ? field.getSelected() : [];
                    options = field.getOptions ? field.getOptions() : [];
                } else {
                    type = 'text';
                    currentValue = field.getText ? (field.getText() || '') : '';
                }

                detected.push({
                    name,
                    type,
                    value: currentValue,
                    options,
                    label: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                });
            }

            return {
                hasAcroForm: detected.length > 0,
                fieldCount: detected.length,
                fields: detected
            };
        } catch (err) {
            console.warn('AcroForm detection warning:', err.message);
            return {
                hasAcroForm: false,
                fieldCount: 0,
                fields: []
            };
        }
    }

    /**
     * Prompts Gemini Flash to fill all detected fields intelligently based on context
     */
    static async autoFillWithAi(fields, userContext = '', persona = 'candidate') {
        if (!fields || fields.length === 0) {
            throw new Error('Nenhum campo de formulário identificado para preenchimento.');
        }

        const fieldsSchema = fields.map(f => ({
            name: f.name,
            type: f.type,
            options: f.options || [],
            currentValue: f.value
        }));

        let personaGuidance = '';
        if (persona === 'candidate' || persona === 'pf') {
            personaGuidance = 'Preencha como um profissional qualificado no Brasil, com CPF válido formatado (ex: 123.456.789-00), CEP de São Paulo ou Curitiba, e-mail profissional, telefone com DDD (+55 11 98765-4321) e marque checkboxes de concordância com true.';
        } else if (persona === 'company' || persona === 'pj') {
            personaGuidance = 'Preencha como uma empresa de tecnologia/serviços brasileira, com CNPJ formatado (ex: 12.345.678/0001-90), razão social, endereço empresarial e dados corporativos.';
        } else if (persona === 'legal') {
            personaGuidance = 'Preencha com rigor jurídico e dados formais de contrato ou procuração.';
        }

        const prompt = `
Você é o Copiloto de Inteligência Artificial do PDF Studio Pro especializado em preenchimento de formulários interativos (AcroForms).

Analise com atenção a lista de campos do formulário PDF abaixo:
\`\`\`json
${JSON.stringify(fieldsSchema, null, 2)}
\`\`\`

Contexto e Instruções do Usuário:
${userContext || 'Gere dados realistas, consistentes e perfeitamente formatados para preencher todos os campos do formulário.'}

Diretriz de Persona:
${personaGuidance}

Regras Mandatórias:
1. Para campos de texto (text): forneça o valor em string formatado adequadamente (ex: CPFs com pontos e traço, CEPs com hífen, e-mails válidos).
2. Para campos do tipo checkbox (checkbox): forneça true ou false como booleano.
3. Para campos do tipo dropdown ou radio: escolha EXATAMENTE uma das opções existentes no array "options" do campo.
4. Para campos de observações ou resumo: escreva um texto conciso, profissional e relevante de 2 a 3 frases.

Retorne EXCLUSIVAMENTE um objeto JSON válido no seguinte formato:
{
  "filledFields": {
    "nome_do_campo": "valor_preenchido"
  },
  "summary": "Resumo em 1 frase do perfil e das informações preenchidas.",
  "confidence": 98
}
`;

        const rawAiResponse = await AiEngine.callGemini(prompt, 0.1);
        const parsed = AiEngine.extractJsonFromText(rawAiResponse);

        if (!parsed || !parsed.filledFields) {
            throw new Error('Falha ao processar a resposta estruturada do Gemini Flash.');
        }

        return parsed;
    }

    /**
     * Injects filled values into the PDF document
     */
    static async fillPdf(pdfBytes, fieldValues, options = { flatten: false }) {
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const form = pdfDoc.getForm();

        let filledCount = 0;

        for (const [fieldName, val] of Object.entries(fieldValues)) {
            try {
                const field = form.getField(fieldName);
                if (!field) continue;

                const constructorName = field.constructor.name;

                if (constructorName.includes('CheckBox') || constructorName === 'PDFCheckBox') {
                    if (val === true || val === 'true' || val === '1' || val === 'checked') {
                        field.check();
                    } else {
                        field.uncheck();
                    }
                    filledCount++;
                } else if (constructorName.includes('Dropdown') || constructorName === 'PDFDropdown') {
                    const validOptions = field.getOptions ? field.getOptions() : [];
                    const strVal = String(val);
                    if (validOptions.includes(strVal)) {
                        field.select(strVal);
                    } else if (validOptions.length > 0) {
                        // Find closest match or pick first
                        const match = validOptions.find(opt => opt.toLowerCase().includes(strVal.toLowerCase()));
                        field.select(match || validOptions[0]);
                    }
                    filledCount++;
                } else if (constructorName.includes('RadioGroup') || constructorName === 'PDFRadioGroup') {
                    const validOptions = field.getOptions ? field.getOptions() : [];
                    const strVal = String(val);
                    if (validOptions.includes(strVal)) {
                        field.select(strVal);
                    }
                    filledCount++;
                } else {
                    // Text Field
                    if (field.setText) {
                        field.setText(String(val !== null && val !== undefined ? val : ''));
                        filledCount++;
                    }
                }
            } catch (fieldErr) {
                console.warn(`Could not set field ${fieldName}:`, fieldErr.message);
            }
        }

        if (options.flatten) {
            form.flatten();
        }

        const modifiedBytes = await pdfDoc.save();
        return {
            pdfBuffer: Buffer.from(modifiedBytes),
            filledCount,
            flattened: !!options.flatten
        };
    }
}

module.exports = AcroFormCopilot;
