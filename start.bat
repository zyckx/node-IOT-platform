@echo off 
echo "请选择数据库启动路径："
echo "1. 默认路径"
echo "2. 自定义路径"
set /p choice=请输入数字：
if %choice%==1 goto cmd1
if %choice%==2 goto cmd2

:cmd1
set dbpath="E:\mongodb-windows-x86_64-6.0.1\dbdata"
mongod.exe --dbpath "%dbpath%"

:cmd2
set /p dbpath=请输入数据库路径：
mongod.exe --dbpath "%dbpath%"
pause
	