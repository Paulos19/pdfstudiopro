#pragma once
#include <vector>
#include <cstdint>
#include <stdexcept>
#include "miniz.h"

namespace pdf {

class Flate {
public:
    static bool decompress(const std::vector<uint8_t>& input, std::vector<uint8_t>& output) {
        if (input.empty()) {
            output.clear();
            return true;
        }

        size_t uncompSize = input.size() * 4;
        if (uncompSize < 4096) uncompSize = 4096;

        while (true) {
            output.resize(uncompSize);
            mz_ulong destLen = (mz_ulong)uncompSize;
            int status = ::mz_uncompress((unsigned char*)output.data(), &destLen, (const unsigned char*)input.data(), (mz_ulong)input.size());
            
            if (status == MZ_OK) {
                output.resize(destLen);
                return true;
            } else if (status == MZ_BUF_ERROR && uncompSize < 100 * 1024 * 1024) {
                uncompSize *= 2;
            } else {
                output = input;
                return false;
            }
        }
    }

    static bool compress(const std::vector<uint8_t>& input, std::vector<uint8_t>& output) {
        if (input.empty()) {
            output.clear();
            return true;
        }

        mz_ulong destLen = ::mz_compressBound((mz_ulong)input.size());
        output.resize(destLen);
        
        int status = ::mz_compress((unsigned char*)output.data(), &destLen, (const unsigned char*)input.data(), (mz_ulong)input.size());
        if (status == MZ_OK) {
            output.resize(destLen);
            return true;
        }
        output = input;
        return false;
    }
};

} // namespace pdf
