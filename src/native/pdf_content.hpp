#pragma once
#include "pdf_types.hpp"
#include <vector>
#include <string>
#include <sstream>
#include <iostream>
#include <cctype>
#include <cmath>
#include <iomanip>

namespace pdf {

inline std::string unescapePdfString(const std::string& in) {
    std::string out;
    for (size_t i = 0; i < in.size(); ++i) {
        if (in[i] == '\\' && i + 1 < in.size()) {
            char next = in[++i];
            if (next == 'n') out += '\n';
            else if (next == 'r') out += '\r';
            else if (next == 't') out += '\t';
            else if (next == 'b') out += '\b';
            else if (next == 'f') out += '\f';
            else if (next == '(') out += '(';
            else if (next == ')') out += ')';
            else if (next == '\\') out += '\\';
            else out += next;
        } else {
            out += in[i];
        }
    }
    return out;
}

inline std::string escapePdfString(const std::string& in) {
    std::string out;
    for (char c : in) {
        if (c == '(' || c == ')' || c == '\\') {
            out += '\\';
        }
        out += c;
    }
    return out;
}

inline std::string decodeHexPdfString(const std::string& hex) {
    std::string clean;
    for (char c : hex) {
        if (!std::isspace((unsigned char)c)) clean += c;
    }
    if (clean.length() % 2 != 0) clean += '0';
    std::string out;
    for (size_t i = 0; i < clean.length(); i += 2) {
        std::string byteStr = clean.substr(i, 2);
        char b = (char)strtol(byteStr.c_str(), nullptr, 16);
        out += b;
    }
    return out;
}

struct SanitizeResult {
    std::string sanitizedStream;
    int purgedBlocks = 0;
    int purgedChars = 0;
};

class ContentStreamParser {
public:
    static std::vector<TextBlock> extractTextBlocks(const std::vector<uint8_t>& streamData, int pageIndex, double pageHeight) {
        std::vector<TextBlock> blocks;
        if (streamData.empty()) return blocks;

        std::string streamStr(streamData.begin(), streamData.end());
        size_t pos = 0;
        size_t len = streamStr.length();

        // Current graphics / text state
        std::string currentFont = "Helvetica";
        double currentFontSize = 12.0;
        double textMatrix[6] = {1, 0, 0, 1, 0, 0};
        double curX = 0, curY = 0;
        double lineStartX = 0, lineStartY = 0;
        double colorR = 0, colorG = 0, colorB = 0;
        int nextId = 1;

        std::vector<std::string> stack;

        auto skipWhitespace = [&]() {
            while (pos < len) {
                char c = streamStr[pos];
                if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
                    pos++;
                } else if (c == '%') {
                    while (pos < len && streamStr[pos] != '\r' && streamStr[pos] != '\n') {
                        pos++;
                    }
                } else {
                    break;
                }
            }
        };

        auto readNextToken = [&]() -> std::string {
            skipWhitespace();
            if (pos >= len) return "";

            char c = streamStr[pos];

            // String ( ... )
            if (c == '(') {
                pos++;
                std::string s = "(";
                int depth = 1;
                while (pos < len && depth > 0) {
                    char ch = streamStr[pos++];
                    if (ch == '\\' && pos < len) {
                        s += ch;
                        s += streamStr[pos++];
                    } else if (ch == '(') {
                        depth++;
                        s += ch;
                    } else if (ch == ')') {
                        depth--;
                        s += ch;
                    } else {
                        s += ch;
                    }
                }
                return s;
            }

            // Hex string < ... > or <<
            if (c == '<') {
                if (pos + 1 < len && streamStr[pos + 1] == '<') {
                    pos += 2;
                    return "<<";
                }
                pos++;
                std::string s = "<";
                while (pos < len && streamStr[pos] != '>') {
                    s += streamStr[pos++];
                }
                if (pos < len && streamStr[pos] == '>') s += streamStr[pos++];
                return s;
            }

            // >>
            if (c == '>' && pos + 1 < len && streamStr[pos + 1] == '>') {
                pos += 2;
                return ">>";
            }

            // [ or ]
            if (c == '[' || c == ']') {
                pos++;
                return std::string(1, c);
            }

            // Name / ...
            if (c == '/') {
                pos++;
                std::string name = "/";
                while (pos < len && !std::isspace((unsigned char)streamStr[pos]) && 
                       streamStr[pos] != '/' && streamStr[pos] != '(' && streamStr[pos] != ')' &&
                       streamStr[pos] != '[' && streamStr[pos] != ']' && 
                       streamStr[pos] != '<' && streamStr[pos] != '>') {
                    name += streamStr[pos++];
                }
                return name;
            }

            // Normal token
            size_t start = pos;
            while (pos < len && !std::isspace((unsigned char)streamStr[pos]) && 
                   streamStr[pos] != '(' && streamStr[pos] != ')' && 
                   streamStr[pos] != '<' && streamStr[pos] != '>' && 
                   streamStr[pos] != '[' && streamStr[pos] != ']' && 
                   streamStr[pos] != '/' && streamStr[pos] != '%') {
                pos++;
            }
            return streamStr.substr(start, pos - start);
        };

        while (pos < len) {
            std::string token = readNextToken();
            if (token.empty()) break;

            if (token == "BT") {
                textMatrix[0] = 1; textMatrix[1] = 0;
                textMatrix[2] = 0; textMatrix[3] = 1;
                textMatrix[4] = 0; textMatrix[5] = 0;
                curX = 0; curY = 0;
                lineStartX = 0; lineStartY = 0;
                stack.clear();
            } else if (token == "ET") {
                stack.clear();
            } else if (token == "Tf") {
                if (stack.size() >= 2) {
                    currentFont = stack[stack.size() - 2];
                    if (!currentFont.empty() && currentFont[0] == '/') currentFont = currentFont.substr(1);
                    currentFontSize = std::strtod(stack.back().c_str(), nullptr);
                    if (currentFontSize <= 0) currentFontSize = 12.0;
                }
                stack.clear();
            } else if (token == "Tm") {
                if (stack.size() >= 6) {
                    for (int i = 0; i < 6; ++i) {
                        textMatrix[i] = std::strtod(stack[stack.size() - 6 + i].c_str(), nullptr);
                    }
                    curX = textMatrix[4];
                    curY = textMatrix[5];
                    lineStartX = curX;
                    lineStartY = curY;
                }
                stack.clear();
            } else if (token == "Td" || token == "TD") {
                if (stack.size() >= 2) {
                    double tx = std::strtod(stack[stack.size() - 2].c_str(), nullptr);
                    double ty = std::strtod(stack.back().c_str(), nullptr);
                    curX = lineStartX + tx;
                    curY = lineStartY + ty;
                    lineStartX = curX;
                    lineStartY = curY;
                }
                stack.clear();
            } else if (token == "T*") {
                curX = lineStartX;
                curY = lineStartY - currentFontSize * 1.2;
                lineStartY = curY;
                stack.clear();
            } else if (token == "rg" || token == "k" || token == "g") {
                if (token == "rg" && stack.size() >= 3) {
                    colorR = std::strtod(stack[stack.size() - 3].c_str(), nullptr);
                    colorG = std::strtod(stack[stack.size() - 2].c_str(), nullptr);
                    colorB = std::strtod(stack.back().c_str(), nullptr);
                } else if (token == "g" && !stack.empty()) {
                    double g = std::strtod(stack.back().c_str(), nullptr);
                    colorR = colorG = colorB = g;
                }
                stack.clear();
            } else if (token == "Tj" || token == "\'") {
                std::string rawText;
                if (!stack.empty()) {
                    std::string rawToken = stack.back();
                    if (rawToken.size() >= 2 && rawToken.front() == '(' && rawToken.back() == ')') {
                        rawText = unescapePdfString(rawToken.substr(1, rawToken.size() - 2));
                    } else if (rawToken.size() >= 2 && rawToken.front() == '<' && rawToken.back() == '>') {
                        rawText = decodeHexPdfString(rawToken.substr(1, rawToken.size() - 2));
                    } else {
                        rawText = rawToken;
                    }
                }

                if (!rawText.empty()) {
                    TextBlock tb;
                    tb.id = nextId++;
                    tb.pageIndex = pageIndex;
                    tb.text = rawText;
                    tb.fontName = currentFont;
                    tb.fontSize = currentFontSize;
                    tb.x = curX;
                    tb.y = pageHeight - curY - currentFontSize;
                    tb.width = rawText.length() * (currentFontSize * 0.52);
                    tb.height = currentFontSize * 1.25;
                    tb.r = colorR; tb.g = colorG; tb.b = colorB;
                    tb.rawOperator = token;

                    blocks.push_back(tb);
                    curX += tb.width;
                }
                stack.clear();
            } else if (token == "TJ") {
                std::string combinedText;
                double totalWidth = 0.0;
                double cw = currentFontSize * 0.52;

                for (const auto& item : stack) {
                    if (item.size() >= 2 && item.front() == '(' && item.back() == ')') {
                        std::string sub = unescapePdfString(item.substr(1, item.size() - 2));
                        combinedText += sub;
                        totalWidth += sub.length() * cw;
                    } else {
                        double numVal = std::strtod(item.c_str(), nullptr);
                        if (numVal != 0) {
                            totalWidth -= (numVal * 0.001 * currentFontSize);
                        }
                    }
                }

                if (!combinedText.empty()) {
                    TextBlock tb;
                    tb.id = nextId++;
                    tb.pageIndex = pageIndex;
                    tb.text = combinedText;
                    tb.fontName = currentFont;
                    tb.fontSize = currentFontSize;
                    tb.x = curX;
                    tb.y = pageHeight - curY - currentFontSize;
                    tb.width = totalWidth > 0 ? totalWidth : combinedText.length() * cw;
                    tb.height = currentFontSize * 1.25;
                    tb.r = colorR; tb.g = colorG; tb.b = colorB;
                    tb.rawOperator = token;

                    blocks.push_back(tb);
                    curX += tb.width;
                }
                stack.clear();
            } else {
                stack.push_back(token);
            }
        }

        return blocks;
    }
};

class ContentStreamSanitizer {
public:
    static SanitizeResult sanitizeStream(
        const std::vector<uint8_t>& streamData,
        const std::vector<RedactionBox>& redactions,
        double pageHeight,
        const std::vector<std::string>& targetKeywords = {}
    ) {
        SanitizeResult result;
        if (streamData.empty()) return result;

        std::string streamStr(streamData.begin(), streamData.end());
        size_t pos = 0;
        size_t len = streamStr.length();

        std::string currentFont = "Helvetica";
        double currentFontSize = 12.0;
        double textMatrix[6] = {1, 0, 0, 1, 0, 0};
        double curX = 0, curY = 0;
        double lineStartX = 0, lineStartY = 0;
        bool insideBT = false;

        std::vector<std::string> stack;
        std::ostringstream out;

        auto skipWhitespace = [&]() {
            while (pos < len) {
                char c = streamStr[pos];
                if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
                    pos++;
                } else if (c == '%') {
                    while (pos < len && streamStr[pos] != '\r' && streamStr[pos] != '\n') {
                        pos++;
                    }
                } else {
                    break;
                }
            }
        };

        auto readNextToken = [&]() -> std::string {
            skipWhitespace();
            if (pos >= len) return "";

            char c = streamStr[pos];

            // String ( ... )
            if (c == '(') {
                pos++;
                std::string s = "(";
                int depth = 1;
                while (pos < len && depth > 0) {
                    char ch = streamStr[pos++];
                    if (ch == '\\' && pos < len) {
                        s += ch;
                        s += streamStr[pos++];
                    } else if (ch == '(') {
                        depth++;
                        s += ch;
                    } else if (ch == ')') {
                        depth--;
                        s += ch;
                    } else {
                        s += ch;
                    }
                }
                return s;
            }

            // Hex string < ... > or <<
            if (c == '<') {
                if (pos + 1 < len && streamStr[pos + 1] == '<') {
                    pos += 2;
                    return "<<";
                }
                pos++;
                std::string s = "<";
                while (pos < len && streamStr[pos] != '>') {
                    s += streamStr[pos++];
                }
                if (pos < len && streamStr[pos] == '>') s += streamStr[pos++];
                return s;
            }

            // >>
            if (c == '>' && pos + 1 < len && streamStr[pos + 1] == '>') {
                pos += 2;
                return ">>";
            }

            // [ or ]
            if (c == '[' || c == ']') {
                pos++;
                return std::string(1, c);
            }

            // Name / ...
            if (c == '/') {
                pos++;
                std::string name = "/";
                while (pos < len && !std::isspace((unsigned char)streamStr[pos]) && 
                       streamStr[pos] != '/' && streamStr[pos] != '(' && streamStr[pos] != ')' &&
                       streamStr[pos] != '[' && streamStr[pos] != ']' && 
                       streamStr[pos] != '<' && streamStr[pos] != '>') {
                    name += streamStr[pos++];
                }
                return name;
            }

            // Normal token
            size_t start = pos;
            while (pos < len && !std::isspace((unsigned char)streamStr[pos]) && 
                   streamStr[pos] != '(' && streamStr[pos] != ')' && 
                   streamStr[pos] != '<' && streamStr[pos] != '>' && 
                   streamStr[pos] != '[' && streamStr[pos] != ']' && 
                   streamStr[pos] != '/' && streamStr[pos] != '%') {
                pos++;
            }
            return streamStr.substr(start, pos - start);
        };

        auto isCharColliding = [&](double charClientX, double charClientY, double cw, double ch) {
            for (const auto& red : redactions) {
                double rx = red.x - 2.0;
                double ry = red.y - 2.0;
                double rw = red.width + 4.0;
                double rh = red.height + 4.0;
                if (charClientX < rx + rw && charClientX + cw > rx &&
                    charClientY < ry + rh && charClientY + ch > ry) {
                    return true;
                }
            }
            return false;
        };

        auto matchesAnyKeyword = [&](const std::string& txt) {
            if (txt.empty()) return false;
            for (const auto& kw : targetKeywords) {
                if (!kw.empty() && txt.find(kw) != std::string::npos) return true;
            }
            return false;
        };

        auto isOperand = [&](const std::string& tok) -> bool {
            if (tok.empty()) return false;
            char c = tok[0];
            if (c == '(' || c == '<' || c == '/' || c == '[' || c == ']') return true;
            if (std::isdigit((unsigned char)c) || c == '-' || c == '+' || c == '.') {
                char* end = nullptr;
                std::strtod(tok.c_str(), &end);
                if (end != tok.c_str() && *end == '\0') return true;
            }
            return false;
        };

        while (pos < len) {
            std::string token = readNextToken();
            if (token.empty()) break;

            if (isOperand(token)) {
                stack.push_back(token);
                continue;
            }

            if (token == "BT") {
                insideBT = true;
                textMatrix[0] = 1; textMatrix[1] = 0;
                textMatrix[2] = 0; textMatrix[3] = 1;
                textMatrix[4] = 0; textMatrix[5] = 0;
                curX = 0; curY = 0;
                lineStartX = 0; lineStartY = 0;
                out << "BT\n";
                stack.clear();
            } else if (token == "ET") {
                insideBT = false;
                out << "ET\n";
                stack.clear();
            } else if (token == "Tf") {
                if (stack.size() >= 2) {
                    currentFont = stack[stack.size() - 2];
                    if (!currentFont.empty() && currentFont[0] == '/') currentFont = currentFont.substr(1);
                    currentFontSize = std::strtod(stack.back().c_str(), nullptr);
                    if (currentFontSize <= 0) currentFontSize = 12.0;
                }
                for (const auto& s : stack) out << s << " ";
                out << "Tf\n";
                stack.clear();
            } else if (token == "Tm") {
                if (stack.size() >= 6) {
                    for (int i = 0; i < 6; ++i) {
                        textMatrix[i] = std::strtod(stack[stack.size() - 6 + i].c_str(), nullptr);
                    }
                    curX = textMatrix[4];
                    curY = textMatrix[5];
                    lineStartX = curX;
                    lineStartY = curY;
                }
                for (const auto& s : stack) out << s << " ";
                out << "Tm\n";
                stack.clear();
            } else if (token == "Td" || token == "TD") {
                if (stack.size() >= 2) {
                    double tx = std::strtod(stack[stack.size() - 2].c_str(), nullptr);
                    double ty = std::strtod(stack.back().c_str(), nullptr);
                    curX = lineStartX + tx;
                    curY = lineStartY + ty;
                    lineStartX = curX;
                    lineStartY = curY;
                }
                for (const auto& s : stack) out << s << " ";
                out << token << "\n";
                stack.clear();
            } else if (token == "T*") {
                curX = lineStartX;
                curY = lineStartY - currentFontSize * 1.2;
                lineStartY = curY;
                out << "T*\n";
                stack.clear();
            } else if (token == "Tj" || token == "\'") {
                std::string rawText;
                if (!stack.empty()) {
                    std::string rawToken = stack.back();
                    if (rawToken.size() >= 2 && rawToken.front() == '(' && rawToken.back() == ')') {
                        rawText = unescapePdfString(rawToken.substr(1, rawToken.size() - 2));
                    } else if (rawToken.size() >= 2 && rawToken.front() == '<' && rawToken.back() == '>') {
                        rawText = decodeHexPdfString(rawToken.substr(1, rawToken.size() - 2));
                    } else {
                        rawText = rawToken;
                    }
                }

                double cw = currentFontSize * 0.52;
                double ch = currentFontSize * 1.25;

                bool forcePurge = matchesAnyKeyword(rawText);
                std::vector<bool> redactedChars(rawText.size(), forcePurge);
                int countRedacted = forcePurge ? (int)rawText.size() : 0;

                if (!forcePurge) {
                    for (size_t i = 0; i < rawText.size(); ++i) {
                        double charX = curX + i * cw;
                        double charY = curY;
                        double charClientX = charX;
                        double charClientY = pageHeight - charY - currentFontSize;

                        if (isCharColliding(charClientX, charClientY, cw, ch)) {
                            redactedChars[i] = true;
                            countRedacted++;
                        }
                    }
                }

                if (countRedacted == 0) {
                    for (const auto& s : stack) out << s << " ";
                    out << token << "\n";
                    curX += rawText.size() * cw;
                } else if (countRedacted == (int)rawText.size()) {
                    // ALL CHARACTERS EXPURGED
                    result.purgedBlocks++;
                    result.purgedChars += (int)rawText.size();
                    double advanceW = rawText.size() * cw;
                    out << "% [PURGED BY PDF-STUDIO C++ ENGINE: " << rawText.size() << " CHARS DESTROYED]\n";
                    out << advanceW << " 0 Td\n";
                    curX += advanceW;
                    lineStartX += advanceW;
                } else {
                    // Partial redaction: split and emit
                    result.purgedBlocks++;
                    result.purgedChars += countRedacted;
                    size_t i = 0;
                    while (i < rawText.size()) {
                        if (redactedChars[i]) {
                            size_t startRed = i;
                            while (i < rawText.size() && redactedChars[i]) i++;
                            size_t redLen = i - startRed;
                            double adv = redLen * cw;
                            out << "% [PURGED " << redLen << " CHARS]\n";
                            out << adv << " 0 Td\n";
                            curX += adv;
                            lineStartX += adv;
                        } else {
                            size_t startKeep = i;
                            while (i < rawText.size() && !redactedChars[i]) i++;
                            std::string keepPart = rawText.substr(startKeep, i - startKeep);
                            out << "(" << escapePdfString(keepPart) << ") Tj\n";
                            curX += keepPart.size() * cw;
                        }
                    }
                }
                stack.clear();
            } else if (token == "TJ") {
                double cw = currentFontSize * 0.52;
                double ch = currentFontSize * 1.25;
                bool anyRedacted = false;
                std::vector<std::string> sanitizedArrayTokens;

                for (size_t idx = 0; idx < stack.size(); ++idx) {
                    const auto& item = stack[idx];
                    if (item.size() >= 2 && item.front() == '(' && item.back() == ')') {
                        std::string subText = unescapePdfString(item.substr(1, item.size() - 2));
                        bool forcePurge = matchesAnyKeyword(subText);
                        std::string surviving;
                        double purgedWidthInSub = 0.0;

                        for (size_t ci = 0; ci < subText.size(); ++ci) {
                            double charX = curX + ci * cw;
                            double charY = curY;
                            double charClientX = charX;
                            double charClientY = pageHeight - charY - currentFontSize;

                            if (forcePurge || isCharColliding(charClientX, charClientY, cw, ch)) {
                                anyRedacted = true;
                                result.purgedChars++;
                                purgedWidthInSub += cw;
                            } else {
                                surviving += subText[ci];
                            }
                        }

                        if (!surviving.empty()) {
                            sanitizedArrayTokens.push_back("(" + escapePdfString(surviving) + ")");
                            curX += surviving.size() * cw;
                        }
                        if (purgedWidthInSub > 0) {
                            double kern = -((purgedWidthInSub / currentFontSize) * 1000.0);
                            sanitizedArrayTokens.push_back(std::to_string((int)kern));
                            curX += purgedWidthInSub;
                        }
                    } else {
                        sanitizedArrayTokens.push_back(item);
                        double numVal = std::strtod(item.c_str(), nullptr);
                        if (numVal != 0) {
                            double delta = -(numVal * 0.001 * currentFontSize);
                            curX += delta;
                        }
                    }
                }

                if (anyRedacted) {
                    result.purgedBlocks++;
                    out << "% [PURGED TJ ARRAY BY PDF-STUDIO C++ ENGINE]\n";
                    out << "[ ";
                    for (const auto& it : sanitizedArrayTokens) out << it << " ";
                    out << "] TJ\n";
                } else {
                    for (const auto& s : stack) out << s << " ";
                    out << "TJ\n";
                }
                stack.clear();
            } else {
                for (const auto& s : stack) out << s << " ";
                out << token << "\n";
                stack.clear();
            }
        }

        result.sanitizedStream = out.str();
        return result;
    }
};

} // namespace pdf
