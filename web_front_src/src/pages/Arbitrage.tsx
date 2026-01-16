@echo off
echo ====================================
echo   Polymarket 套利工具启动器
echo ====================================
echo.

echo [1/3] 启动 API 后端...
start "API Backend" cmd /k "cd /d C:\taoli\FKPolyTools\api_src && pnpm dev"

echo [2/3] 等待 API 启动...
timeout /t 5 /nobreak > nul

echo [3/3] 启动 Web 前端...
start "Web Frontend" cmd /k "cd /d C:\taoli\FKPolyTools\web_front_src && pnpm dev"

echo.
echo 等待服务启动...
timeout /t 5 /nobreak > nul

echo.
echo [4/4] 打开浏览器...
start http://localhost:5173

echo.
echo ====================================
echo   启动完成！
echo ====================================
echo.
echo API 后端: http://localhost:3000
echo Web 前端: http://localhost:5173
echo.
echo ⚠️  请不要关闭自动打开的两个命令行窗口！
echo.
pause
