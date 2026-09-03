#pragma once
#include "pdf_types.hpp"
#include "pdf_writer.hpp"
#include <string>
#include <map>
#include <sstream>

namespace pdf {

class SampleGenerator {
public:
    static bool generateSample(const std::string& type, const std::string& outputPath) {
        std::map<int, IndirectObject> objects;

        // Obj 1: Catalog
        auto catalog = Object::createDict();
        catalog->dictValue["Type"] = Object::createName("Catalog");
        catalog->dictValue["Pages"] = Object::createRef(2);
        objects[1] = {1, 0, catalog};

        // Obj 2: Pages Parent
        auto pages = Object::createDict();
        pages->dictValue["Type"] = Object::createName("Pages");
        pages->dictValue["Count"] = Object::createNumber(1);
        auto kids = Object::createArray();
        kids->arrayValue.push_back(Object::createRef(3));
        pages->dictValue["Kids"] = kids;
        objects[2] = {2, 0, pages};

        // Obj 3: Page 1
        auto page = Object::createDict();
        page->dictValue["Type"] = Object::createName("Page");
        page->dictValue["Parent"] = Object::createRef(2);
        auto mbox = Object::createArray();
        mbox->arrayValue.push_back(Object::createNumber(0));
        mbox->arrayValue.push_back(Object::createNumber(0));
        mbox->arrayValue.push_back(Object::createNumber(595.28)); // A4 Width
        mbox->arrayValue.push_back(Object::createNumber(841.89)); // A4 Height
        page->dictValue["MediaBox"] = mbox;
        page->dictValue["Contents"] = Object::createRef(4);

        // Resources
        auto resources = Object::createDict();
        auto fontDict = Object::createDict();
        
        // Helvetica
        auto f1 = Object::createDict();
        f1->dictValue["Type"] = Object::createName("Font");
        f1->dictValue["Subtype"] = Object::createName("Type1");
        f1->dictValue["BaseFont"] = Object::createName("Helvetica");
        fontDict->dictValue["F1"] = f1;

        // Helvetica-Bold
        auto f2 = Object::createDict();
        f2->dictValue["Type"] = Object::createName("Font");
        f2->dictValue["Subtype"] = Object::createName("Type1");
        f2->dictValue["BaseFont"] = Object::createName("Helvetica-Bold");
        fontDict->dictValue["F2"] = f2;

        resources->dictValue["Font"] = fontDict;
        page->dictValue["Resources"] = resources;
        objects[3] = {3, 0, page};

        // Stream Content
        std::ostringstream cs;
        if (type == "contract" || type == "contrato") {
            cs << "q\n";
            // Header bar
            cs << "0.08 0.12 0.22 rg 0 780 595.28 62 re f\n";
            cs << "BT\n/F2 18 Tf 1 1 1 rg 40 802 Td (CONTRATO DE PRESTACAO DE SERVICOS DE SOFTWARE) Tj\nET\n";
            
            // Subheader
            cs << "BT\n/F1 10 Tf 0.8 0.85 0.95 rg 40 788 Td (DOCUMENTO NUMERO: #CTR-2026-8942B | REGISTRO OFICIAL) Tj\nET\n";

            // Body
            cs << "BT\n/F2 12 Tf 0.1 0.15 0.25 rg 40 740 Td (1. IDENTIFICACAO DAS PARTES CONTRATANTES) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 720 Td (CONTRATADA: TechSolutions Global Ltda, CNPJ: 12.345.678/0001-90, Sao Paulo - SP) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 705 Td (CONTRATANTE: Alpha Enterprise Corp, CNPJ: 98.765.432/0001-11, Rio de Janeiro - RJ) Tj\nET\n";

            cs << "BT\n/F2 12 Tf 0.1 0.15 0.25 rg 40 665 Td (2. DO OBJETO E ESCOPO DO PROJETO) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 645 Td (O presente instrumento tem por objeto o desenvolvimento de um Editor de PDF Profissional,) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 630 Td (incluindo motor nativo em C++, API em Node.js e interface web interativa de alta performance.) Tj\nET\n";

            cs << "BT\n/F2 12 Tf 0.1 0.15 0.25 rg 40 590 Td (3. VALORES, PRAZOS E FORMA DE PAGAMENTO) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 570 Td (Pela prestacao dos servicos, a CONTRATANTE pagara a quantia total de R$ 45.000,00.) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 40 555 Td (Prazo de entrega previsto: 30 de Setembro de 2026.) Tj\nET\n";

            // Confidentiality Note Box
            cs << "0.95 0.97 1.0 rg 0.2 0.4 0.8 RG 1 w 40 460 515 65 re B\n";
            cs << "BT\n/F2 10 Tf 0.1 0.3 0.7 rg 55 505 Td (CLAUSULA DE CONFIDENCIALIDADE E PRIVACIDADE (DADO SENSIVEL):) Tj\nET\n";
            cs << "BT\n/F1 9 Tf 0.3 0.3 0.3 rg 55 490 Td (Chave Secreta API de Seguranca: SEC-9942-X883-K991-CONFIDENTIAL) Tj\nET\n";
            cs << "BT\n/F1 9 Tf 0.3 0.3 0.3 rg 55 475 Td (Este documento contem segredos industriais protegidos por legislacao internacional.) Tj\nET\n";

            // Signature area
            cs << "0.7 0.7 0.7 RG 1 w\n";
            cs << "40 320 220 0 re S\n";
            cs << "335 320 220 0 re S\n";
            cs << "BT\n/F2 9 Tf 0.3 0.3 0.3 rg 60 305 Td (REPRESENTANTE CONTRATADA) Tj\nET\n";
            cs << "BT\n/F2 9 Tf 0.3 0.3 0.3 rg 360 305 Td (REPRESENTANTE CONTRATANTE) Tj\nET\n";
            cs << "Q\n";
        } else if (type == "invoice" || type == "fatura") {
            cs << "q\n";
            // Header
            cs << "0.0 0.4 0.8 rg 0 760 595.28 82 re f\n";
            cs << "BT\n/F2 22 Tf 1 1 1 rg 40 805 Td (FATURA COMERCIAL / INVOICE) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.85 0.95 1.0 rg 40 785 Td (FATURA NUMERO: #INV-2026-9041 | EMISSAO: 01/09/2026) Tj\nET\n";

            // Customer Info
            cs << "BT\n/F2 11 Tf 0.1 0.1 0.1 rg 40 720 Td (DADOS DO CLIENTE:) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.3 0.3 0.3 rg 40 705 Td (Cliente: Rodrigo Silva Santos - CPF: 334.552.198-00) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.3 0.3 0.3 rg 40 690 Td (Email: rodrigo.silva@empresa.com.br) Tj\nET\n";

            // Table Header
            cs << "0.92 0.94 0.98 rg 40 630 515 25 re f\n";
            cs << "BT\n/F2 10 Tf 0.1 0.2 0.4 rg 50 640 Td (DESCRICAO DO ITEM / SERVICO) Tj\nET\n";
            cs << "BT\n/F2 10 Tf 0.1 0.2 0.4 rg 350 640 Td (QTD) Tj\nET\n";
            cs << "BT\n/F2 10 Tf 0.1 0.2 0.4 rg 450 640 Td (VALOR TOTAL) Tj\nET\n";

            // Table Rows
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 50 605 Td (1. Licenca Anual PDF Studio Pro Enterprise) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 360 605 Td (1) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 450 605 Td (R$ 3.490,00) Tj\nET\n";

            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 50 575 Td (2. Modulo C++ Native Rendering Engine) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 360 575 Td (1) Tj\nET\n";
            cs << "BT\n/F1 10 Tf 0.2 0.2 0.2 rg 450 575 Td (R$ 1.200,00) Tj\nET\n";

            // Total Box
            cs << "0.0 0.4 0.8 rg 340 500 215 40 re f\n";
            cs << "BT\n/F2 12 Tf 1 1 1 rg 355 515 Td (TOTAL PAGO: R$ 4.690,00) Tj\nET\n";
            cs << "Q\n";
        } else {
            // Certificate
            cs << "q\n";
            cs << "0.85 0.7 0.2 RG 4 w 25 25 545.28 791.89 re S\n";
            cs << "0.1 0.15 0.3 RG 1.5 w 35 35 525.28 771.89 re S\n";

            cs << "BT\n/F2 26 Tf 0.1 0.15 0.35 rg 140 720 Td (CERTIFICADO DE CONCLUSAO) Tj\nET\n";
            cs << "BT\n/F1 12 Tf 0.4 0.4 0.4 rg 215 680 Td (Certificamos solenemente que) Tj\nET\n";

            cs << "BT\n/F2 20 Tf 0.8 0.2 0.1 rg 180 620 Td (GABRIEL MEDEIROS) Tj\nET\n";
            cs << "BT\n/F1 11 Tf 0.3 0.3 0.3 rg 100 560 Td (concluiu com exito o Curso Avancado de Engenharia de Software e) Tj\nET\n";
            cs << "BT\n/F1 11 Tf 0.3 0.3 0.3 rg 90 540 Td (Desenvolvimento de Motores de PDF de Alto Desempenho com C++ e Node.js,) Tj\nET\n";
            cs << "BT\n/F1 11 Tf 0.3 0.3 0.3 rg 165 520 Td (com carga horaria total de 120 horas aula.) Tj\nET\n";

            cs << "BT\n/F1 10 Tf 0.5 0.5 0.5 rg 220 440 Td (Emitido em 01 de Setembro de 2026) Tj\nET\n";
            cs << "BT\n/F2 10 Tf 0.2 0.2 0.2 rg 195 380 Td (CODIGO DE AUTENTICIDADE: CERT-PDF-99201) Tj\nET\n";
            cs << "Q\n";
        }

        std::string streamStr = cs.str();
        auto streamObj = std::make_shared<Object>();
        streamObj->type = ObjectType::Stream;
        streamObj->streamData.assign(streamStr.begin(), streamStr.end());
        streamObj->dictValue["Length"] = Object::createNumber((double)streamStr.size());
        objects[4] = {4, 0, streamObj};

        return Writer::writePdf(outputPath, objects, catalog);
    }
};

} // namespace pdf
