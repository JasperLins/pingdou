#!/usr/bin/env python3
"""临时委托桩：宿主按 shell cwd 解析相对 hook 路径，当 shell 位于子项目
（如 px-creat-web/）时根目录的 .zcode/hooks 不可见。此处原样转发到工作区
根目录的正式 hook，行为不变。根治（注册绝对路径）后本文件应删除。"""
import runpy

runpy.run_path(
    r"D:\createIdear\pingDou\.zcode\hooks\inject-shell-session-context.py",
    run_name="__main__",
)
