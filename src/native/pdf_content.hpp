#pragma once
#include "pdf_types.hpp"
#include <vector>
#include <string>
#include <sstream>
#include <iostream>
#include <cctype>
#include <cmath>

namespace pdf {

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
        double colorR = 0, colorG = 0, colorB = 0;
        int nextId = 1;

        std::vector<std::string> stack;

        auto skipWhitespace = [&]() {
            while (pos < len && (streamStr[pos] == ' ' || streamStr[pos] == '\t' || 
                                 streamStr[pos] == '\r' || streamStr[pos] == '\n')) {
                pos++;
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

            // Hex string < ... >
            if (c == '<' && pos + 1 < len && streamStr[pos + 1] != '<') {
                pos++;
                std::string s = "<";
                while (pos < len && streamStr[pos] != '>') {
                    s += streamStr[pos++];
                }
                if (pos < len && streamStr[pos] == '>') s += streamStr[pos++];
                return s;
            }

            // Name / ...
            if (c == '/') {
                pos++;
                std::string name = "/";
                while (pos < len && !std::isspace((unsigned char)streamStr[pos]) && 
                       streamStr[pos] != '/' && streamStr[pos] != '(' && streamStr[pos] != '[' && streamStr[pos] != '<') {
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
                   streamStr[pos] != '/') {
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
                }
                stack.clear();
            } else if (token == "Td" || token == "TD") {
                if (stack.size() >= 2) {
                    double tx = std::strtod(stack[stack.size() - 2].c_str(), nullptr);
                    double ty = std::strtod(stack.back().c_str(), nullptr);
                    curX += tx;
                    curY += ty;
                }
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
                    rawText = stack.back();
                    if (rawText.size() >= 2 && rawText.front() == '(' && rawText.back() == ')') {
                        rawText = rawText.substr(1, rawText.size() - 2);
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
                for (const auto& item : stack) {
                    if (item.size() >= 2 && item.front() == '(' && item.back() == ')') {
                        std::string sub = item.substr(1, item.size() - 2);
                        combinedText += sub;
                        totalWidth += sub.length() * (currentFontSize * 0.52);
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
                    tb.width = totalWidth > 0 ? totalWidth : combinedText.length() * (currentFontSize * 0.52);
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

} // namespace pdf
