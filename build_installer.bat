@echo off
echo ========================================================
echo  PDF Studio Pro - Gerador do Instalador Nativo Windows
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Compilando motor C++ nativo (pdf_engine.exe)...
call build_native.bat

if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Falha ao compilar o motor C++.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Verificando dependencias do Electron...
call npm install

echo.
echo [3/3] Empacotando aplicativo e gerando instalador Windows (.exe)...
call npm run dist:win

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [SUCESSO] Instalador gerado na pasta dist/ !
    echo  - dist\PDF Studio Pro Setup 1.0.0.exe (Instalador NSIS)
    echo  - dist\PDF Studio Pro 1.0.0.exe (Versao Portatil)
    echo ========================================================
) else (
    echo [ERRO] Falha ao gerar instalador.
)

pause
