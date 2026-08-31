# LLVM IR

Syntax highlighting, snippets, and basic navigation support for LLVM IR (LLVM Intermediate Representation).

[This project](https://github.com/sunshaoce/LLVM-IR) is copied and adapted from [vscode-llvm](https://github.com/RReverser/vscode-llvm) and [LLVM TextMate Bundle](https://github.com/whitequark/LLVM.tmBundle).

## Features

- Basic syntax highlighting
- Snippets
- Go to Definition for functions and basic block labels in the current file
- Control/Command + click navigation from function calls and basic block references

### Snippets
Instruction | Short Cut
---|---
alloca|alloca
branch conditionally|br
branch unconditionally|bru
call|call
def|def
getelementptr|getelementptr
hello world program|hello
icmp|icmp
load|load
ret|ret
store|store

## Known Issues

- Navigation is limited to definitions in the current file; SSA values and cross-file declarations are not resolved.
- Please report grammar issues or suggestions to the [LLVM TextMate Bundle repository](https://github.com/whitequark/LLVM.tmBundle/issues) and extension-related suggestions [here](https://github.com/sunshaoce/LLVM-IR/issues).
