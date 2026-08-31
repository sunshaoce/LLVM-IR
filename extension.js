'use strict';

const LLVM_LABEL_NAME = '(?:[-a-zA-Z$._][-a-zA-Z$._0-9]*|\\d+|"(?:\\\\[0-9A-Fa-f]{2}|[^"\\\\])*")';
const LABEL_DEFINITION = new RegExp('^\\s*(' + LLVM_LABEL_NAME + ')(:)');
const LABEL_REFERENCE = new RegExp('%(' + LLVM_LABEL_NAME + ')', 'g');
const LABEL_KEYWORD = /\blabel\b/g;
const FUNCTION_DEFINITION = new RegExp('^\\s*define\\b[^\\n]*?@(' + LLVM_LABEL_NAME + ')\\s*\\(');
const FUNCTION_REFERENCE = new RegExp('@(' + LLVM_LABEL_NAME + ')(?=\\s*\\()', 'g');

function withoutComment(line) {
	return line.replace(/;.*$/, '');
}

function braceDelta(line) {
	const code = withoutComment(line);
	return (code.match(/{/g) || []).length - (code.match(/}/g) || []).length;
}

function findFunctionRanges(lines) {
	const ranges = [];
	let current = null;
	let depth = 0;

	for (let line = 0; line < lines.length; line += 1) {
		const code = withoutComment(lines[line]);

		if (!current && /^\s*define\b/.test(code)) {
			current = { start: line, end: lines.length - 1 };
			depth = braceDelta(code);
			if (depth < 0) {
				current.end = line;
				ranges.push(current);
				current = null;
			}
			continue;
		}

		if (current) {
			depth += braceDelta(code);
			if (depth <= 0 && code.indexOf('}') !== -1) {
				current.end = line;
				ranges.push(current);
				current = null;
				depth = 0;
			}
		}
	}

	if (current) {
		ranges.push(current);
	}

	return ranges;
}

function rangeForLine(ranges, line) {
	for (const range of ranges) {
		if (line >= range.start && line <= range.end) {
			return range;
		}
	}
	return null;
}

function buildLabelIndex(lines) {
	const ranges = findFunctionRanges(lines);
	const scopes = ranges.map((range) => ({ range, labels: new Map() }));
	const fileLabels = new Map();

	for (let line = 0; line < lines.length; line += 1) {
		const match = LABEL_DEFINITION.exec(lines[line]);
		if (!match) {
			continue;
		}

		const range = rangeForLine(ranges, line);
		const scope = scopes.find((candidate) => candidate.range === range);
		const labels = scope ? scope.labels : fileLabels;
		if (!labels.has(match[1])) {
			labels.set(match[1], { line, character: match.index + match[0].indexOf(match[1]) });
		}
	}

	return { ranges, scopes, fileLabels };
}

function buildFunctionIndex(lines) {
	const functions = new Map();

	for (let line = 0; line < lines.length; line += 1) {
		const code = withoutComment(lines[line]);
		const match = FUNCTION_DEFINITION.exec(code);
		if (match && !functions.has(match[1])) {
			functions.set(match[1], {
				line,
				character: match.index + match[0].indexOf('@')
			});
		}
	}

	return functions;
}

function functionReferenceAtPosition(line, character) {
	FUNCTION_REFERENCE.lastIndex = 0;
	let match;
	while ((match = FUNCTION_REFERENCE.exec(withoutComment(line)))) {
		const start = match.index;
		const end = start + match[0].length;
		if (character >= start && character <= end) {
			return { name: match[1] };
		}
	}

	return null;
}

function labelReferenceAtPosition(line, character) {
	const code = withoutComment(line);
	LABEL_REFERENCE.lastIndex = 0;
	let match;
	while ((match = LABEL_REFERENCE.exec(code))) {
		const start = match.index;
		const end = start + match[0].length;
		if (character < start || character > end) {
			continue;
		}

		const before = line.slice(0, start);
		if (
			/\blabel\s*$/.test(before) ||
			/\bblockaddress\s*\([^,]*,\s*$/.test(before) ||
			(/\bphi\b/.test(code) && /\[[^\]]*,\s*$/.test(before))
		) {
			return { name: match[1] };
		}
	}

	LABEL_KEYWORD.lastIndex = 0;
	while ((match = LABEL_KEYWORD.exec(code))) {
		const start = match.index;
		const end = start + match[0].length;
		if (character < start || character > end) {
			continue;
		}

		const target = new RegExp('^\\s+%(' + LLVM_LABEL_NAME + ')').exec(line.slice(end));
		if (target) {
			return { name: target[1] };
		}
	}

	return null;
}

function createDefinitionProvider(vscode) {
	return {
		provideDefinition(document, position) {
			const lines = [];
			for (let line = 0; line < document.lineCount; line += 1) {
				lines.push(document.lineAt(line).text);
			}

			const lineText = document.lineAt(position.line).text;
			const functionReference = functionReferenceAtPosition(lineText, position.character);
			if (functionReference) {
				const functionTarget = buildFunctionIndex(lines).get(functionReference.name);
				if (functionTarget) {
					return new vscode.Location(
						document.uri,
						new vscode.Position(functionTarget.line, functionTarget.character)
					);
				}
			}

			const reference = labelReferenceAtPosition(lineText, position.character);
			if (!reference) {
				return undefined;
			}

			const index = buildLabelIndex(lines);
			const range = rangeForLine(index.ranges, position.line);
			const scope = index.scopes.find((candidate) => candidate.range === range);
			const target = (scope ? scope.labels : index.fileLabels).get(reference.name);
			if (!target) {
				return undefined;
			}

			return new vscode.Location(
				document.uri,
				new vscode.Position(target.line, target.character)
			);
		}
	};
}

function activate(context) {
	const vscode = require('vscode');
	const provider = createDefinitionProvider(vscode);
	context.subscriptions.push(vscode.languages.registerDefinitionProvider('llvm', provider));
}

function deactivate() {}

module.exports = { activate, deactivate };
