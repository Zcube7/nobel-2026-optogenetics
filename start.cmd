@echo off
rem Local preview for "A switch for a neuron"
cd /d "%~dp0"
start "" http://127.0.0.1:4192/
node serve.mjs
