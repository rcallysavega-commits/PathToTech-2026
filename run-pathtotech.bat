@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "CLIENT_DIR=%ROOT_DIR%client"
set "SERVER_DIR=%ROOT_DIR%server"
set "ML_DIR=%ROOT_DIR%ml-service"
set "VENV_PYTHON=%ROOT_DIR%.venv\Scripts\python.exe"

echo =============================================
echo   PathToTech Local Launcher
echo =============================================
echo.

if not exist "%CLIENT_DIR%\package.json" (
  echo [ERROR] Client folder not found: %CLIENT_DIR%
  goto :end
)

if not exist "%SERVER_DIR%\package.json" (
  echo [ERROR] Server folder not found: %SERVER_DIR%
  goto :end
)

if not exist "%ML_DIR%\app.py" (
  echo [ERROR] ML service folder not found: %ML_DIR%
  goto :end
)

if not exist "%CLIENT_DIR%\node_modules" (
  echo [SETUP] Installing client dependencies...
  pushd "%CLIENT_DIR%"
  call npm install
  if errorlevel 1 (
    echo [ERROR] Failed to install client dependencies.
    popd
    goto :end
  )
  popd
)

if not exist "%SERVER_DIR%\node_modules" (
  echo [SETUP] Installing server dependencies...
  pushd "%SERVER_DIR%"
  call npm install
  if errorlevel 1 (
    echo [ERROR] Failed to install server dependencies.
    popd
    goto :end
  )
  popd
)

if not exist "%VENV_PYTHON%" (
  echo [ERROR] Python virtual environment not found at: %VENV_PYTHON%
  echo Create it first, then install ML dependencies.
  goto :end
)

echo [SETUP] Ensuring ML dependencies are installed...
pushd "%ML_DIR%"
call "%VENV_PYTHON%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Failed to install ML dependencies.
  popd
  goto :end
)
popd

echo.
echo [RUN] Starting server on new terminal...
start "PathToTech Server" cmd /k "cd /d ""%SERVER_DIR%"" && npm run dev"

echo [RUN] Starting client on new terminal...
start "PathToTech Client" cmd /k "cd /d ""%CLIENT_DIR%"" && npm run dev"

echo [RUN] Starting ML service on new terminal...
start "PathToTech ML Service" cmd /k "cd /d ""%ML_DIR%"" && ..\\.venv\\Scripts\\python -m uvicorn app:app --host 0.0.0.0 --port 8000"

echo.
echo All services are starting in separate windows.
echo You can close this launcher window now.
goto :eof

:end
echo.
echo Launcher stopped due to errors.
pause
