#!/usr/bin/env python3
"""临时委托桩：宿主按 shell cwd 解析相对 hook 路径。原样转发到工作区根的正式 hook。"""
import runpy

runpy.run_path(
    r"D:\createIdear\pingDou\.zcode\hooks\inject-shell-session-context.py",
    run_name="__main__",
)
