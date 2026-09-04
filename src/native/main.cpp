#include "pdf_types.hpp"
#include "pdf_parser.hpp"
#include "pdf_writer.hpp"
#include "pdf_content.hpp"
#include "pdf_editor_core.hpp"
#include "pdf_samples.hpp"
#include <iostream>
#include <fstream>
#include <sstream>

static std::string escapeJson(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '\\') out += "\\\\";
        else if (c == '"') out += "\\\"";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else out += c;
    }
    return out;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "{\"error\": \"Invalid arguments. Usage: pdf_engine <command> [args]\"}\n";
        return 1;
    }

    std::string cmd = argv[1];

    if (cmd == "--create-sample") {
        if (argc < 4) {
            std::cout << "{\"error\": \"Usage: --create-sample <type> <output_path>\"}\n";
            return 1;
        }
        std::string type = argv[2];
        std::string outPath = argv[3];
        bool ok = pdf::SampleGenerator::generateSample(type, outPath);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"output\":\"" << escapeJson(outPath) << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "--inspect") {
        if (argc < 3) {
            std::cout << "{\"error\": \"Usage: --inspect <pdf_path>\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse PDF file: " << inputPath << "\"}\n";
            return 1;
        }

        std::ostringstream json;
        json << "{\n";
        json << "  \"version\": \"" << parser.pdfVersion << "\",\n";
        json << "  \"pageCount\": " << parser.pages.size() << ",\n";
        json << "  \"pages\": [\n";

        for (size_t p = 0; p < parser.pages.size(); ++p) {
            auto& page = parser.pages[p];
            auto rawStream = parser.getPageContentStream((int)p);
            auto textBlocks = pdf::ContentStreamParser::extractTextBlocks(rawStream, (int)p, page.height);

            if (p > 0) json << ",\n";
            json << "    {\n";
            json << "      \"pageNumber\": " << (p + 1) << ",\n";
            json << "      \"objNum\": " << page.objNum << ",\n";
            json << "      \"width\": " << page.width << ",\n";
            json << "      \"height\": " << page.height << ",\n";
            json << "      \"rotation\": " << page.rotation << ",\n";
            json << "      \"textBlocks\": [\n";
            for (size_t t = 0; t < textBlocks.size(); ++t) {
                if (t > 0) json << ",\n";
                json << "        " << textBlocks[t].toJson();
            }
            json << "\n      ]\n";
            json << "    }";
        }
        json << "\n  ],\n";

        // Cos Object Tree for Preflight / Low-level Inspector
        json << "  \"objectsSummary\": {\n";
        json << "    \"totalObjects\": " << parser.objects.size() << ",\n";
        json << "    \"objectList\": [\n";
        size_t objIdx = 0;
        for (const auto& pair : parser.objects) {
            if (objIdx > 0) json << ",\n";
            json << "      {\"objNum\": " << pair.first << ", \"gen\": " << pair.second.genNum 
                 << ", \"type\": " << (int)pair.second.object->type << "}";
            objIdx++;
        }
        json << "\n    ]\n";
        json << "  }\n";
        json << "}\n";

        std::cout << json.str();
        return 0;
    }

    if (cmd == "--edit-text") {
        // Usage: --edit-text <input_path> <output_path> <pageIndex> <oldText> <newText>
        if (argc < 7) {
            std::cout << "{\"error\": \"Usage: --edit-text <input_path> <output_path> <pageIndex> <oldText> <newText>\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        std::string outputPath = argv[3];
        int pageIndex = std::atoi(argv[4]);
        std::string oldText = argv[5];
        std::string newText = argv[6];

        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse input PDF\"}\n";
            return 1;
        }

        std::vector<pdf::TextEditOp> edits;
        pdf::TextEditOp op;
        op.pageIndex = pageIndex;
        op.originalText = oldText;
        op.newText = newText;
        edits.push_back(op);

        bool ok = pdf::EditorCore::applyTextEdits(parser, edits, outputPath);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"output\":\"" << escapeJson(outputPath) << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "--redact") {
        // Usage: --redact <input_path> <output_path> <pageIndex> <x> <y> <w> <h> [overlayText]
        if (argc < 8) {
            std::cout << "{\"error\": \"Usage: --redact <input_path> <output_path> <pageIndex> <x> <y> <w> <h> [overlayText]\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        std::string outputPath = argv[3];
        int pageIndex = std::atoi(argv[4]);
        double x = std::atof(argv[5]);
        double y = std::atof(argv[6]);
        double w = std::atof(argv[7]);
        double h = std::atof(argv[8]);
        std::string overlayText = argc > 9 ? argv[9] : "[CENSURADO / REDACTED]";
        std::vector<std::string> keywords;
        if (argc > 10) {
            keywords.push_back(argv[10]);
        }

        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse input PDF\"}\n";
            return 1;
        }

        std::vector<pdf::RedactionBox> redactions;
        pdf::RedactionBox box;
        box.pageIndex = pageIndex;
        box.x = x; box.y = y; box.width = w; box.height = h;
        box.overlayText = overlayText;
        box.r = 0.0; box.g = 0.0; box.b = 0.0; // Black box
        redactions.push_back(box);

        auto res = pdf::EditorCore::applyRedactions(parser, redactions, outputPath, keywords);
        std::cout << "{\"success\":" << (res.success ? "true" : "false")
                  << ",\"purgedChars\":" << res.purgedChars
                  << ",\"purgedBlocks\":" << res.purgedBlocks
                  << ",\"metadataScrubbed\":" << (res.metadataScrubbed ? "true" : "false")
                  << ",\"output\":\"" << escapeJson(outputPath) << "\"}\n";
        return res.success ? 0 : 1;
    }

    if (cmd == "--annotate") {
        // Usage: --annotate <input_path> <output_path> <pageIndex> <type> <x> <y> <w> <h> [text/color]
        if (argc < 9) {
            std::cout << "{\"error\": \"Usage: --annotate <input_path> <output_path> <pageIndex> <type> <x> <y> <w> <h> [text]\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        std::string outputPath = argv[3];
        int pageIndex = std::atoi(argv[4]);
        std::string type = argv[5];
        double x = std::atof(argv[6]);
        double y = std::atof(argv[7]);
        double w = std::atof(argv[8]);
        double h = std::atof(argv[9]);
        std::string text = argc > 10 ? argv[10] : "";

        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse input PDF\"}\n";
            return 1;
        }

        std::vector<pdf::AnnotationOp> annots;
        pdf::AnnotationOp ann;
        ann.pageIndex = pageIndex;
        ann.type = type;
        ann.x = x; ann.y = y; ann.width = w; ann.height = h;
        ann.textContent = text;

        if (type == "highlight") {
            ann.colorR = 1.0; ann.colorG = 0.9; ann.colorB = 0.2; // Yellow
        } else if (type == "signature" || type == "stamp") {
            ann.colorR = 0.1; ann.colorG = 0.3; ann.colorB = 0.8; // Blue seal
        } else {
            ann.colorR = 0.9; ann.colorG = 0.1; ann.colorB = 0.1; // Red
        }
        annots.push_back(ann);

        bool ok = pdf::EditorCore::applyAnnotations(parser, annots, outputPath);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"output\":\"" << escapeJson(outputPath) << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "--rotate-page") {
        if (argc < 6) {
            std::cout << "{\"error\": \"Usage: --rotate-page <input_path> <output_path> <pageIndex> <angle>\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        std::string outputPath = argv[3];
        int pageIndex = std::atoi(argv[4]);
        int angle = std::atoi(argv[5]);

        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse input PDF\"}\n";
            return 1;
        }

        bool ok = pdf::EditorCore::rotatePage(parser, pageIndex, angle, outputPath);
        std::cout << "{\"success\":" << (ok ? "true" : "false") << ",\"output\":\"" << escapeJson(outputPath) << "\"}\n";
        return ok ? 0 : 1;
    }

    if (cmd == "--compress") {
        // Usage: --compress <input_path> <output_path> [profile]
        if (argc < 4) {
            std::cout << "{\"error\": \"Usage: --compress <input_path> <output_path> [profile]\"}\n";
            return 1;
        }
        std::string inputPath = argv[2];
        std::string outputPath = argv[3];
        std::string profile = argc > 4 ? argv[4] : "balanced";

        pdf::Parser parser;
        if (!parser.loadFromFile(inputPath)) {
            std::cout << "{\"error\": \"Failed to parse input PDF: " << escapeJson(inputPath) << "\"}\n";
            return 1;
        }

        auto res = pdf::EditorCore::optimizePdf(parser, outputPath, profile);
        std::cout << "{\"success\":" << (res.success ? "true" : "false")
                  << ",\"originalSize\":" << res.originalBytes
                  << ",\"compressedSize\":" << res.optimizedBytes
                  << ",\"bytesSaved\":" << (res.originalBytes > res.optimizedBytes ? (res.originalBytes - res.optimizedBytes) : 0)
                  << ",\"ratio\":" << (res.reductionPercent > 0.0 ? res.reductionPercent : 0.0)
                  << ",\"removedObjects\":" << res.removedObjects
                  << ",\"recompressedStreams\":" << res.recompressedStreams
                  << ",\"profile\":\"" << escapeJson(profile) << "\""
                  << ",\"output\":\"" << escapeJson(outputPath) << "\"}\n";
        return res.success ? 0 : 1;
    }

    std::cout << "{\"error\": \"Unknown command: " << cmd << "\"}\n";
    return 1;
}
