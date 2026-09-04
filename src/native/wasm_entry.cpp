#include "pdf_types.hpp"
#include "pdf_parser.hpp"
#include "pdf_writer.hpp"
#include "pdf_content.hpp"
#include "pdf_editor_core.hpp"
#include <string>
#include <vector>
#include <sstream>
#include <cstring>
#include <cstdlib>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

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

extern "C" {

WASM_EXPORT
const char* wasm_get_version() {
    return "PDF Studio C++17 Native Engine (WebAssembly v1.0.0)";
}

WASM_EXPORT
char* wasm_inspect_pdf(const uint8_t* inBuf, int inLen) {
    if (!inBuf || inLen <= 0) {
        std::string err = "{\"error\": \"Buffer vazio ou inválido\"}";
        char* res = (char*)std::malloc(err.size() + 1);
        std::strcpy(res, err.c_str());
        return res;
    }

    pdf::Parser parser;
    if (!parser.loadFromMemory(inBuf, inLen)) {
        std::string err = "{\"error\": \"Falha ao interpretar estrutura do PDF no motor WebAssembly\"}";
        char* res = (char*)std::malloc(err.size() + 1);
        std::strcpy(res, err.c_str());
        return res;
    }

    std::ostringstream json;
    json << "{\n";
    json << "  \"version\": \"" << parser.pdfVersion << "\",\n";
    json << "  \"engine\": \"WebAssembly C++17 Client-side\",\n";
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

    std::string str = json.str();
    char* res = (char*)std::malloc(str.size() + 1);
    std::strcpy(res, str.c_str());
    return res;
}

WASM_EXPORT
uint8_t* wasm_compress_pdf(
    const uint8_t* inBuf, 
    int inLen, 
    const char* profile, 
    int* outLen, 
    char** outMetricsJson
) {
    if (!inBuf || inLen <= 0 || !outLen) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    pdf::Parser parser;
    if (!parser.loadFromMemory(inBuf, inLen)) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    std::string prof = profile ? profile : "balanced";
    
    // In-memory optimization using Writer::writePdfMemory
    pdf::EditorCore::optimizePdf(parser, "", prof);

    std::vector<uint8_t> outBytes;
    bool ok = pdf::Writer::writePdfMemory(parser.objects, parser.catalog, outBytes);
    if (!ok || outBytes.empty()) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    *outLen = (int)outBytes.size();
    uint8_t* resBuf = (uint8_t*)std::malloc(outBytes.size());
    std::memcpy(resBuf, outBytes.data(), outBytes.size());

    if (outMetricsJson) {
        double ratio = inLen > 0 ? (1.0 - (double)outBytes.size() / (double)inLen) * 100.0 : 0.0;
        std::ostringstream mj;
        mj << "{\"success\":true,\"originalSize\":" << inLen 
           << ",\"compressedSize\":" << outBytes.size()
           << ",\"bytesSaved\":" << (inLen > (int)outBytes.size() ? (inLen - (int)outBytes.size()) : 0)
           << ",\"ratio\":" << (ratio > 0.0 ? ratio : 0.0)
           << ",\"engine\":\"WASM C++17\"}";
        std::string mStr = mj.str();
        *outMetricsJson = (char*)std::malloc(mStr.size() + 1);
        std::strcpy(*outMetricsJson, mStr.c_str());
    }

    return resBuf;
}

WASM_EXPORT
uint8_t* wasm_redact_pdf(
    const uint8_t* inBuf,
    int inLen,
    int pageIndex,
    double x,
    double y,
    double w,
    double h,
    const char* overlayText,
    int* outLen,
    int* outPurgedChars
) {
    if (!inBuf || inLen <= 0 || !outLen) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    pdf::Parser parser;
    if (!parser.loadFromMemory(inBuf, inLen)) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    std::vector<pdf::RedactionBox> redactions;
    pdf::RedactionBox box;
    box.pageIndex = pageIndex;
    box.x = x;
    box.y = y;
    box.width = w;
    box.height = h;
    box.overlayText = overlayText ? overlayText : "[CONFIDENCIAL / EXPURGADO]";
    redactions.push_back(box);

    auto redRes = pdf::EditorCore::applyRedactions(parser, redactions, "");
    if (outPurgedChars) *outPurgedChars = redRes.purgedChars;

    std::vector<uint8_t> outBytes;
    bool ok = pdf::Writer::writePdfMemory(parser.objects, parser.catalog, outBytes);
    if (!ok || outBytes.empty()) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    *outLen = (int)outBytes.size();
    uint8_t* resBuf = (uint8_t*)std::malloc(outBytes.size());
    std::memcpy(resBuf, outBytes.data(), outBytes.size());
    return resBuf;
}

WASM_EXPORT
uint8_t* wasm_rotate_page(
    const uint8_t* inBuf,
    int inLen,
    int pageIndex,
    int angleDelta,
    int* outLen
) {
    if (!inBuf || inLen <= 0 || !outLen) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    pdf::Parser parser;
    if (!parser.loadFromMemory(inBuf, inLen)) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    if (pageIndex >= 0 && pageIndex < (int)parser.pages.size()) {
        int curRot = parser.pages[pageIndex].rotation;
        int newRot = (curRot + angleDelta + 360) % 360;
        parser.pages[pageIndex].rotation = newRot;

        int pageObjNum = parser.pages[pageIndex].objNum;
        if (parser.objects.count(pageObjNum)) {
            auto pObj = parser.objects[pageObjNum].object;
            if (pObj && pObj->type == pdf::ObjectType::Dictionary) {
                pObj->dictValue["Rotate"] = pdf::Object::createNumber(newRot);
            }
        }
    }

    std::vector<uint8_t> outBytes;
    bool ok = pdf::Writer::writePdfMemory(parser.objects, parser.catalog, outBytes);
    if (!ok || outBytes.empty()) {
        if (outLen) *outLen = 0;
        return nullptr;
    }

    *outLen = (int)outBytes.size();
    uint8_t* resBuf = (uint8_t*)std::malloc(outBytes.size());
    std::memcpy(resBuf, outBytes.data(), outBytes.size());
    return resBuf;
}

WASM_EXPORT
void wasm_free_buffer(uint8_t* ptr) {
    if (ptr) std::free(ptr);
}

WASM_EXPORT
void wasm_free_string(char* ptr) {
    if (ptr) std::free(ptr);
}

} // extern "C"
