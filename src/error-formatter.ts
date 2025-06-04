import type { ParseErr, ParseErrorBundle } from "./errors";

export type ErrorFormat = "plain" | "ansi" | "html" | "json";

export type ErrorFormatterOptions = {
  maxContextLines?: number;
  showHints?: boolean;
  colorize?: boolean;
  showContext?: boolean;
  tabSize?: number;
};

/**
 * Formats ParseErrorBundle into human-readable error messages with multiple output formats.
 * Supports plain text, ANSI colors, HTML, and JSON formats.
 */
export class ErrorFormatter {
  private _format: ErrorFormat;
  private options: ErrorFormatterOptions;

  constructor(format: ErrorFormat = "plain", options: ErrorFormatterOptions = {}) {
    this._format = format;
    // Set default options
    this.options = {
      maxContextLines: 3,
      showHints: true,
      colorize: true,
      showContext: true,
      tabSize: 2,
      ...options
    };
  }

  /**
   * Format a ParseErrorBundle into a string based on the configured format.
   *
   * @param bundle - The error bundle to format
   * @returns Formatted error message string
   */
  format(bundle: ParseErrorBundle): string {
    switch (this._format) {
      case "ansi":
        return this.formatAnsi(bundle);
      case "html":
        return this.formatHtml(bundle);
      case "json":
        return this.formatJson(bundle);
      default:
        return this.formatPlain(bundle);
    }
  }

  /**
   * Format error with ANSI color codes for terminal output.
   */
  private formatAnsi(bundle: ParseErrorBundle): string {
    const primary = bundle.primary;
    const lines = bundle.source.split("\n");
    const errorLine = lines[primary.span.line - 1] || "";

    const parts: string[] = [];

    // Error header with location
    parts.push(`\x1b[31mError\x1b[0m at line ${primary.span.line}, column ${primary.span.column}:`);

    // Show context lines if enabled
    if (this.options.showContext && this.options.maxContextLines! > 0) {
      const contextLines = this.getContextLines(
        lines,
        primary.span.line - 1,
        this.options.maxContextLines!
      );
      parts.push(...contextLines.map(line => `  ${line}`));
    } else {
      // Just show the error line
      parts.push(`  ${errorLine}`);
    }

    // Add pointer arrow (accounting for line prefix)
    const linePrefix = `  >   ${primary.span.line.toString().padStart(0, " ")} | `;
    const adjustedColumn = primary.span.column + linePrefix.length - 2; // -2 for the "  " we add
    const pointer = this.createPointer(adjustedColumn, primary.span.length);
    parts.push(`  ${pointer}`);

    // Error message
    parts.push(this.formatErrorMessage(primary));

    // Add hints if available
    const hints = this.getHints(primary);
    if (this.options.showHints && hints.length > 0) {
      parts.push("");
      for (const hint of hints) {
        parts.push(`  \x1b[36mDid you mean: ${hint}?\x1b[0m`);
      }
    }

    // Add context stack if available
    if (this.options.showContext && primary.context && primary.context.length > 0) {
      parts.push("");
      parts.push(`  \x1b[90mContext: ${primary.context.join(" > ")}\x1b[0m`);
    }

    return parts.join("\n");
  }

  /**
   * Format error as plain text without colors.
   */
  private formatPlain(bundle: ParseErrorBundle): string {
    const primary = bundle.primary;
    const lines = bundle.source.split("\n");
    const errorLine = lines[primary.span.line - 1] || "";

    const parts: string[] = [];

    // Error header
    parts.push(`Error at line ${primary.span.line}, column ${primary.span.column}:`);

    // Show context lines
    if (this.options.showContext && this.options.maxContextLines! > 0) {
      const contextLines = this.getContextLines(
        lines,
        primary.span.line - 1,
        this.options.maxContextLines!
      );
      parts.push(...contextLines.map(line => `  ${line}`));
    } else {
      parts.push(`  ${errorLine}`);
    }

    // Add pointer (accounting for line prefix)
    const linePrefix = `  >   ${primary.span.line.toString()} | `;
    const adjustedColumn = primary.span.column + linePrefix.length - 2; // -2 for the "  " we add
    const pointer = this.createPointer(adjustedColumn, primary.span.length, false);
    parts.push(`  ${pointer}`);

    // Error message
    parts.push(this.formatErrorMessage(primary, false));

    // Add hints
    const hints = this.getHints(primary);
    if (this.options.showHints && hints.length > 0) {
      parts.push("");
      for (const hint of hints) {
        parts.push(`  Did you mean: ${hint}?`);
      }
    }

    // Add context
    if (this.options.showContext && primary.context && primary.context.length > 0) {
      parts.push("");
      parts.push(`  Context: ${primary.context.join(" > ")}`);
    }

    return parts.join("\n");
  }

  /**
   * Format error as HTML with styling.
   */
  private formatHtml(bundle: ParseErrorBundle): string {
    const primary = bundle.primary;
    const lines = bundle.source.split("\n");
    const errorLine = lines[primary.span.line - 1] || "";

    const parts: string[] = [];

    parts.push('<div class="parse-error">');

    // Error header
    parts.push(
      `  <div class="error-header">Error at line ${primary.span.line}, column ${primary.span.column}:</div>`
    );

    // Code context
    parts.push('  <div class="error-context">');
    if (this.options.showContext && this.options.maxContextLines! > 0) {
      const contextLines = this.getContextLines(
        lines,
        primary.span.line - 1,
        this.options.maxContextLines!
      );
      for (const line of contextLines) {
        parts.push(`    <div class="context-line">${this.escapeHtml(line)}</div>`);
      }
    } else {
      parts.push(`    <div class="error-line">${this.escapeHtml(errorLine)}</div>`);
    }

    // Pointer (accounting for line prefix in plain text representation)
    const pointer = this.createPointer(primary.span.column, primary.span.length, false);
    parts.push(`    <div class="error-pointer">${pointer}</div>`);
    parts.push("  </div>");

    // Error message
    parts.push(
      `  <div class="error-message">${this.escapeHtml(this.formatErrorMessage(primary, false))}</div>`
    );

    // Hints
    const hints = this.getHints(primary);
    if (this.options.showHints && hints.length > 0) {
      parts.push('  <div class="error-hints">');
      for (const hint of hints) {
        parts.push(
          `    <div class="hint">Did you mean: <span class="suggestion">${this.escapeHtml(hint)}</span>?</div>`
        );
      }
      parts.push("  </div>");
    }

    // Context
    if (this.options.showContext && primary.context && primary.context.length > 0) {
      parts.push(
        `  <div class="error-context-stack">Context: ${primary.context.map(c => `<span class="context-item">${this.escapeHtml(c)}</span>`).join(" &gt; ")}</div>`
      );
    }

    parts.push("</div>");

    return parts.join("\n");
  }

  /**
   * Format error as JSON for programmatic consumption.
   */
  private formatJson(bundle: ParseErrorBundle): string {
    const primary = bundle.primary;
    const lines = bundle.source.split("\n");

    const contextLines =
      this.options.showContext ?
        this.getContextLines(lines, primary.span.line - 1, this.options.maxContextLines!)
      : [lines[primary.span.line - 1] || ""];

    return JSON.stringify(
      {
        error: {
          type: primary.tag,
          message: this.getPlainErrorMessage(primary),
          location: {
            line: primary.span.line,
            column: primary.span.column,
            offset: primary.span.offset,
            length: primary.span.length
          },
          context: { lines: contextLines, stack: primary.context || [] },
          hints: this.getHints(primary),
          source: bundle.source
        },
        allErrors: bundle.errors.map(err => ({
          type: err.tag,
          location: {
            line: err.span.line,
            column: err.span.column,
            offset: err.span.offset,
            length: err.span.length
          },
          context: err.context || [],
          ...(err.tag === "Expected" && { items: err.items }),
          ...(err.tag === "Unexpected" && { found: err.found }),
          ...(err.tag === "Custom" && { message: err.message, hints: err.hints })
        }))
      },
      null,
      this.options.tabSize
    );
  }

  /**
   * Format the error message based on error type.
   */
  private formatErrorMessage(error: ParseErr, useColors: boolean = true): string {
    const red = useColors ? "\x1b[31m" : "";
    const yellow = useColors ? "\x1b[33m" : "";
    const reset = useColors ? "\x1b[0m" : "";

    switch (error.tag) {
      case "Expected":
        return `  ${yellow}Expected:${reset} ${error.items.join(" or ")}`;
      case "Unexpected":
        return `  ${red}Unexpected:${reset} ${error.found}`;
      case "Custom":
        return `  ${error.message}`;
      case "Fatal":
        return `  ${red}Fatal:${reset} ${error.message}`;
    }
  }

  /**
   * Get plain error message without formatting.
   */
  private getPlainErrorMessage(error: ParseErr): string {
    switch (error.tag) {
      case "Expected":
        return `Expected: ${error.items.join(" or ")}`;
      case "Unexpected":
        return `Unexpected: ${error.found}`;
      case "Custom":
        return error.message;
      case "Fatal":
        return `Fatal: ${error.message}`;
    }
  }

  /**
   * Create a pointer/caret pointing to the error location.
   */
  private createPointer(column: number, length: number = 1, useColors: boolean = true): string {
    const spaces = " ".repeat(Math.max(0, column - 1));
    const carets = "^".repeat(Math.max(1, length));
    const red = useColors ? "\x1b[31m" : "";
    const reset = useColors ? "\x1b[0m" : "";
    return `${spaces}${red}${carets}${reset}`;
  }

  /**
   * Get context lines around the error location.
   */
  private getContextLines(allLines: string[], errorLineIndex: number, maxLines: number): string[] {
    const contextRadius = Math.floor(maxLines / 2);
    const startLine = Math.max(0, errorLineIndex - contextRadius);
    const endLine = Math.min(allLines.length - 1, errorLineIndex + contextRadius);

    const contextLines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineNum = i + 1;
      const lineContent = allLines[i] || "";
      const isErrorLine = i === errorLineIndex;
      const prefix = isErrorLine ? ">" : " ";
      const paddedLineNum = lineNum.toString().padStart(3, " ");
      contextLines.push(`${prefix} ${paddedLineNum} | ${lineContent}`);
    }

    return contextLines;
  }

  /**
   * Escape HTML entities.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Create a new formatter with different options.
   */
  withOptions(options: Partial<ErrorFormatterOptions>): ErrorFormatter {
    return new ErrorFormatter(this._format, { ...this.options, ...options });
  }

  /**
   * Create a new formatter with a different format.
   */
  withFormat(format: ErrorFormat): ErrorFormatter {
    return new ErrorFormatter(format, this.options);
  }

  /**
   * Get hints from an error, handling the union type safely.
   */
  private getHints(error: ParseErr): string[] {
    if (error.tag === "Custom" && error.hints) {
      return error.hints;
    }
    if (error.tag === "Unexpected" && error.hints) {
      return error.hints;
    }
    return [];
  }
}

/**
 * Convenience functions for quick formatting.
 */
export const formatError = {
  plain: (bundle: ParseErrorBundle, options?: ErrorFormatterOptions) =>
    new ErrorFormatter("plain", options).format(bundle),
  ansi: (bundle: ParseErrorBundle, options?: ErrorFormatterOptions) =>
    new ErrorFormatter("ansi", options).format(bundle),
  html: (bundle: ParseErrorBundle, options?: ErrorFormatterOptions) =>
    new ErrorFormatter("html", options).format(bundle),
  json: (bundle: ParseErrorBundle, options?: ErrorFormatterOptions) =>
    new ErrorFormatter("json", options).format(bundle)
};
